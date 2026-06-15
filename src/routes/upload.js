const express = require("express");
const multer  = require("multer");
const streamifier = require("streamifier");
const cloudinary = require("../utils/cloudinary");
const { userAuth } = require("../middlewares/auth");
const Community  = require("../models/community");

const uploadRouter = express.Router();

// ── Multer: memory storage, images only, max 5 MB ────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

// ── Helper: upload buffer to Cloudinary via stream ───────────────────────────
function uploadToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

// ── POST /upload/profile-photo ────────────────────────────────────────────────
// Uploads a profile picture for the logged-in user and updates their record.
uploadRouter.post(
  "/upload/profile-photo",
  userAuth,
  upload.single("photo"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      // Delete old Cloudinary image if it was previously uploaded there
      const user = req.user;
      if (user.photoPublicId) {
        await cloudinary.uploader.destroy(user.photoPublicId).catch(() => {});
      }

      const result = await uploadToCloudinary(req.file.buffer, {
        folder: "devtinder/profiles",
        public_id: `user_${user._id}`,
        overwrite: true,
        transformation: [
          { width: 400, height: 400, crop: "fill", gravity: "face" },
          { quality: "auto", fetch_format: "auto" },
        ],
      });

      // Save URL + public_id back to user document
      user.photoUrl= result.secure_url;
      user.photoPublicId = result.public_id;
      await user.save();

      return res.json({
        message: "Profile photo uploaded successfully",
        photoUrl: result.secure_url,
      });
    } catch (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "Image too large. Maximum size is 5 MB." });
      }
      if (err.message?.includes("Only image")) {
        return res.status(400).json({ message: err.message });
      }
      console.error("[Upload] profile-photo error:", err.message);
      return res.status(500).json({ message: "Upload failed: " + err.message });
    }
  }
);

// ── POST /upload/community-banner/:communityId ────────────────────────────────
// Uploads a cover image for a community (admin only).
uploadRouter.post(
  "/upload/community-banner/:communityId",
  userAuth,
  upload.single("banner"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      const community = await Community.findOne({
        _id: req.params.communityId,
        isActive: true,
      });

      if (!community) {
        return res.status(404).json({ message: "Community not found" });
      }

      const isAdmin = community.admins.some(
        (a) => a.toString() === req.user._id.toString()
      );
      if (!isAdmin) {
        return res.status(403).json({ message: "Only admins can update the community banner" });
      }

      // Delete old banner if it was a Cloudinary upload
      if (community.coverImagePublicId) {
        await cloudinary.uploader.destroy(community.coverImagePublicId).catch(() => {});
      }

      const result = await uploadToCloudinary(req.file.buffer, {
        folder:         "devtinder/communities",
        public_id:      `community_${community._id}`,
        overwrite:      true,
        transformation: [
          { width: 1200, height: 400, crop: "fill", gravity: "center" },
          { quality: "auto", fetch_format: "auto" },
        ],
      });

      community.coverImage = result.secure_url;
      community.coverImagePublicId= result.public_id;
      await community.save();

      return res.json({
        message: "Community banner uploaded successfully",
        coverImage: result.secure_url,
      });
    } catch (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "Image too large. Maximum size is 5 MB." });
      }
      if (err.message?.includes("Only image")) {
        return res.status(400).json({ message: err.message });
      }
      console.error("[Upload] community-banner error:", err.message);
      return res.status(500).json({ message: "Upload failed: " + err.message });
    }
  }
);

module.exports = uploadRouter;
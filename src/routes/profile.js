const express       = require("express");
const profileRouter = express.Router();
const { userAuth }  = require("../middlewares/auth");
const User          = require("../models/user");
const bcrypt        = require("bcrypt");
const validator     = require("validator");

// ── GET /profile/view ─────────────────────────────────────────────────────────
profileRouter.get("/profile/view", userAuth, async (req, res) => {
  try {
    const user = req.user;
    res.json(user);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── PUT /profile/edit ─────────────────────────────────────────────────────────
profileRouter.put("/profile/edit", userAuth, async (req, res) => {
  const ALLOWED_UPDATES = [
    // ── basic fields ──
    "firstName",
    "lastName",
    "photoUrl",
    "about",
    "age",
    "gender",
    "skills",
    // ── my own profile attributes ──
    "role",
    "goals",
    "availability",
    "experienceLevel",
    "timezone",
    "hackathonInterest",
    "startupInterest",
    "learningGoals",
    "projectIdeas",
    // ── desired developer preferences ──
    "preferredRoles",
    "preferredTimezones",
    "preferredInterests",
    "preferredExperienceLevel",
    "preferredAvailability",
  ];

  try {
    // Reject any keys not in the whitelist
    const isUpdateAllowed = Object.keys(req.body).every((key) =>
      ALLOWED_UPDATES.includes(key)
    );
    if (!isUpdateAllowed) {
      return res.status(400).json({ message: "Invalid update fields" });
    }

    // Basic validations
    if (req.body.photoUrl && !validator.isURL(req.body.photoUrl)) {
      return res.status(400).json({ message: "Invalid photo URL" });
    }
    if (req.body.skills && req.body.skills.length > 20) {
      return res.status(400).json({ message: "Maximum 20 skills allowed" });
    }
    if (req.body.about && req.body.about.length > 300) {
      return res.status(400).json({ message: "About must be ≤ 300 characters" });
    }
    if (req.body.preferredTimezones && req.body.preferredTimezones.length > 5) {
      return res.status(400).json({ message: "Maximum 5 preferred timezones allowed" });
    }

    // Apply updates
    const user = req.user;
    Object.keys(req.body).forEach((key) => {
      user[key] = req.body[key];
    });

    await user.save();

    res.json({ message: "Profile updated successfully", data: user });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── PUT /profile/password ─────────────────────────────────────────────────────
profileRouter.put("/profile/password", userAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Both passwords are required" });
    }

    const user = req.user;
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }
    if (!validator.isStrongPassword(newPassword)) {
      return res.status(400).json({ message: "New password is not strong enough" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = profileRouter;
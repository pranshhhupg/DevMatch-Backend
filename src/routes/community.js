const express = require("express");
const communityRouter = express.Router();
const { userAuth } = require("../middlewares/auth");
const Community = require("../models/community");

const USER_FIELDS = "firstName lastName photoUrl skills experienceLevel";

// ── Helper ─────────────────────────────────────────────────────────────────────
const isAdmin = (community, userId) =>
  community.admins.some((a) => a.toString() === userId.toString());

const isMember = (community, userId) =>
  community.members.some((m) => m.toString() === userId.toString());

// ── POST /community — Create ───────────────────────────────────────────────────
communityRouter.post("/community", userAuth, async (req, res) => {
  try {
    const { name, description, category, coverImage, messagePermission } =
      req.body;

    if (!name?.trim() || !description?.trim() || !category) {
      return res
        .status(400)
        .json({ message: "Name, description, and category are required" });
    }

    const community = new Community({
      name: name.trim(),
      description: description.trim(),
      category,
      coverImage: coverImage?.trim() || "",
      messagePermission: messagePermission || "all",
      createdBy: req.user._id,
      admins: [req.user._id],
      members: [req.user._id],
    });

    await community.save();
    await community.populate("createdBy", USER_FIELDS);

    return res
      .status(201)
      .json({ message: "Community created successfully", data: community });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

// ── GET /communities — Browse all (with search + filter + pagination) ──────────
communityRouter.get("/communities", userAuth, async (req, res) => {
  try {
    const { search, category } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 12, 50);
    const skip = (page - 1) * limit;

    const filter = { isActive: true };
    if (category) filter.category = category;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const [communities, total] = await Promise.all([
      Community.find(filter)
        .populate("createdBy", USER_FIELDS)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean({ virtuals: true }),
      Community.countDocuments(filter),
    ]);

    // Attach membership flag for each community
    const userId = req.user._id.toString();
    const enriched = communities.map((c) => ({
      ...c,
      isMember: c.members.some((m) => m.toString() === userId),
      isAdmin: c.admins.some((a) => a.toString() === userId),
    }));

    return res.json({
      success: true,
      data: enriched,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

// ── GET /community/:id — Single community detail ───────────────────────────────
communityRouter.get("/community/:id", userAuth, async (req, res) => {
  try {
    const community = await Community.findOne({
      _id: req.params.id,
      isActive: true,
    })
      .populate("createdBy", USER_FIELDS)
      .populate("admins", USER_FIELDS)
      .populate("members", USER_FIELDS)
      .lean({ virtuals: true });

    if (!community)
      return res.status(404).json({ message: "Community not found" });

    const userId = req.user._id.toString();
    community.isMember = community.members.some(
      (m) => m._id.toString() === userId
    );
    community.isAdmin = community.admins.some(
      (a) => a._id.toString() === userId
    );

    return res.json({ success: true, data: community });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

// ── POST /community/:id/join — Join community ──────────────────────────────────
communityRouter.post("/community/:id/join", userAuth, async (req, res) => {
  try {
    const community = await Community.findOne({
      _id: req.params.id,
      isActive: true,
    });

    if (!community)
      return res.status(404).json({ message: "Community not found" });

    if (isMember(community, req.user._id)) {
      return res
        .status(400)
        .json({ message: "Already a member of this community" });
    }

    community.members.push(req.user._id);
    await community.save();

    return res.json({ message: "Joined community successfully" });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

// ── POST /community/:id/leave — Leave community ────────────────────────────────
communityRouter.post("/community/:id/leave", userAuth, async (req, res) => {
  try {
    const community = await Community.findOne({
      _id: req.params.id,
      isActive: true,
    });

    if (!community)
      return res.status(404).json({ message: "Community not found" });

    if (!isMember(community, req.user._id)) {
      return res.status(400).json({ message: "Not a member of this community" });
    }

    // Creator cannot leave
    if (community.createdBy.toString() === req.user._id.toString()) {
      return res
        .status(400)
        .json({ message: "Creator cannot leave. Transfer ownership or delete." });
    }

    community.members = community.members.filter(
      (m) => m.toString() !== req.user._id.toString()
    );
    community.admins = community.admins.filter(
      (a) => a.toString() !== req.user._id.toString()
    );
    await community.save();

    return res.json({ message: "Left community successfully" });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

// ── PUT /community/:id — Edit community (admin only) ──────────────────────────
communityRouter.put("/community/:id", userAuth, async (req, res) => {
  try {
    const community = await Community.findOne({
      _id: req.params.id,
      isActive: true,
    });

    if (!community)
      return res.status(404).json({ message: "Community not found" });

    if (!isAdmin(community, req.user._id)) {
      return res
        .status(403)
        .json({ message: "Only admins can edit this community" });
    }

    const ALLOWED = [
      "name",
      "description",
      "category",
      "coverImage",
      "messagePermission",
    ];
    ALLOWED.forEach((key) => {
      if (req.body[key] !== undefined) community[key] = req.body[key];
    });

    await community.save();
    await community.populate("createdBy admins members", USER_FIELDS);

    return res.json({ message: "Community updated", data: community });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

// ── DELETE /community/:id — Soft-delete (creator only) ────────────────────────
communityRouter.delete("/community/:id", userAuth, async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);

    if (!community)
      return res.status(404).json({ message: "Community not found" });

    if (community.createdBy.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Only the creator can delete this community" });
    }

    community.isActive = false;
    await community.save();

    return res.json({ message: "Community deleted successfully" });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

// ── POST /community/:id/promote — Promote member to admin (admin only) ─────────
communityRouter.post("/community/:id/promote", userAuth, async (req, res) => {
  try {
    const { memberId } = req.body;
    if (!memberId)
      return res.status(400).json({ message: "memberId is required" });

    const community = await Community.findOne({
      _id: req.params.id,
      isActive: true,
    });

    if (!community)
      return res.status(404).json({ message: "Community not found" });

    if (!isAdmin(community, req.user._id)) {
      return res
        .status(403)
        .json({ message: "Only admins can promote members" });
    }

    if (!isMember(community, memberId)) {
      return res
        .status(400)
        .json({ message: "User is not a member of this community" });
    }

    if (isAdmin(community, memberId)) {
      return res.status(400).json({ message: "User is already an admin" });
    }

    community.admins.push(memberId);
    await community.save();

    return res.json({ message: "Member promoted to admin" });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

// ── POST /community/:id/demote — Demote admin to member (creator only) ─────────
communityRouter.post("/community/:id/demote", userAuth, async (req, res) => {
  try {
    const { memberId } = req.body;
    if (!memberId)
      return res.status(400).json({ message: "memberId is required" });

    const community = await Community.findOne({
      _id: req.params.id,
      isActive: true,
    });

    if (!community)
      return res.status(404).json({ message: "Community not found" });

    // Only the original creator can demote admins
    if (community.createdBy.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Only the community creator can demote admins" });
    }

    if (memberId === community.createdBy.toString()) {
      return res
        .status(400)
        .json({ message: "Cannot demote the community creator" });
    }

    community.admins = community.admins.filter(
      (a) => a.toString() !== memberId
    );
    await community.save();

    return res.json({ message: "Admin demoted to member" });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

// ── POST /community/:id/remove-member — Kick a member (admin only) ────────────
communityRouter.post(
  "/community/:id/remove-member",
  userAuth,
  async (req, res) => {
    try {
      const { memberId } = req.body;
      if (!memberId)
        return res.status(400).json({ message: "memberId is required" });

      const community = await Community.findOne({
        _id: req.params.id,
        isActive: true,
      });

      if (!community)
        return res.status(404).json({ message: "Community not found" });

      if (!isAdmin(community, req.user._id)) {
        return res
          .status(403)
          .json({ message: "Only admins can remove members" });
      }

      if (memberId === community.createdBy.toString()) {
        return res
          .status(400)
          .json({ message: "Cannot remove the community creator" });
      }

      community.members = community.members.filter(
        (m) => m.toString() !== memberId
      );
      community.admins = community.admins.filter(
        (a) => a.toString() !== memberId
      );
      await community.save();

      return res.json({ message: "Member removed successfully" });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  }
);

// ── GET /community/:id/chat-messages — Load recent chat messages ───────────────
communityRouter.get(
  "/community/:id/chat-messages",
  userAuth,
  async (req, res) => {
    try {
      const community = await Community.findOne({
        _id: req.params.id,
        isActive: true,
      });

      if (!community)
        return res.status(404).json({ message: "Community not found" });

      if (!isMember(community, req.user._id)) {
        return res
          .status(403)
          .json({ message: "Only members can view community chat" });
      }

      const { CommunityChat } = require("../models/communityChat");
      const limit = Math.min(parseInt(req.query.limit) || 50, 200);

      const chat = await CommunityChat.findOne({
        community: req.params.id,
      }).populate({
        path: "messages.senderId",
        select: "firstName lastName photoUrl",
      });

      if (!chat) return res.json({ success: true, data: [] });

      // Return the last `limit` messages
      const messages = chat.messages.slice(-limit);

      return res.json({ success: true, data: messages });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  }
);

// ── GET /community/:id/message-permission — Check if user can send ────────────
communityRouter.get(
  "/community/:id/message-permission",
  userAuth,
  async (req, res) => {
    try {
      const community = await Community.findOne({
        _id: req.params.id,
        isActive: true,
      });

      if (!community)
        return res.status(404).json({ message: "Community not found" });

      if (!isMember(community, req.user._id)) {
        return res.status(403).json({ message: "Not a member" });
      }

      const canSend =
        community.messagePermission === "all" ||
        isAdmin(community, req.user._id);

      return res.json({ success: true, canSend, permission: community.messagePermission });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  }
);

// ── PATCH /community/:id/message-permission — Update permission (admin only) ───
communityRouter.put(
  "/community/:id/message-permission",
  userAuth,
  async (req, res) => {
    try {
      const { messagePermission } = req.body;
      if (!["all", "admins_only"].includes(messagePermission)) {
        return res.status(400).json({ message: "Invalid permission value" });
      }

      const community = await Community.findOne({
        _id: req.params.id,
        isActive: true,
      });

      if (!community)
        return res.status(404).json({ message: "Community not found" });

      if (!isAdmin(community, req.user._id)) {
        return res
          .status(403)
          .json({ message: "Only admins can change message permissions" });
      }

      community.messagePermission = messagePermission;
      await community.save();

      return res.json({
        message: "Message permission updated",
        messagePermission: community.messagePermission,
      });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  }
);

module.exports = communityRouter;
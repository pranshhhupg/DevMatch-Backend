const express      = require("express");
const collabRouter = express.Router();
const { userAuth } = require("../middlewares/auth");
const Opportunity  = require("../models/opportunity");

// Only expose safe poster fields to the client
const POSTER_FIELDS = "firstName lastName photoUrl skills experienceLevel";

// ── POST /collab/opportunity — Create ─────────────────────────────────────────
collabRouter.post("/collab/opportunity", userAuth, async (req, res) => {
  try {
    const {
      title, description, type, location,
      duration, techStack, teamSize, level, rolesNeeded, applyLink,
    } = req.body;

    if (!title?.trim() || !description?.trim() || !type || !location?.trim()) {
      return res
        .status(400)
        .json({ message: "Title, description, type, and location are required" });
    }

    const opportunity = new Opportunity({
      postedBy:    req.user._id,
      title:       title.trim(),
      description: description.trim(),
      type,
      location:    location.trim(),
      duration:    duration?.trim()   || "",
      techStack:   techStack          || [],
      teamSize:    teamSize           || undefined,
      level:       level              || "any",
      rolesNeeded: rolesNeeded        || [],
      applyLink:   applyLink?.trim()  || "",
    });

    await opportunity.save();
    await opportunity.populate("postedBy", POSTER_FIELDS);

    return res
      .status(201)
      .json({ message: "Opportunity created successfully", data: opportunity });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

// ── GET /collab/opportunities — All, with filters + pagination ────────────────
collabRouter.get("/collab/opportunities", userAuth, async (req, res) => {
  try {
    const { type, location, level, techStack } = req.query;
    const page  = Math.max(parseInt(req.query.page)  || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 12, 50);
    const skip  = (page - 1) * limit;

    const filter = { isActive: true };
    if (type) filter.type = type;
    if (level && level !== "any") filter.level = level;
    if (location) filter.location = { $regex: location, $options: "i" };
    if (techStack) {
      const tags = techStack.split(",").map((t) => t.trim()).filter(Boolean);
      if (tags.length) filter.techStack = { $in: tags };
    }

    const [opportunities, total] = await Promise.all([
      Opportunity.find(filter)
        .populate("postedBy", POSTER_FIELDS)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Opportunity.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data:opportunities,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

// ── GET /collab/my-opportunities — Logged-in user's own listings ──────────────
collabRouter.get("/collab/my-opportunities", userAuth, async (req, res) => {
  try {
    const opportunities = await Opportunity.find({ postedBy: req.user._id })
      .sort({ createdAt: -1 });
    return res.json({ success: true, data: opportunities });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

// ── GET /collab/opportunity/:id — Single ──────────────────────────────────────
collabRouter.get("/collab/opportunity/:id", userAuth, async (req, res) => {
  try {
    const opportunity = await Opportunity.findOne({
      _id: req.params.id,
      isActive: true,
    }).populate("postedBy", POSTER_FIELDS);

    if (!opportunity)
      return res.status(404).json({ message: "Opportunity not found" });

    return res.json({ success: true, data: opportunity });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

// ── PATCH /collab/opportunity/:id — Edit own ──────────────────────────────────
collabRouter.put("/collab/opportunity/:id", userAuth, async (req, res) => {
  try {
    const opportunity = await Opportunity.findById(req.params.id);
    if (!opportunity)
      return res.status(404).json({ message: "Opportunity not found" });
    if (opportunity.postedBy.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Not authorized to edit this opportunity" });

    const ALLOWED = [
      "title", "description", "type", "location", "duration",
      "techStack", "teamSize", "level", "rolesNeeded", "applyLink", "isActive",
    ];
    Object.keys(req.body).forEach((key) => {
      if (ALLOWED.includes(key)) opportunity[key] = req.body[key];
    });

    await opportunity.save();
    await opportunity.populate("postedBy", POSTER_FIELDS);

    return res.json({ message: "Opportunity updated", data: opportunity });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

// ── DELETE /collab/opportunity/:id — Delete own ───────────────────────────────
collabRouter.delete("/collab/opportunity/:id", userAuth, async (req, res) => {
  try {
    const opportunity = await Opportunity.findById(req.params.id);
    if (!opportunity)
      return res.status(404).json({ message: "Opportunity not found" });
    if (opportunity.postedBy.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Not authorized to delete this opportunity" });

    await Opportunity.findByIdAndDelete(req.params.id);
    return res.json({ message: "Opportunity deleted successfully" });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

module.exports = collabRouter;
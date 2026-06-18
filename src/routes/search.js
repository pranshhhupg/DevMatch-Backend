/**
 * routes/search.js
 * ─────────────────────────────────────────────────────────────────────────────
 * GET /user/search
 *   Query params:
 *     q            – free-text search (name / skill / role / goal)
 *     role         – role filter: frontend | backend | fullstack | ml | ai
 *                                 | prompt | datascientist | dataanalyst
 *                                 | devops | mobile | designer | product
 *                                 | qa | blockchain | consultant
 *     availability – availability filter: weekends | evenings | fulltime
 *                                         | flexible | hackathon | startup
 *     page         – page number (default: 1)
 *     limit        – results per page (default: 20, max: 50)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const express             = require("express");
const { userAuth }        = require("../middlewares/auth");
const User                = require("../models/user");
const ConnectionRequest   = require("../models/connectionRequests");
const { buildSearchQuery } = require("../utils/searchHelpers");

const searchRouter = express.Router();

// Fields exposed in search results (safe, no sensitive info)
const SEARCH_FIELDS =
  "firstName lastName photoUrl about skills lookingFor goals " +
  "availability experienceLevel hackathonInterest startupInterest " +
  "learningGoals timezone";

// ─────────────────────────────────────────────────────────────────────────────
// GET /user/search
// ─────────────────────────────────────────────────────────────────────────────

searchRouter.get("/user/search", userAuth, async (req, res) => {
  try {
    const {
      q            = "",
      role         = "all",
      availability = "all",
      page         = 1,
      limit        = 20,
    } = req.query;

    // Sanitise pagination
    const pageNum  = Math.max(parseInt(page)  || 1,  1);
    const limitNum = Math.min(parseInt(limit) || 20, 50);
    const skip     = (pageNum - 1) * limitNum;

    // ── Collect every user the logged-in user has already interacted with ────
    // (sent or received — any status: interested / ignored / accepted / rejected)
    const interactions = await ConnectionRequest.find({
      $or: [
        { fromUserId: req.user._id },
        { toUserId:   req.user._id },
      ],
    })
    .select("fromUserId toUserId")
    .lean();

    const excludedIds = new Set([req.user._id.toString()]);
    interactions.forEach(({ fromUserId, toUserId }) => {
      excludedIds.add(fromUserId.toString());
      excludedIds.add(toUserId.toString());
    });

    // Build MongoDB filter (also injects the excluded-ids set)
    const mongoQuery = buildSearchQuery({
      q:              q.trim(),
      role,
      availability,
      loggedInUserId: req.user._id,
      excludedIds,     // ← passed through to helper
    });

    // If nothing meaningful was queried, return empty so the UI shows a placeholder
    const hasQuery = q.trim() || (role && role !== "all") || (availability && availability !== "all");

    if (!hasQuery) {
      return res.json({
        message:    "Enter a search term to find developers",
        data:       [],
        total:      0,
        page:       pageNum,
        totalPages: 0,
      });
    }

    // Parallel: fetch page + count total matches
    const [users, total] = await Promise.all([
      User.find(mongoQuery)
        .select(SEARCH_FIELDS)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(mongoQuery),
    ]);

    res.json({
      message:    `Found ${total} developer${total !== 1 ? "s" : ""}`,
      data:       users,
      total,
      page:       pageNum,
      totalPages: Math.ceil(total / limitNum),
    });

  } catch (err) {
    console.error("[Search] Error:", err.message);
    res.status(500).json({ message: "Search failed. Please try again." });
  }
});

module.exports = searchRouter;
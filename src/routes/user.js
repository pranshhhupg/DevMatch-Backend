const express = require("express");
const { userAuth } = require("../middlewares/auth");
const ConnectionRequest = require("../models/connectionRequests");
const User = require("../models/user");
const { calculateMatchScore } = require("../utils/feedScore");

const userRouter = express.Router();

// ======================================================
// Fields safe to send to frontend
// ======================================================

const USER_DATA = `
firstName
lastName
age
gender
photoUrl
about
hobbies
skills
lookingFor
goals
availability
experienceLevel
timezone
hackathonInterest
startupInterest
learningGoals
projectIdeas
`;

// ======================================================
// GET USER REQUESTS RECEIVED
// ======================================================

userRouter.get("/user/requests", userAuth, async (req, res) => {
    try {
        const loggedInUser = req.user;

        const findRequests = await ConnectionRequest.find({
            toUserId: loggedInUser._id,
            status: "interested",
        }).populate("fromUserId", USER_DATA);

        res.json({
            message: "Requests fetched successfully for " + loggedInUser.firstName,
            data: findRequests,
        });

    } catch (err) {
        res.status(400).json({
            message: "Error occured " + err.message,
        });
    }
});

// ======================================================
// GET CONNECTIONS
// ======================================================

userRouter.get("/user/connections", userAuth, async (req, res) => {
    try {
        const loggedInUser = req.user;

        const connections = await ConnectionRequest.find({
            $or: [
                {
                    fromUserId: loggedInUser._id,
                    status: "accepted",
                },
                {
                    toUserId: loggedInUser._id,
                    status: "accepted",
                },
            ],
        })
        .populate("fromUserId", USER_DATA)
        .populate("toUserId", USER_DATA);

        const data = connections.map((row) => {
            if (
                row.toUserId._id.toString() ===
                loggedInUser._id.toString()
            ) {
                return row.fromUserId;
            }

            return row.toUserId;
        });

        res.json({
            message: "Showing established connections",
            data,
        });

    } catch (err) {
        res.status(400).json({
            message: "Error occured " + err.message,
        });
    }
});

// ======================================================
// SMART FEED
// ======================================================

userRouter.get("/user/feed", userAuth, async (req, res) => {
    try {
        const loggedInUser = req.user;

        // ============================================
        // Pagination
        // ============================================

        const page = Math.max(
            parseInt(req.query.page) || 1,
            1
        );

        const limit = Math.min(
            parseInt(req.query.limit) || 10,
            50
        );

        const skip = (page - 1) * limit;

        // ============================================
        // Find users already interacted with
        // ============================================

        const interactions = await ConnectionRequest.find({
            $or: [
                { fromUserId: loggedInUser._id },
                { toUserId: loggedInUser._id },
            ],
        })
        .select("fromUserId toUserId")
        .lean();

        // ============================================
        // Exclude interacted users + self
        // ============================================

        const excludedUsers = new Set([
            loggedInUser._id.toString(),
        ]);

        interactions.forEach((interaction) => {
            excludedUsers.add(
                interaction.fromUserId.toString()
            );

            excludedUsers.add(
                interaction.toUserId.toString()
            );
        });

        // ============================================
        // Fetch remaining users
        // ============================================

        const users = await User.find({
            _id: {
                $nin: Array.from(excludedUsers),
            },
        })
        .select(USER_DATA)
        .lean();

        // ============================================
        // If no users found
        // ============================================

        if (!users.length) {
            return res.json({
                message: "No users found",
                data: [],
                total: 0,
                totalPages: 0,
                page,
            });
        }

        // ============================================
        // Convert logged in user to plain object
        // ============================================

        const me = loggedInUser.toObject
            ? loggedInUser.toObject()
            : loggedInUser;

        // ============================================
        // Calculate score for every user
        // ============================================

        const scoredUsers = users.map((user) => {
            const {
                score,
                reasons,
                breakdown,
                rawBreakdown,
            } = calculateMatchScore(me, user);

            return {
                user,
                matchScore: score,
                matchReasons: reasons,
                matchBreakdown: breakdown,
                rawBreakdown,
            };
        });

        // ============================================
        // Sort by highest score
        // ============================================

        scoredUsers.sort(
            (a, b) => b.matchScore - a.matchScore
        );

        // ============================================
        // Pagination AFTER sorting
        // ============================================

        const totalUsers = scoredUsers.length;

        const paginatedUsers = scoredUsers.slice(
            skip,
            skip + limit
        );

        // ============================================
        // Final response
        // ============================================

        res.json({
            message:
                "Showing intelligent feed for " +
                loggedInUser.firstName,
            page,
            limit,
            totalUsers,
            totalPages: Math.ceil(
                totalUsers / limit
            ),
            data: paginatedUsers,
        });

    } catch (err) {
        console.log("Feed Error : ", err.message);

        res.status(500).json({
            message: "Server Error",
        });
    }
});

// ======================================================
// ALL SENT REQUESTS
// ======================================================

userRouter.get("/user/request/all", userAuth, async (req, res) => {
    try {
        const loggedInUser = req.user;

        const user = await ConnectionRequest.find({
            fromUserId: loggedInUser._id,
            status: {
                $in: [
                    "interested",
                    "rejected",
                    "accepted",
                ],
            },
        })
        .populate("toUserId", USER_DATA);

        res.json({
            message:
                "Users fetched successfully for " +
                loggedInUser.firstName,
            data: user,
        });

    } catch (err) {
        console.log("Error occured : ", err.message);

        res.status(400).json({
            message: err.message,
        });
    }
});

module.exports = userRouter;
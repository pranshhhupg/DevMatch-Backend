const express = require("express");
const communityPostRouter = express.Router();
const { userAuth } = require("../middlewares/auth");
const Community = require("../models/community");
const CommunityPost = require("../models/communityPost");

const AUTHOR_FIELDS = "firstName lastName photoUrl skills experienceLevel";

// ── Helper ─────────────────────────────────────────────────────────────────────
const isMember = (community, userId) =>
  community.members.some((m) => m.toString() === userId.toString());

// ── POST /community/:id/posts — Create a post ─────────────────────────────────
communityPostRouter.post(
  "/community/:id/posts",
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
          .json({ message: "Only members can post in a community" });
      }

      const { title, content, tags } = req.body;
      if (!content?.trim()) {
        return res.status(400).json({ message: "Post content is required" });
      }

      const post = new CommunityPost({
        community: req.params.id,
        author: req.user._id,
        title: title?.trim() || "",
        content: content.trim(),
        tags: Array.isArray(tags) ? tags : [],
      });

      await post.save();
      await post.populate("author", AUTHOR_FIELDS);

      return res
        .status(201)
        .json({ message: "Post created successfully", data: post });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  }
);

// ── GET /community/:id/posts — List posts (filter + sort + pagination) ─────────
communityPostRouter.get(
  "/community/:id/posts",
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
          .json({ message: "Only members can view community posts" });
      }

      const { search, tag } = req.query;
      const sortBy = req.query.sortBy || "newest"; // newest | oldest | most_liked
      const page = Math.max(parseInt(req.query.page) || 1, 1);
      const limit = Math.min(parseInt(req.query.limit) || 10, 50);
      const skip = (page - 1) * limit;

      const filter = { community: req.params.id, isActive: true };
      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: "i" } },
          { content: { $regex: search, $options: "i" } },
          { tags: { $regex: search, $options: "i" } },
        ];
      }
      if (tag) filter.tags = { $in: [tag] };

      // Sorting
      let sortOption = { createdAt: -1 }; // default: newest
      if (sortBy === "oldest") sortOption = { createdAt: 1 };
      if (sortBy === "most_liked") {
        // We'll sort by likes array length — use aggregation for accuracy
        const pipeline = [
          { $match: filter },
          { $addFields: { likesCount: { $size: "$likes" } } },
          { $sort: { likesCount: -1, createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: "users",
              localField: "author",
              foreignField: "_id",
              as: "author",
              pipeline: [
                {
                  $project: {
                    firstName: 1,
                    lastName: 1,
                    photoUrl: 1,
                    skills: 1,
                    experienceLevel: 1,
                  },
                },
              ],
            },
          },
          { $unwind: "$author" },
          {
            $lookup: {
              from: "users",
              localField: "comments.author",
              foreignField: "_id",
              as: "commentAuthors",
            },
          },
        ];

        const countPipeline = [{ $match: filter }, { $count: "total" }];
        const [posts, countResult] = await Promise.all([
          CommunityPost.aggregate(pipeline),
          CommunityPost.aggregate(countPipeline),
        ]);
        const total = countResult[0]?.total || 0;
        // Re-populate comment authors manually
        const userId = req.user._id.toString();
        const enriched = posts.map((p) => ({
          ...p,
          isLiked: p.likes.some((id) => id.toString() === userId),
          likesCount: p.likes.length,
        }));

        return res.json({
          success: true,
          data: enriched,
          total,
          page,
          totalPages: Math.ceil(total / limit),
        });
      }

      const [posts, total] = await Promise.all([
        CommunityPost.find(filter)
          .populate("author", AUTHOR_FIELDS)
          .populate("comments.author", AUTHOR_FIELDS)
          .sort(sortOption)
          .skip(skip)
          .limit(limit),
        CommunityPost.countDocuments(filter),
      ]);

      const userId = req.user._id.toString();
      const enriched = posts.map((p) => ({
        ...p.toObject(),
        isLiked: p.likes.some((id) => id.toString() === userId),
        likesCount: p.likes.length,
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
  }
);

// ── GET /community/post/:postId — Single post detail ──────────────────────────
communityPostRouter.get(
  "/community/post/:postId",
  userAuth,
  async (req, res) => {
    try {
      const post = await CommunityPost.findOne({
        _id: req.params.postId,
        isActive: true,
      })
        .populate("author", AUTHOR_FIELDS)
        .populate("comments.author", AUTHOR_FIELDS);

      if (!post) return res.status(404).json({ message: "Post not found" });

      const community = await Community.findById(post.community);
      if (!isMember(community, req.user._id)) {
        return res.status(403).json({ message: "Not a member" });
      }

      const userId = req.user._id.toString();
      const result = {
        ...post.toObject(),
        isLiked: post.likes.some((id) => id.toString() === userId),
        likesCount: post.likes.length,
      };

      return res.json({ success: true, data: result });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  }
);

// ── PUT /community/post/:postId — Edit own post ────────────────────────────────
communityPostRouter.put(
  "/community/post/:postId",
  userAuth,
  async (req, res) => {
    try {
      const post = await CommunityPost.findOne({
        _id: req.params.postId,
        isActive: true,
      });

      if (!post) return res.status(404).json({ message: "Post not found" });

      if (post.author.toString() !== req.user._id.toString()) {
        return res
          .status(403)
          .json({ message: "Not authorized to edit this post" });
      }

      const { title, content, tags } = req.body;
      if (title !== undefined) post.title = title.trim();
      if (content !== undefined) post.content = content.trim();
      if (tags !== undefined) post.tags = Array.isArray(tags) ? tags : [];

      await post.save();
      await post.populate("author", AUTHOR_FIELDS);
      await post.populate("comments.author", AUTHOR_FIELDS);

      return res.json({ message: "Post updated", data: post });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  }
);

// ── DELETE /community/post/:postId — Delete (author or community admin) ────────
communityPostRouter.delete(
  "/community/post/:postId",
  userAuth,
  async (req, res) => {
    try {
      const post = await CommunityPost.findOne({
        _id: req.params.postId,
        isActive: true,
      });

      if (!post) return res.status(404).json({ message: "Post not found" });

      const community = await Community.findById(post.community);
      const isPostAuthor =
        post.author.toString() === req.user._id.toString();
      const isAdminOfCommunity = community?.admins.some(
        (a) => a.toString() === req.user._id.toString()
      );

      if (!isPostAuthor && !isAdminOfCommunity) {
        return res
          .status(403)
          .json({ message: "Not authorized to delete this post" });
      }

      post.isActive = false;
      await post.save();

      return res.json({ message: "Post deleted successfully" });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  }
);

// ── POST /community/post/:postId/like — Toggle like ───────────────────────────
communityPostRouter.post(
  "/community/post/:postId/like",
  userAuth,
  async (req, res) => {
    try {
      const post = await CommunityPost.findOne({
        _id: req.params.postId,
        isActive: true,
      });

      if (!post) return res.status(404).json({ message: "Post not found" });

      const userId = req.user._id;
      const idx = post.likes.findIndex((id) => id.toString() === userId.toString());

      if (idx === -1) {
        post.likes.push(userId); // Like
      } else {
        post.likes.splice(idx, 1); // Unlike
      }

      await post.save();

      return res.json({
        message: idx === -1 ? "Post liked" : "Post unliked",
        likesCount: post.likes.length,
        isLiked: idx === -1,
      });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  }
);

// ── POST /community/post/:postId/comment — Add a comment ──────────────────────
communityPostRouter.post(
  "/community/post/:postId/comment",
  userAuth,
  async (req, res) => {
    try {
      const post = await CommunityPost.findOne({
        _id: req.params.postId,
        isActive: true,
      });

      if (!post) return res.status(404).json({ message: "Post not found" });

      const community = await Community.findById(post.community);
      if (!isMember(community, req.user._id)) {
        return res
          .status(403)
          .json({ message: "Only community members can comment" });
      }

      const { content } = req.body;
      if (!content?.trim()) {
        return res.status(400).json({ message: "Comment content is required" });
      }

      post.comments.push({ author: req.user._id, content: content.trim() });
      await post.save();
      await post.populate("comments.author", AUTHOR_FIELDS);

      const newComment = post.comments[post.comments.length - 1];

      return res
        .status(201)
        .json({ message: "Comment added", data: newComment });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  }
);

// ── DELETE /community/post/:postId/comment/:commentId — Delete comment ─────────
communityPostRouter.delete(
  "/community/post/:postId/comment/:commentId",
  userAuth,
  async (req, res) => {
    try {
      const post = await CommunityPost.findOne({
        _id: req.params.postId,
        isActive: true,
      });

      if (!post) return res.status(404).json({ message: "Post not found" });

      const comment = post.comments.id(req.params.commentId);
      if (!comment) return res.status(404).json({ message: "Comment not found" });

      const community = await Community.findById(post.community);
      const isCommentAuthor =
        comment.author.toString() === req.user._id.toString();
      const isAdminOfCommunity = community?.admins.some(
        (a) => a.toString() === req.user._id.toString()
      );

      if (!isCommentAuthor && !isAdminOfCommunity) {
        return res
          .status(403)
          .json({ message: "Not authorized to delete this comment" });
      }

      comment.deleteOne();
      await post.save();

      return res.json({ message: "Comment deleted" });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  }
);

module.exports = communityPostRouter;
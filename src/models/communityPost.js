const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxLength: 1000,
      trim: true,
    },
  },
  { timestamps: true }
);

const communityPostSchema = new mongoose.Schema(
  {
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      trim: true,
      maxLength: 200,
      default: "",
    },
    content: {
      type: String,
      required: true,
      maxLength: 5000,
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    // Array of userIds who liked
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    comments: [commentSchema],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Text search
communityPostSchema.index({ title: "text", content: "text", tags: "text" });
// For sorting by likes count (post-level aggregation queries)
communityPostSchema.index({ community: 1, createdAt: -1 });
communityPostSchema.index({ community: 1, likes: -1 });

const CommunityPost = mongoose.model("CommunityPost", communityPostSchema);
module.exports = CommunityPost;
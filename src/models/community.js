const mongoose = require("mongoose");

const communitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minLength: 3,
      maxLength: 100,
    },
    description: {
      type: String,
      required: true,
      maxLength: 1000,
    },
    category: {
      type: String,
      required: true,
      enum: [
        "dsa",
        "backend",
        "frontend",
        "ml",
        "devops",
        "mobile",
        "open-source",
        "startup",
        "general",
        "system-design",
        "web3",
        "cybersecurity",
      ],
    },
    coverImage: {
      type: String,
      default: "",
    },
    // Cloudinary public_id for the banner (used for deletion on re-upload)
    coverImagePublicId: {
      type: String,
      default: null,
    },
    // Creator – always an admin
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Admins array (always includes createdBy)
    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // All members (includes admins)
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // "all" = anyone can send in group chat, "admins_only" = only admins can
    messagePermission: {
      type: String,
      enum: ["all", "admins_only"],
      default: "all",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Virtual: total member count
communitySchema.virtual("memberCount").get(function () {
  return this.members.length;
});

communitySchema.set("toJSON", { virtuals: true });
communitySchema.set("toObject", { virtuals: true });

// Text index for searching
communitySchema.index({ name: "text", description: "text" });

const Community = mongoose.model("Community", communitySchema);
module.exports = Community;
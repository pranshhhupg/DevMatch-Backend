const mongoose = require("mongoose");

const communityMessageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxLength: 2000,
    },
  },
  { timestamps: true }
);

const communityChatSchema = new mongoose.Schema({
  community: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Community",
    required: true,
    unique: true,
  },
  messages: [communityMessageSchema],
});


const CommunityChat = mongoose.model("CommunityChat", communityChatSchema);
module.exports = { CommunityChat };
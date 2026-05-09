const express = require('express');
const { Chat } = require('../models/chat');
const { userAuth } = require('../middlewares/auth');

const chatRouter = express.Router();

// IMPORTANT: Static routes must come before parameterized ones.
// /chat/conversations/all must precede /chat/:targetUserId to avoid Express
// treating "conversations" as the targetUserId parameter value.

// GET /chat/conversations/all
chatRouter.get('/chat/conversations/all', userAuth, async (req, res) => {
  const userId = req.userId;
  try {
    const chats = await Chat.find({
      participants: userId,
      'messages.0': { $exists: true },
    })
      .populate('participants', 'firstName lastName photoUrl experienceLevel')
      .sort({ updatedAt: -1 });

    const conversations = chats.map((chat) => {
      const otherUser = chat.participants.find(
        (p) => p._id.toString() !== userId.toString()
      );
      const messages = chat.messages;
      const lastMsg = messages[messages.length - 1];
      const unreadCount = messages.filter(
        (m) =>
          m.senderId.toString() !== userId.toString() &&
          !m.readBy.map((r) => r.toString()).includes(userId.toString())
      ).length;
      return {
        chatId: chat._id,
        user: otherUser,
        lastMessage: lastMsg ? { text: lastMsg.text, createdAt: lastMsg.createdAt } : null,
        unreadCount,
        updatedAt: chat.updatedAt,
      };
    });

    res.json({ conversations });
  } catch (err) {
    res.status(500).json({ message: 'Error: ' + err.message });
  }
});

// POST /chat/mark-read/:targetUserId
chatRouter.post('/chat/mark-read/:targetUserId', userAuth, async (req, res) => {
  const userId = req.userId;
  const { targetUserId } = req.params;
  try {
    await Chat.updateOne(
      { participants: { $all: [userId, targetUserId] } },
      { $addToSet: { 'messages.$[msg].readBy': userId } },
      {
        arrayFilters: [
          { 'msg.senderId': { $ne: userId }, 'msg.readBy': { $ne: userId } },
        ],
      }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Error: ' + err.message });
  }
});

// GET /chat/:targetUserId  (keep LAST — catch-all param route)
chatRouter.get('/chat/:targetUserId', userAuth, async (req, res) => {
  const userId = req.userId;
  const { targetUserId } = req.params;
  try {
    let chat = await Chat.findOne({
      participants: { $all: [userId, targetUserId] },
    }).populate({ path: 'messages.senderId', select: 'firstName lastName photoUrl' });

    if (!chat) {
      chat = new Chat({ participants: [userId, targetUserId], messages: [] });
      await chat.save();
    }
    res.json(chat);
  } catch (err) {
    res.status(500).send('Error: ' + err.message);
  }
});

module.exports = chatRouter;
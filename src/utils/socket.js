const socket = require('socket.io');
const { Chat } = require('../models/chat');
const { CommunityChat } = require('../models/communityChat');
const Community = require('../models/community');

// Map userId → Set of socketIds so we can push notifications to users
// who are online but not in the specific chat room
const onlineUsers = new Map(); // userId (string) → socketId

const initializeSocket = (server) => {
  const io = socket(server, {
    cors: {
      origin: 'http://localhost:5173',
      credentials: true,
    },
  });

  io.on('connection', (socket) => {

    // ── Register user as online ───────────────────────────────────────────────
    // Frontend sends this right after connecting (once they know their userId)
    socket.on('registerUser', ({ userId }) => {
      if (userId) {
        onlineUsers.set(userId, socket.id);
        // Also join a personal room so we can push targeted events
        socket.join('user_' + userId);
      }
    });

    // ── 1-to-1 Chat ──────────────────────────────────────────────────────────

    socket.on('joinChat', ({ firstName, userId, targetUserId }) => {
      const roomId = [userId, targetUserId].sort().join('_');
      console.log(firstName + ' joined private room ' + roomId);
      socket.join(roomId);
    });

    socket.on(
      'sendMessage',
      async ({
        firstName,
        lastName,
        userId,
        photoUrl,
        targetUserId,
        text,
      }) => {
        const roomId = [userId, targetUserId].sort().join('_');

        try {
          let chat = await Chat.findOne({
            participants: { $all: [userId, targetUserId] },
          });

          if (!chat) {
            chat = new Chat({ participants: [userId, targetUserId], messages: [] });
          }

          chat.messages.push({ senderId: userId, text });
          await chat.save();

          const savedMsg = chat.messages[chat.messages.length - 1];

          // ── Emit to the chat room (both users if both are in /chat/:id) ──
          io.to(roomId).emit('messageReceived', {
            firstName,
            lastName,
            photoUrl,
            text,
            createdAt: savedMsg.createdAt,
            senderId: userId,
          });

          // ── Also notify the recipient's personal room (for NavBar badge
          //    and Messenger sidebar) even if they're not in the chat room ──
          io.to('user_' + targetUserId).emit('newMessageNotification', {
            fromUserId: userId,
            fromFirstName: firstName,
            fromLastName: lastName,
            fromPhotoUrl: photoUrl,
            text,
            createdAt: savedMsg.createdAt,
          });
        } catch (err) {
          console.log('1-1 chat error:', err.message);
        }
      }
    );

    // ── Community Group Chat ──────────────────────────────────────────────────

    socket.on('joinCommunityRoom', async ({ communityId, userId }) => {
      try {
        const community = await Community.findOne({
          _id: communityId,
          isActive: true,
        });
        if (!community) return;

        const isMember = community.members.some(
          (m) => m.toString() === userId
        );
        if (!isMember) return;

        socket.join('community_' + communityId);
        console.log('User ' + userId + ' joined community room ' + communityId);
      } catch (err) {
        console.log('joinCommunityRoom error:', err.message);
      }
    });

    socket.on(
      'sendCommunityMessage',
      async ({ communityId, userId, firstName, lastName, photoUrl, text }) => {
        try {
          if (!text?.trim()) return;

          const community = await Community.findOne({
            _id: communityId,
            isActive: true,
          });
          if (!community) return;

          const isMember = community.members.some(
            (m) => m.toString() === userId
          );
          if (!isMember) return;

          const isAdmin = community.admins.some(
            (a) => a.toString() === userId
          );
          if (community.messagePermission === 'admins_only' && !isAdmin) {
            socket.emit('communityMessageError', {
              message: 'Only admins can send messages in this community',
            });
            return;
          }

          let chat = await CommunityChat.findOne({ community: communityId });
          if (!chat) {
            chat = new CommunityChat({ community: communityId, messages: [] });
          }

          chat.messages.push({ senderId: userId, text: text.trim() });
          await chat.save();

          const savedMsg = chat.messages[chat.messages.length - 1];

          io.to('community_' + communityId).emit('communityMessageReceived', {
            _id: savedMsg._id,
            senderId: { _id: userId, firstName, lastName, photoUrl },
            text: text.trim(),
            createdAt: savedMsg.createdAt,
          });
        } catch (err) {
          console.log('sendCommunityMessage error:', err.message);
        }
      }
    );

    socket.on('leaveCommunityRoom', ({ communityId }) => {
      socket.leave('community_' + communityId);
    });

    socket.on('disconnect', () => {
      // Clean up onlineUsers map
      for (const [uid, sid] of onlineUsers.entries()) {
        if (sid === socket.id) {
          onlineUsers.delete(uid);
          break;
        }
      }
    });
  });
};

module.exports = initializeSocket;
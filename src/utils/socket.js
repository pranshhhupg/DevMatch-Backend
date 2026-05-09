const socket = require('socket.io');
const { Chat } = require('../models/chat');
const { CommunityChat } = require('../models/communityChat');
const Community = require('../models/community');

const initializeSocket = (server) => {
    const io = socket(server, {
        cors: {
            origin: "http://localhost:5173",
            credentials: true,
        },
    });

    io.on("connection", (socket) => {

        // ── 1-to-1 Chat ──────────────────────────────────────────────────────

        socket.on("joinChat", ({ firstName, userId, targetUserId }) => {
            const roomId = [userId, targetUserId].sort().join("_");
            console.log(firstName + " joined private room " + roomId);
            socket.join(roomId);
        });

        socket.on("sendMessage", async ({ firstName, lastName, userId, photoUrl, targetUserId, text }) => {
            const roomId = [userId, targetUserId].sort().join("_");

            try {
                let chat = await Chat.findOne({
                    participants: { $all: [userId, targetUserId] }
                });

                if (!chat) {
                    chat = new Chat({ participants: [userId, targetUserId], messages: [] });
                }

                chat.messages.push({ senderId: userId, text });
                await chat.save();
            } catch (err) {
                console.log("1-1 chat error:", err.message);
            }

            io.to(roomId).emit("messageReceived", { firstName, lastName, photoUrl, text });
        });

        // ── Community Group Chat ──────────────────────────────────────────────

        socket.on("joinCommunityRoom", async ({ communityId, userId }) => {
            try {
                const community = await Community.findOne({ _id: communityId, isActive: true });
                if (!community) return;

                const isMember = community.members.some(m => m.toString() === userId);
                if (!isMember) return;

                socket.join("community_" + communityId);
                console.log("User " + userId + " joined community room " + communityId);
            } catch (err) {
                console.log("joinCommunityRoom error:", err.message);
            }
        });

        socket.on("sendCommunityMessage", async ({ communityId, userId, firstName, lastName, photoUrl, text }) => {
            try {
                if (!text?.trim()) return;

                const community = await Community.findOne({ _id: communityId, isActive: true });
                if (!community) return;

                const isMember = community.members.some(m => m.toString() === userId);
                if (!isMember) return;

                const isAdmin = community.admins.some(a => a.toString() === userId);
                if (community.messagePermission === "admins_only" && !isAdmin) {
                    socket.emit("communityMessageError", {
                        message: "Only admins can send messages in this community"
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

                io.to("community_" + communityId).emit("communityMessageReceived", {
                    _id: savedMsg._id,
                    senderId: { _id: userId, firstName, lastName, photoUrl },
                    text: text.trim(),
                    createdAt: savedMsg.createdAt,
                });
            } catch (err) {
                console.log("sendCommunityMessage error:", err.message);
            }
        });

        socket.on("leaveCommunityRoom", ({ communityId }) => {
            socket.leave("community_" + communityId);
        });

        socket.on("disconnect", () => {});
    });
};

module.exports = initializeSocket;
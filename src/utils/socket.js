const socket = require('socket.io');
const {Chat} = require('../models/chat');

const initializeSocket = (server) => {
    const io = socket(server, {
        cors : {
            origin : "http://localhost:3007",
        },
    });
    
    io.on("connection", (socket) => {
        //Handle events
        //name must be same 
        socket.on("joinChat",({firstName, userId, targetUserId})=>{
            const roomId = [userId, targetUserId].sort().join("_");
            console.log(firstName + " joined Room " + roomId);
            socket.join(roomId);
        });

        socket.on("sendMessage", async ({firstName, lastName, userId, photoUrl, targetUserId, text})=> {
            const roomId = [userId, targetUserId].sort().join("_");
            console.log(firstName +" : "+ text);

            try{
                let chat = await Chat.findOne({
                    participants : { $all : [userId, targetUserId]}
                });

                if(!chat){
                    chat = new Chat({
                        participants : [userId, targetUserId],
                        messages : []
                    });
                }
                
                chat.messages.push({
                    senderId : userId,
                    text : text,
                })
                await chat.save();
            }
            catch(err){
                console.log(err.message);
            }
            io.to(roomId).emit("messageReceived", {firstName,lastName,photoUrl, text});
        });

        socket.on("disconnect", ()=>{});
    });   
}

module.exports = initializeSocket;
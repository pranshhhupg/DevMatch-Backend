const socket = require('socket.io');

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

        socket.on("sendMessage", ({firstName, userId, targetUserId, text})=> {
            const roomId = [userId, targetUserId].sort().join("_");
            console.log(firstName +" : "+ text);
            io.to(roomId).emit("messageReceived", {firstName, text});
        });

        socket.on("disconnect", ()=>{});
    });   
}

module.exports = initializeSocket;
const express = require('express');
const { Chat } = require('../models/chat');
const { userAuth } = require('../middlewares/auth');
const chatRouter = express.Router();

chatRouter.get("/chat/:targetUserId", userAuth, async (req,res)=>{
    const userId = req.userId;
    const {targetUserId} = req.params;

    try{
        let chat = await Chat.findOne({
            participants : {$all : [userId,targetUserId]}
        }).populate({
            path : "messages.senderId",
            select : "firstName lastName"
        });

        if(!chat){
            chat = new Chat({
                participants : [userId, targetUserId],
                messages : [],
            });

            await chat.save();
        }

        res.json(chat);
    }
    catch(err){
        res.status(401).send("Error occured : " + err.message);
    }
});

module.exports=chatRouter;
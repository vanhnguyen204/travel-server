const { setData, getData, deleteKey } = require('../redis/index.js')
const { sendPushNotification } = require('../firebase/notification-firebase.js');
const Message = require('../app/models/Message.model.js')
const MessageController = require('../app/controller/Message.controller.js')
const mongoose = require('mongoose');
const users = new Map();
const friendNameSpace = (io) => {
    const namespace = io.of('/friend.io');
    namespace.on('connection', (socket) => {
        socket.emit('connection', 'A user connected to friend listener');


        socket.on("user-online", async (data) => {
            const { userId, friends, isFocusedOnChatScreen = false } = data;
            users.set(userId, { socketId: socket.id, friends, isFocusedOnChatScreen });


            friends.forEach((friendId) => {
                const friend = users.get(friendId);

                if (friend) {
                    socket.to(friend.socketId).emit("friend-online", { friendId: userId });

                    socket.emit("friend-online", { friendId });
                }
            });
        });
        
        socket.on("disconnect", () => {
            let disconnectedUserId = null;
            for (let [userId, data] of users.entries()) {
                if (data.socketId === socket.id) {
                    disconnectedUserId = userId;
                    break;
                }
            }
            if (disconnectedUserId) {
                console.log(`User ${disconnectedUserId} disconnected ///// friend-socket`);
                const { friends } = users.get(disconnectedUserId) || {};
               
                if (friends) {
                    friends.forEach((friendId) => {
                        const friend = users.get(friendId);
                        

                        if (friend) {
                            socket.to(friend.socketId).emit("friend-offline", { friendId: disconnectedUserId });
                        }
                    });
                    users.delete(disconnectedUserId)
                }
            }
        });
    })
}

module.exports = { friendNameSpace }
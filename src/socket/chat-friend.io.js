const { setData, getData, deleteKey } = require('../redis/index.js')
const { sendPushNotification } = require('../firebase/notification-firebase.js')
const users = new Map();
const chatFriendNameSpace = (io) => {
    const namespace = io.of('/friend/chat');
    namespace.on('connection', (socket) => {
        socket.emit('connection', 'A user connected to friend chat');

        
        socket.on("listen-friend-chat", async (data) => {
            const { userId, friends } = data;
            users.set(userId, { socketId: socket.id, friends });
        
            console.log(`User ${userId} registered with friends: ${friends}`);

            friends.forEach((friendId) => {
                const friend = users.get(friendId);
                if (friend) {
                    socket.to(friend.socketId).emit("friend-online", { friendId: userId });
                }
            });
        });

        socket.on("friend-chat-send-message", async (data) => {

            const { id, senderId, receiverId, message, sendTime, fullname } = data
            const minUserId = Math.min(senderId, receiverId);
            const maxUserId = Math.max(receiverId, senderId);
            const chatKey = `messages:${minUserId}:${maxUserId}`;
            const newMessage = {
                id,
                senderId,
                receiverId,
                message,
                sendTime
            }
            const messages = [];
            const getLastMessage = await getData(chatKey);
            if (getLastMessage) {
                messages = messages.concat(getLastMessage);
            }
            messages.push(newMessage)
            await setData(chatKey, messages)
            const receiverSocketId = users.get(receiverId);

            if (receiverSocketId) {
                socket.to(receiverSocketId).emit("friend-chat-receive-message", {
                    senderId,
                    message,
                    sendTime
                });
            } else {
                console.log(`User ${receiverId} is not online`);
            }
            const deviceToken = await getData(receiverId);
            if (deviceToken) {
                
                sendPushNotification(deviceToken, message, fullname)
            }
        });

        socket.on('friend-enable-typing', (data) => {
            const { friendId } = data
            const getSocketFriend = users.get(friendId);
            if (getSocketFriend) {

                socket.to(getSocketFriend.socketId).emit('friend-typing', { isTyping: true })
            } else {
                console.log('Friend is offline');
            }
        })
        socket.on('friend-disable-typing', (data) => {
            const { friendId } = data
            const getSocketFriend = users.get(friendId);
            if (getSocketFriend) {

                socket.to(getSocketFriend.socketId).emit('friend-typing', { isTyping: false })
            } else {
                console.log('Friend is offline');
            }

        })

        socket.on("disconnect", () => {
            let disconnectedUserId = null;

            // Xóa user khỏi danh sách và tìm userId dựa trên socketId
            for (let [userId, data] of users.entries()) {
                if (data.socketId === socket.id) {
                    disconnectedUserId = userId;
                    users.delete(userId);
                    break;
                }
            }

            // Thông báo cho bạn bè rằng người này đã offline
            if (disconnectedUserId) {
                console.log(`User ${disconnectedUserId} disconnected`);
                const { friends } = users.get(disconnectedUserId) || {};
                if (friends) {
                    friends.forEach((friendId) => {
                        const friend = users.get(friendId);
                        if (friend) {
                            socket.to(friend.socketId).emit("friend-offline", { friendId: disconnectedUserId });
                        }
                    });
                }
            }
        });


    })


}

module.exports = { chatFriendNameSpace }
const { setData, getData, deleteKey } = require('../redis/index.js');
const { sendPushNotification, sendPushNotificationToTopic } = require('../firebase/notification-firebase.js');
const MessageController = require('../app/controller/Message.controller.js');
const users = new Map();
const { friendChat, friendConversation } = require('./socket-key.io.js')
const chatFriendNameSpace = (io) => {
    const namespace = io.of('/friend.io/chat');
    const foregroundNotifyNameSpace = io.of('/notifications/foreground');
    namespace.on('connection', (socket) => {
        console.log('User connected to /friend.io/chat');
        socket.emit('connection', 'Connected to friend chat namespace');

        // User rời khỏi chat
        socket.on("user-leave-chat", (userId) => {
            try {
                const user = users.get(userId);
                if (user) {
                    users.set(userId, { ...user, isFocusedOnChatScreen: false });
                }
            } catch (error) {
                console.error("Error handling user leaving chat:", error);
            }
        });

        // User vào phòng chat
        socket.on("user-enter-chat", async (data) => {
            const { senderId, conversationId, receiverId } = data;

            try {
                console.log(`User ${senderId} joined conversation ${conversationId}`);
                socket.join(conversationId);
                users.set(senderId, { isFocusedOnChatScreen: true, socketId: socket.id });
            } catch (error) {
                console.error("Error handling user entering chat:", error);
            }
        });

        // Gửi tin nhắn
        socket.on("friend-chat-send-message", async (data) => {
            const { senderId, receiverId, message, messageType, conversationId, senderName, someone } = data;

            try {
                // Lưu tin nhắn vào cơ sở dữ liệu
                const res = await MessageController.createMessage({
                    senderId,
                    receiverId,
                    message,
                    messageType,
                });

                const checkIsFocused = users.get(receiverId);
                console.log('checkIsFocused: ', checkIsFocused)
                const topic = '/topics/friend-' + conversationId;
                if (!checkIsFocused || !checkIsFocused?.isFocusedOnChatScreen) {
                   
                    foregroundNotifyNameSpace.to(topic).emit('notify-foreground-chat-friend', {
                        senderName,
                        message,
                        conversationId,
                        someone,
                        senderId
                    })
                }
                namespace.to(conversationId).emit("friend-chat-receive-message", res);

                sendPushNotificationToTopic(topic, message, senderName + ' đã gửi cho bạn một tin nhắn', {
                    conversationId
                })
            } catch (error) {
                console.error("Error sending message:", error);
            }
        });

        // Bắt đầu gõ
        socket.on('friend-start-typing', (data) => {
            const { friendId, conversationId } = data;

            try {
                // Emit trạng thái đang gõ đến phòng chat
                namespace.to(conversationId).emit('friend-typing-status', {
                    friendId,
                    isTyping: true,
                });
            } catch (error) {
                console.error("Error handling start typing:", error);
            }
        });

        // Ngừng gõ
        socket.on('friend-end-typing', (data) => {
            const { friendId, conversationId } = data;

            try {
                // Emit trạng thái ngừng gõ đến phòng chat
                namespace.to(conversationId).emit('friend-typing-status', {
                    friendId,
                    isTyping: false,
                });
            } catch (error) {
                console.error("Error handling end typing:", error);
            }
        });

        // Xử lý khi socket ngắt kết nối
        socket.on("disconnect", () => {
            const userId = Array.from(users.keys()).find((id) => users.get(id)?.socketId === socket.id);
            if (userId) {
                users.set(userId, { ...users.get(userId), isFocusedOnChatScreen: false });
            }
            console.log("User disconnected from /friend.io/chat");
        });
    });
};

module.exports = { chatFriendNameSpace };

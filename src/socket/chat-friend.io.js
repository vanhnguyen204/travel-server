const { setData, getData, deleteKey } = require('../redis/index.js');
const { sendPushNotification, sendPushNotificationToTopic } = require('../firebase/notification-firebase.js');
const MessageController = require('../app/controller/Message.controller.js');
const users = new Map();
const { friendChat, friendConversation } = require('./socket-key.io.js');
const { pool } = require('../db/index.js');
const MessageModel = require('../app/models/Message.model.js');
const ConversationModel = require('../app/models/Conversation.model.js');
const queryFriendId = `
SELECT id
FROM friend_ship
WHERE (user_send_id = ? AND user_received_id = ?)
   OR (user_send_id = ? AND user_received_id = ?);
`
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
            const { senderId, receiverId, yourAvatar } = data;
            const { fetchImageAsBase64 } = await import('../utils/file.mjs');

            try {
                const [getFriendId] = await pool.promise().query(queryFriendId, [senderId, receiverId, receiverId, senderId]);
                const { id } = getFriendId[0];
                let avatarBase64 = yourAvatar ? await fetchImageAsBase64(yourAvatar) : ''

                if (id) {
                    const topic = '/topics/friend-' + id
                    socket.join(topic);
                    users.set(senderId, { isFocusedOnChatScreen: true, socketId: socket.id, friendId: id, avatar: avatarBase64 });
                }
            } catch (error) {
                console.error("Error handling user entering chat:", error);
            }
        });

        // Gửi tin nhắn
        socket.on("friend-chat-send-message", async (data) => {
            const { senderId, receiverId, message, messageType, senderName, someone } = data;

            try {


                const checkIsFocused = users.get(receiverId);

                const getCurrentMapUser = users.get(senderId);
                const topic = '/topics/friend-' + getCurrentMapUser.friendId;

                const res = await MessageController.createMessage({
                    senderId,
                    receiverId,
                    message,
                    messageType,
                });
                namespace.to(topic).emit("friend-chat-receive-message", {
                    ...res.toObject(),
                    avatar_url: `data:image/jpeg;base64,${getCurrentMapUser.avatar}`,

                });
                if (!checkIsFocused || !checkIsFocused?.isFocusedOnChatScreen) {

                    foregroundNotifyNameSpace.to(topic).emit('notify-foreground-chat-friend', {
                        senderName,
                        message,
                        someone,
                        senderId,
                        avatarBase64: getCurrentMapUser.avatar,
                        friendId: senderId
                    })
                }
                await sendPushNotificationToTopic(topic, message, senderName,)



            } catch (error) {
                console.error("Error sending message:", error);
            }
        });

        socket.on('friend-delete-message', async (data) => {
            try {
                const { _id, userId } = data;

                // Lấy thông tin người dùng hiện tại
                const getCurrentMapUser = users.get(userId);
                if (!getCurrentMapUser) {
                    console.error('User not found for senderId:', senderId);
                    return;
                }

                const topic = `/topics/friend-${getCurrentMapUser.friendId}`;

                // Cập nhật tin nhắn
                const updatedMessage = await MessageModel.findOneAndUpdate(
                    { _id: _id },
                    { message: 'Đã bị gỡ', messageType: 'text' },
                    { new: true } // Trả về tài liệu đã cập nhật
                );
                console.log('updatedMessage: ',)
                if (!updatedMessage) {
                    console.error('Message not found with id:', _id);
                    return;
                }
                await ConversationModel.findOneAndUpdate({
                    _id: updatedMessage.referenceId.toString()
                }, {
                    lastMessage: 'Đã bị gỡ',
                    lastMessageType: 'text',
                    lastMessageAt: new Date(),
                })
                // Emit sự kiện với thông tin mới
                namespace.to(topic).emit('friend-delete-message', {
                    _id

                });

            } catch (error) {
                console.error('Error handling friend-delete-message:', error);
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

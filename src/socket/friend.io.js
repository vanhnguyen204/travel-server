const { pool } = require('../db/index.js');
const users = new Map();
const socketToUser = new Map(); // For efficient disconnect handling

// Optimized query (consider indexing `user_send_id` and `user_received_id` as well)
const queryFriend = `
SELECT user_received_id AS friendId FROM friend_ship WHERE user_send_id = ?
UNION
SELECT user_send_id AS friendId FROM friend_ship WHERE user_received_id = ?`;

const friendNameSpace = (io) => {
    const namespace = io.of('/friend.io');
    const foregroundNotifyNameSpace = io.of('/notifications/foreground');

    namespace.on('connection', (socket) => {
        console.log('A user connected to /friend.io');
        socket.emit('connection', 'A user connected to /friend.io');

        socket.on("friend-online", async (data) => {
            try {
                const { userId, isFocusedOnChatScreen = false } = data;

                // Truy vấn danh sách bạn bè
                const [friends] = await pool.promise().query(queryFriend, [userId, userId]);

                // Lưu user và bạn bè
                const friendIds = friends.map((row) => row.friendId);
                users.set(userId, { socketId: socket.id, friends: friendIds, isFocusedOnChatScreen });
                socketToUser.set(socket.id, userId); // Add for optimized disconnect

                friendIds.forEach((friendId) => {
                    const friend = users.get(friendId);
                    if (friend) {
                        socket.to(friend.socketId).emit("friend-online", { friendId: userId });

                        socket.emit("friend-online", { friendId });
                    }
                });
            } catch (err) {
                console.error("Error fetching friends: ", err);
                socket.emit("error", { type: "friend_fetch_error", message: err.message }); // More specific error
            }
        });

        socket.on("disconnect", () => {
            const disconnectedUserId = socketToUser.get(socket.id); // Optimized lookup

            if (disconnectedUserId) {
                // Gửi thông báo offline tới bạn bè
                const { friends } = users.get(disconnectedUserId) || {};
                if (friends) {
                    friends.forEach((friendId) => {
                        const friend = users.get(friendId);
                        if (friend) {
                            namespace.to(friend.socketId).emit("friend-offline", { friendId: disconnectedUserId });
                        }
                    });
                }

                // Xóa user khỏi danh sách
                users.delete(disconnectedUserId);
                socketToUser.delete(socket.id);
            }
        });
    });
};

module.exports = { friendNameSpace };
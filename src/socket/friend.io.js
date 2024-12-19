// require = require('esm')(module);
const { pool } = require('../db/index.js');
const { sendPushNotification } = require('../firebase/notification-firebase.js');

const Notification = require('../app/models/Notification.model.js')
const users = new Map();
const socketToUser = new Map(); // For efficient disconnect handling

// Optimized query (consider indexing `user_send_id` and `user_received_id` as well)
const queryFriend = `
SELECT user_received_id AS friendId FROM friend_ship WHERE user_send_id = ?
UNION
SELECT user_send_id AS friendId FROM friend_ship WHERE user_received_id = ?`;
const queryFriendId = `
SELECT id
FROM friend_ship
WHERE (user_send_id = ? AND user_received_id = ?)
   OR (user_send_id = ? AND user_received_id = ?);
`
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

        socket.on('friend-request-make-friend', async (data) => {
            const { fetchImageAsBase64 } = await import('../utils/file.mjs');
            const { yourId, friendId, yourName, yourAvatar } = data;

            const notify = {
                title: yourName,
                message: yourName + ' gửi cho bạn lời mời kết bạn.',
                action: {
                    type: 'navigate',
                    payload: {
                        screen: '',
                        params: {
                            referenceId: yourId
                        }
                    }
                },
                recipients: [
                    {
                        userId: friendId,
                        isRead: false
                    }
                ],
                type: 'friend'
            }
            const newNotification = new Notification(notify);
            await newNotification.save();
            const rooms = foregroundNotifyNameSpace.adapter.rooms;
            const getMemberSocketId = rooms.get(friendId)
            if (getMemberSocketId) {
                const imageBase64 = yourAvatar ? await fetchImageAsBase64(yourAvatar) : ''
                foregroundNotifyNameSpace.to(friendId).emit('friend-request-make-friend', {
                    title: 'Thông báo',
                    message: yourName + ' đã gửi cho bạn lời mời kết bạn.',
                    type: 'friend',
                    imageBase64: imageBase64
                })
            } else {
                const [friendDeviceToken] = await pool.promise().query('select device_token from user where id = ?', [friendId]);
                if (friendDeviceToken.length !== 0) {
                    const { device_token } = friendDeviceToken[0]
                    if (device_token) {
                        await sendPushNotification(device_token, yourName + ' đã gửi cho bạn lời mới kết bạn.', 'Thông báo', {
                            type: 'make-friend'
                        })
                    }
                }
            }
        })

        socket.on('friend-accept-make-friend', async (data) => {
            try {
                // Lấy dữ liệu từ payload
                const { fetchImageAsBase64 } = await import('../utils/file.mjs');
                const { yourAvatar, friendId, yourId, yourName } = data;

                // Kiểm tra dữ liệu hợp lệ
                if (!yourId || !friendId || !yourName) {
                    return console.error('Missing required fields');
                }

                // Truy vấn friendId trong MySQL
                const [friendIdMySQL] = await pool.promise().query(queryFriendId, [yourId, friendId, friendId, yourId]);

                // Kiểm tra kết quả truy vấn
                if (friendIdMySQL.length === 0) {
                    return console.log('Friend relationship not found');
                }

                const topic = '/topics/friend-new' + friendIdMySQL[0].id;

                // Truy xuất phòng và socket ID của bạn và bạn bè
                const rooms = foregroundNotifyNameSpace.adapter.rooms;
                const friendSocketId = rooms.get(friendId);
                const yourSocketId = rooms.get(yourId);



                // Tạo phòng mới với bạn và bạn của bạn
                const newSet = new Set();
                newSet.add(yourSocketId.values().next().value);
                if (friendSocketId) {

                    newSet.add(friendSocketId.values().next().value);
                }

                foregroundNotifyNameSpace.adapter.rooms.set(topic, newSet);

                // Tạo thông báo
                const notify = {
                    title: yourName,
                    message: `${yourName} đã chấp nhận yêu cầu kết bạn.`,
                    action: {
                        type: 'navigate',
                        payload: {
                            screen: '', // Thêm thông tin màn hình nếu cần
                            params: {
                                referenceId: yourId
                            }
                        }
                    },
                    recipients: [
                        {
                            userId: friendId,
                            isRead: false
                        }
                    ],
                    type: 'friend'
                };

                const newNotification = new Notification(notify);
                await newNotification.save();

                if (friendSocketId) {
                    const imageBase64 = yourAvatar ? await fetchImageAsBase64(yourAvatar) : '';
                    foregroundNotifyNameSpace.to(friendId).emit('friend-accept-make-friend', {
                        title: 'Thông báo',
                        message: `${yourName} đã chấp nhận yêu cầu kết bạn.`,
                        type: 'friend',
                        imageBase64: imageBase64
                    });
                } else {
                    // Nếu bạn bè không trực tuyến, gửi thông báo đẩy
                    const [friendDeviceToken] = await pool.promise().query('SELECT device_token FROM user WHERE id = ?', [friendId]);

                    if (friendDeviceToken.length > 0) {
                        const { device_token } = friendDeviceToken[0];

                        if (device_token) {
                            await sendPushNotification(device_token, `${yourName} đã gửi cho bạn lời mời kết bạn.`, 'Thông báo', {
                                type: 'make-friend'
                            });
                        }
                    }
                }
            } catch (error) {
                console.error('Error processing friend-accept-make-friend event:', error);
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
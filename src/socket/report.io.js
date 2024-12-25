const { log } = require("console");
const { pool } = require("../db");
const { admin } = require("../firebase");
const { sendPushNotification } = require("../firebase/notification-firebase");
const Notification = require("../app/models/Notification.model");

const admins = new Map();

const reportNameSpace = (io) => {

    const namespace = io.of('/report');
    const foregroundNamespace = io.of('/notifications/foreground');
    namespace.on('connection', (socket) => {
        console.log('A user connect to /report')
        socket.emit('connection', 'A user connected to group chat');

        socket.on('report-initial-data', (data) => {
            const { id } = data;
            admins.set(id, { socketId: socket.id });
        });

        socket.on('submit-report', async (data) => {
            const { title, message, ownerPostId, postInfo } = data;

            const [deviceToken] = await pool.promise().query('select device_token, current_device from user where id = ?', [ownerPostId])
            console.log('Data: ', data)
            // console.log('Device token: ', deviceToken)

            const { device_token, current_device } = deviceToken[0];


            const notify = {
                title: title,
                message: message,
                action: {
                    type: 'navigate',
                    payload: {
                        screen: '',
                        params: {
                            mediaUrl: postInfo.mediaUrl,
                            content: postInfo.mediaUrl,
                        }
                    }
                },
                recipients: [
                    {
                        userId: ownerPostId,
                        isRead: false
                    }
                ],
                type: 'post'
            }
            const newNotification = new Notification(notify);
            await newNotification.save();
            if (current_device === 'ANDROID' && device_token) {
                await sendPushNotification(device_token, 'Một bài viết đã bị tố cáo do vi phạm chính sách của ứng dụng', 'Thông báo từ admin')
            }
            foregroundNamespace.to(ownerPostId).emit('report-post', {
                title,
                message,
            })
        });

        socket.on('connect_error', (err) => {
            console.log('Connection Error: ', err.message);
        });
    });
};

module.exports = reportNameSpace

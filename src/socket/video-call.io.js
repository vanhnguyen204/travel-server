const AgoraToken = require('agora-token');
const AGORA_APP_ID = '2577ea861cca41bab8a91d1a9250136c';
const AGORA_APP_CERTIFICATE = 'ef3b726f23b6405fbf467640b35e83ef'
const { RtcTokenBuilder, RtcRole } = require('agora-token');
const { pool } = require('../db');
const queryFriendId = `
SELECT id
FROM friend_ship
WHERE (user_send_id = ? AND user_received_id = ?)
   OR (user_send_id = ? AND user_received_id = ?);
`
const videoCallNameSpace = (io) => {
    const namespace = io.of('/video-call');
    const foregroundNotifyNameSpace = io.of('/notifications/foreground');

    namespace.on('connection', (socket) => {
        socket.emit('connection', 'A user connected to video call.');

        socket.on('video-call-starting', async (data) => {
            const { fetchImageAsBase64 } = await import('../utils/file.mjs');
            const { senderId, receiverId, avatar, userName, uuidVideoCallChannel } = data;
            const resAvatar = avatar ? await fetchImageAsBase64(avatar) : ''
            const [friendIdMySQL] = await pool.promise().query(queryFriendId, [senderId, receiverId, receiverId, senderId]);
            const  id  = friendIdMySQL[0]?.id
            const topic = '/topics/friend-' + id;
            // Generate Agora tokens for both sender and receiver
            // console.log('Topic: ', topic)
            const senderToken = generateAgoraToken({
                channelName: uuidVideoCallChannel,
                expirationTime: 300, // 5 minutes
                role: RtcRole.PUBLISHER,
                userId: senderId // Use senderId as UID
            });

            const receiverToken = generateAgoraToken({
                channelName: uuidVideoCallChannel,
                expirationTime: 300, // 5 minutes
                role: RtcRole.PUBLISHER,
                userId: receiverId // Use receiverId as UID
            });

            // console.log('Generated Agora tokens: ', JSON.stringify({
            //     senderToken,
            //     receiverToken
            // }));

            // Define topic for push notification 


            // Send token to receiver via foregroundNotifyNameSpace
            foregroundNotifyNameSpace.to(topic).emit('video-call-token', {
                token: receiverToken, // Token for the receiver
                avatar: resAvatar,
                title: 'Cuộc gọi video',
                message: `${userName} đang gọi cho bạn...`,
                channelName: uuidVideoCallChannel,
                host: false,
                senderId
            });

            // Send token to the sender
            socket.emit('video-call-token', {
                token: senderToken, // Token for the sender
                avatar: resAvatar,
                title: 'Cuộc gọi video',
                message: 'Bạn đã bắt đầu cuộc gọi video.',
                channelName: uuidVideoCallChannel,
                host: true,
                senderId
            });
        });


        socket.on('video-call-reject', async (data) => {
            console.log('Reject video cal')
            // const rooms = foregroundNotifyNameSpace.adapter.rooms;
            // console.log('ROOMS: ', rooms)
            const { yourId, yourName, avatar, senderId } = data;
            const { fetchImageAsBase64 } = await import('../utils/file.mjs');
            const resAvatar = avatar ? await fetchImageAsBase64(avatar) : ''
            const [friendIdMySQL] = await pool.promise().query(queryFriendId, [senderId, yourId, yourId, senderId]);
            const { id } = friendIdMySQL[0];
            const topic = '/topics/friend-' + id;
            console.log('Topic: ', topic)
            foregroundNotifyNameSpace.to(topic).emit('video-call-reject', {
                senderId: senderId,
                senderName: yourName,
                avatarBase64: resAvatar,
                title: 'Thông báo',
                message: yourName + ' từ chối cuộc gọi của bạn.'
            });
        })
        socket.on('video-call-handle-end', (data) => {

        })
        socket.on('connect_error', (err) => {
            console.log('Connection Error: ', err.message);
        });
    });
};
const generateAgoraToken = ({ channelName, userId, role, expirationTime }) => {
    const token = RtcTokenBuilder.buildTokenWithUid(AGORA_APP_ID, AGORA_APP_CERTIFICATE, channelName, userId, role, expirationTime);
    return token;
}
module.exports = { videoCallNameSpace, generateAgoraToken };

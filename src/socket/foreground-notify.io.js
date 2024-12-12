const { getData, setData: setDataRedis, deleteKey, redisClient } = require('../redis/index.js')
const { sendPushNotification, subscribeUserToMultipleTopics } = require('../firebase/notification-firebase.js')
const { pool } = require('../db/index.js');
const Conversation = require('../app/models/Conversation.model.js');
const { groupChat, groupMember, groupTravelPlanJoin, groupTravelPlanCreate, friendConversation } = require('./socket-key.io.js')
const queryUserJoinedGroup =
    `
    SELECT 
        m.group_id 
    FROM 
        member m 
    JOIN 
        \`m_group\` g
    ON 
        m.group_id = g.id 
    WHERE 
        m.user_id = ? 
        AND g.user_id != ?;
`;
const foregroundNotifyNameSpace = (io) => {
    const namespace = io.of('/notifications/foreground');

    namespace.on('connection', (socket) => {
        socket.emit('connection', 'A user connected to foreground notification');

        socket.on('foreground-initial-data', async (data) => {
            const { userId, deviceToken, currentDevice } = data;
            const key = `user:${userId}:deviceTokens`;
            const savedData = {
                deviceToken,
                socketId: socket.id,
                currentDevice
            }
            await setDataRedis(key, savedData);
            const [rows] = await pool.promise().query(
                queryUserJoinedGroup,
                [userId, userId]
            );
             const conversations = await Conversation.find({
                participants: { $elemMatch: { userId: userId } },
            });
            const conversationIds = conversations.map(item => item._id.toHexString());
            conversationIds.forEach(conversationId => {
                socket.join(friendConversation+conversationId)
            })
            rows.forEach(group => {
                const listenGroupChat = groupChat + group.group_id
                const listenGroupTravelPlanCreate = groupTravelPlanCreate + group.group_id
                const listenGroupTravelPlanJoin = groupTravelPlanJoin + group.group_id
                const listenGroupMember = groupMember + group.group_id

                socket.join(listenGroupChat)
                socket.join(listenGroupTravelPlanCreate)
                socket.join(listenGroupTravelPlanJoin)
                socket.join(listenGroupMember)
            })
            console.log('---- SETUP FOREGROUND NOTIFICATION FOR ID: ', userId)
        })


        socket.on('connect_error', (err) => {
            console.log('Connection Error: ', err.message);
        });
        socket.on('disconnect', async () => {
            console.log(`User disconnected from foreground notification: ${socket.id}`);
        });


    });


}

module.exports = { foregroundNotifyNameSpace };

const { pool } = require('../db');
const { sendPushNotificationToTopic, sendPushNotification } = require('../firebase/notification-firebase');
const RabbitMQScheduler = require('./index');  // Đường dẫn tới class RabbitMQScheduler
const schedule = require('node-schedule');


const getGroupIdsFromDatabase = async () => {
    const queryGroup = 'select id  from m_group';
    const [groupIds] = await pool.promise().query(queryGroup);
    if (groupIds.length === 0) {
        return [];
    }
    return groupIds.map(it => {
        return '/topics/group-'+it.id
    })
};

const updateGroupIdsAndListen = async () => {
    

    const groupIds = await getGroupIdsFromDatabase();


    for (const groupChannelTopic of groupIds) {
        await RabbitMQScheduler.startListeningEventFromQueue(groupChannelTopic, async (message) => {
            console.log(`Received event from ${groupChannelTopic}:`, message);
            
            console.log('Type of', typeof message)
            
            // const info = JSON.parse(message.toString());
            console.log('Info: ', message)
            if (message) {
                await sendPushNotificationToTopic(groupChannelTopic, message.message, message.title, {
                    groupId: message.payload.groupId + ''
                })
                
            }
            RabbitMQScheduler.ackByChannelName(groupChannelTopic, message)
            console.log(`Message acknowledged for ${groupChannelTopic}`);
        });
    }

    console.log('Started listening to all group events.');
    // console.log('RabbitMQScheduler.channels: ', RabbitMQScheduler.channels)
};

//run at 00:00 everyday
schedule.scheduleJob('0 0 * * *', async () => {
    console.log('Updating group IDs and starting to listen...');
    await updateGroupIdsAndListen();
});

module.exports = { updateGroupIdsAndListen }

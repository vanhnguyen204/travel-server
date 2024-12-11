const { getData, setData, deleteKey, } = require('../redis/index.js')
const { sendPushNotification, sendPushNotificationToMultipleDevices, subscribeToTopic, sendPushNotificationToTopic } = require('../firebase/notification-firebase.js')

const deviceToken = 'e3ptXpseREmjf2VCmle3FC:APA91bGI7WFUWh4doJoI0VqTODj2G5cU_Ov-UVhVwZDzgherBPH2Rqs1qcRZoyJCI9XhJHCz6bTZB1mdvGfvv7Av1-M9z7U7UaYYiw3Ivwm7XoczC45_Gao';
const rooms = {};

const chatNamespace = (io) => {
  const namespace = io.of('/group/chat');

  namespace.on('connection', (socket) => {
    socket.emit('connection', 'A user connected to group chat');
    console.log('A user connected to /group/chat');

    socket.on('joined-chat-group', async (data) => {
      const { userId, groupId, fullname, avatar } = data;
      const getDeviceToken = await getData(`user:${userId}:deviceTokens`);
      
      if (getDeviceToken) {
        const {deviceToken, currentDevice } = getDeviceToken;
      }
      if (!rooms[groupId]) {
        rooms[groupId] = [];
      }
      if (!rooms[groupId].some(user => user.userId === userId)) {
        rooms[groupId].push({ userId, fullname, avatar });
      }
      socket.join(groupId);
      socket.groupId = groupId;

      console.log(`User ${userId} joined room ${groupId}`);
      const res = await getData(groupId + '');

      namespace.to(groupId).emit('received-data-group-message', res || []);
      namespace.to(groupId).emit('user-joined-group-success', rooms[groupId]);
    });

    socket.on('disconnected-group', async (data) => {
      const { groupId, userId } = data;

      if (rooms[groupId]) {
        rooms[groupId] = rooms[groupId].filter(user => user.userId !== userId);
        namespace.to(groupId).emit('user-joined-group-success', rooms[groupId]);
      }

      console.log(`User ${userId} disconnected from room ${groupId}`);
    });

    socket.on('send-message-chat-group', async (data) => {
      try {
        const { groupId, content, groupName, userSendName, ...rest } = data;

        console.log('New chat: ', data);
        let messages = [];
        const getOldData = await getData(groupId + '');
        if (getOldData) {
          messages = messages.concat(getOldData);
        }

        messages.push({ ...rest, groupId, content });
        await setData(groupId + '', messages);

        await sendPushNotificationToTopic('/topics/group-' + groupId, userSendName + ': ' + content, groupName, {
          groupId: groupId+'',
          groupName: groupName
        })
        socket.to(groupId).emit('receive-message-chat-group', data);

      } catch (error) {
        console.error('Error handling send-message-chat-group:', error);
      }
    });

    socket.on('delete-group-single-message', async (data) => {
      const { groupId, messageId } = data;

      const messages = await getData(groupId + '');
      const filterMessages = messages.map(item => {
        if (item.id === messageId) {
          return {
            ...item,
            content: 'Đã bị gỡ'
          }

        }
        return item
      });
      await setData(groupId + '', filterMessages);
      socket.to(groupId).emit('delete-group-single-message', {
        messageId,
        newContent: 'Đã bị gỡ'
      });
      console.log('Delete message success!');

    })

    socket.on('disconnect', () => {
      if (socket.groupId) {
        const groupId = socket.groupId;
        const userId = socket.userId;

        if (rooms[groupId]) {
          rooms[groupId] = rooms[groupId].filter(user => user.userId !== userId);
          namespace.to(groupId).emit('user-joined-group-success', rooms[groupId]);
        }
        console.log(`User ${userId} disconnected from room ${groupId}`);
      }
    });

    socket.on('connect_error', (err) => {
      console.log('Connection Error: ', err.message);
    });
  });
}

module.exports = chatNamespace;

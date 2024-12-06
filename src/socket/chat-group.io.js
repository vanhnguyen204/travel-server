const {getData, setData} = require('../redis/index.js')


const deviceToken = 'e3ptXpseREmjf2VCmle3FC:APA91bGI7WFUWh4doJoI0VqTODj2G5cU_Ov-UVhVwZDzgherBPH2Rqs1qcRZoyJCI9XhJHCz6bTZB1mdvGfvv7Av1-M9z7U7UaYYiw3Ivwm7XoczC45_Gao';
const rooms = {};

const chatNamespace = (io) => {
  const namespace = io.of('/group/chat');
  
  namespace.on('connection', (socket) => {
    socket.emit('connection', 'A user connected');
    console.log('A user connected to /group/chat');

    socket.on('joined-chat-group', async (data) => {
      const { userId, groupId, fullname, avatar } = data;

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
      namespace.to(groupId).emit('received-data-group-message', res);
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
      const { groupId, content } = data;
      console.log('New chat: ', data);
      let messages = [];

      const getOldData = await getData(groupId + '');
      if (getOldData) {
        messages = messages.concat(getOldData);
      }
      messages.push(data);
      await setData(groupId + '', messages);
      sendPushNotification(deviceToken, content + '');
      socket.to(groupId).emit('receive-message-chat-group', data);
    });

    socket.on('connect-single-chat', (data) => {
      const { senderId, receiverId } = data;

      const room = `${senderId}-${receiverId}`;
      socket.join(room);
      console.log(`User ${senderId} and ${receiverId} joined room: ${room}`);
    });

    socket.on('chat-single-message', (data) => {
      const { room, message, senderId } = data;
      namespace.to(room).emit('chat-single-message', { senderId, message });  // Send message to room
    });

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

module.exports =  chatNamespace;

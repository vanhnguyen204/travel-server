const { getData, setData, deleteKey, } = require('../redis/index.js')
const { sendPushNotification, sendPushNotificationToMultipleDevices, subscribeToTopic, sendPushNotificationToTopic } = require('../firebase/notification-firebase.js')
const Message = require('../app/models/Message.model.js')

const rooms = {};
const { pool } = require('../db/index.js')
const queryMemberInGroup = 'select user_id from member where group_id = ?';

const chatNamespace = (io) => {
  const namespace = io.of('/group/chat');

  const foregroundNamespace = io.of('/notifications/foreground');
  namespace.on('connection', (socket) => {
    socket.emit('connection', 'A user connected to group chat');
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


      console.log(`User ${userId} joined chat room ${groupId}`);

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
        const { groupId, content, groupName, userSendName, senderId, messageType, fileUrl, senderAvatarUrl } = data;

        // console.log('New group chat message: ', data);
        const newMessage = new Message({
          referenceId: groupId,
          senderId,
          message: content,
          messageType,
          fileUrl,
        });
        const savedMessage = await newMessage.save();
        const responseMessage = {
          ...savedMessage.toObject(),
          avatar_url: senderAvatarUrl
        }
        // console.log('Avatar sender: ', responseMessage)
        namespace.to(groupId).emit('receive-message-chat-group', responseMessage);
        const topic = '/topics/group-' + groupId
        const [rows] = await pool.promise().query(
          queryMemberInGroup,
          [groupId]
        );
        // console.log('Current online user: ', rooms[groupId])
        const onlineUsers  = rooms[groupId];
        const onlineUserIds = new Set(onlineUsers.map((user) => user.userId));
        const filteredUsersNotInRoom = rows.filter(
          (user) => !onlineUserIds.has(user.user_id)
        );

        console.log(filteredUsersNotInRoom);
``
        filteredUsersNotInRoom.forEach((user) => {
          const { user_id } = user;
          // console.log('Send notify to: ', user_id)
          foregroundNamespace.to(user_id).emit('group-chat-notify-foreground', {
            title: groupName,
            message: userSendName + ': ' + content,
            senderId,
            payload: {
              groupId,

            }
          })
        });


        await sendPushNotificationToTopic(topic, userSendName + ': ' + content, groupName, {
          groupId: groupId + '',
          groupName: groupName
        })

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

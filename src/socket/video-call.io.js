const AgoraToken = require('agora-token');
const agoraAppId = '2577ea861cca41bab8a91d1a9250136c';
const agoraAppCertificate = 'ef3b726f23b6405fbf467640b35e83ef'
const videoCallNameSpace = (io) => {
    const namespace = io.of('/video-call');

    namespace.on('connection', (socket) => {
        socket.emit('connection', 'A user connected to video call.');

        socket.on('video-call-starting', (data) => {
           
            const { channelName, userId } = data;

           
           
            const role = AgoraToken.Role.PUBLISHER; 
            const expirationTime = 3600;

            const token = AgoraToken.buildTokenWithUid(agoraAppId, agoraAppCertificate, channelName, userId, role, expirationTime);

            console.log('Generated Agora token: ', token);

            // Gửi token đến client để sử dụng
            socket.emit('video-call-token', { token });
          
        });

        socket.on('connect_error', (err) => {
            console.log('Connection Error: ', err.message);
        });
    });
};

module.exports = { videoCallNameSpace };

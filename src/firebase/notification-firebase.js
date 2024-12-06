import admin from './index.js'


const sendPushNotification = async (deviceToken, message, title) => {
    const payload = {
        notification: {
            title: 'Thông báo',
            body: message,
        },
        token: deviceToken,
        android: {
            priority: 'high',
        },
    };

    try {
        const response = await admin.messaging().send( payload);
        console.log('Thông báo đã được gửi thành công:', response);
    } catch (error) {
        console.error('Lỗi khi gửi thông báo:', error);
        throw new Error('Lỗi khi gửi thông báo');
    }
};

export  {sendPushNotification}

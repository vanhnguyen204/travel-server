const admin = require('./index.js');

const sendPushNotification = async (deviceToken, message, title) => {


    try {
        const payload = {
            notification: {
                title: title,
                body: message,
            },
            token: deviceToken,
            android: {
                priority: 'high',
            },
        };
        const response = await admin.messaging().send(payload);
        console.log('Thông báo đã được gửi thành công:', response);
    } catch (error) {
        console.log('Lỗi khi gửi thông báo:', error);

    }
};

const sendPushNotificationToMultipleDevices = async (deviceTokens, message, title) => {
    if (!Array.isArray(deviceTokens) || deviceTokens.length === 0) {
        console.error('Danh sách deviceTokens không hợp lệ hoặc trống.');
        return;
    }

    const payload = {
        notification: {
            title: title,
            body: message,
        },
        tokens: deviceTokens,
        android: {
            priority: 'high',
        },
    };

    try {
        const response = await admin.messaging().sendAll(payload);
        console.log('Thông báo đã được gửi thành công:', response);

        if (response.failureCount > 0) {
            const failedTokens = response.responses
                .map((res, index) => (res.success ? null : deviceTokens[index]))
                .filter((token) => token !== null);
            console.error('Các token không thành công:', failedTokens);
        }
    } catch (error) {
        console.error('Lỗi khi gửi thông báo cho nhiều thiết bị:', error);
        throw new Error('Lỗi khi gửi thông báo');
    }
};


const subscribeToTopic = async (deviceToken, topic) => {
    try {

        await admin.messaging().subscribeToTopic([deviceToken], topic);
        return {
            status: true,
            message: `User đã được đăng ký vào topic: ${topic}`
        }
    } catch (error) {
        console.error('Lỗi khi đăng ký vào topic:', error);

        return {
            status: false,
            message: `Lỗi khi đăng ký vào topic: ${topic}`
        }
    }
};

// Đăng ký nhiều user vào topic
const subscribeMultipleUsersToTopic = async (deviceTokens, topic) => {
    try {
        // Đăng ký tất cả các deviceTokens vào topic
        await admin.messaging().subscribeToTopic(deviceTokens, topic);
        console.log(`Các user đã được đăng ký vào topic: ${topic}`);
    } catch (error) {
        console.error('Lỗi khi đăng ký nhiều user vào topic:', error);
        throw new Error('Lỗi khi đăng ký nhiều user vào topic');
    }
};
const subscribeUserToMultipleTopics = async (deviceToken, topics) => {
    try {
        // Đăng ký  deviceToken vào tất cả topic
        await Promise.all(topics.map(async topic => {
            await admin.messaging().subscribeToTopic(deviceToken, topic);
            console.log(`Các user đã được đăng ký vào topic: ${topic}`);
        }))

    } catch (error) {
        console.error('Lỗi khi đăng ký nhiều user vào topic:', error);
        throw new Error('Lỗi khi đăng ký nhiều user vào topic');
    }
}
const sendPushNotificationToTopic = async (topic, message, title, data) => {
    const payload = {
        notification: {
            title: title,
            body: message,
        },
        topic: topic,
        data: data ?? {},
        android: {
            priority: 'high',
        },
    };

    try {
        const response = await admin.messaging().send(payload);
        console.log('Thông báo đã được gửi thành công tới topic:', response);
    } catch (error) {
        console.error('Lỗi khi gửi thông báo đến topic:', error);
        throw new Error('Lỗi khi gửi thông báo');
    }
};
const unsubscribeFromTopic = async (deviceToken, topic) => {
    try {
        if (Array.isArray(deviceToken)) {

            await admin.messaging().unsubscribeFromTopic(deviceToken, topic);
        } else {
            await admin.messaging().unsubscribeFromTopic([deviceToken], topic);
        }
        console.log(`User đã được hủy đăng ký khỏi topic: ${topic}`);
    } catch (error) {
        console.error('Lỗi khi hủy đăng ký khỏi topic:', error);
        throw new Error('Lỗi khi hủy đăng ký khỏi topic');
    }
};
module.exports = {
    sendPushNotification,
    sendPushNotificationToMultipleDevices,
    subscribeToTopic,
    subscribeMultipleUsersToTopic,
    sendPushNotificationToTopic,
    unsubscribeFromTopic,
    subscribeUserToMultipleTopics
};

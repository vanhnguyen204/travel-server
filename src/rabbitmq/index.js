const amqplib = require('amqplib');
const schedule = require('node-schedule');

class RabbitMQScheduler {
    static instance;

    constructor() {
        if (RabbitMQScheduler.instance) {
            return RabbitMQScheduler.instance; // Nếu đã có instance, không tạo mới
        }

        this.rabbitMQUrl = 'amqp://localhost';
        this.connection = null;
        this.channels = {}; // Lưu các channel theo queueName
        this.scheduledJobs = {}; // Lưu các jobs đã lên lịch

        RabbitMQScheduler.instance = this; // Chỉ tạo 1 instance

        // Kết nối RabbitMQ ngay khi tạo instance
        this.connect({
            heartbeat: 60  
        });
    }

    async connect() {
        if (!this.connection) {
            this.connection = await amqplib.connect(this.rabbitMQUrl);
            console.log('Rabbit-MQ: Connected to RabbitMQ.');
        }
    }

    // Tạo channel cho queueName (chỉ tạo channel khi cần)
    async createChannel(queueName) {
        if (!this.connection) throw new Error('RabbitMQ is not connected.');

        if (!this.channels[queueName]) {
            const channel = await this.connection.createChannel();
            await channel.assertQueue(queueName);
            this.channels[queueName] = channel;
            // console.log(`* * * Rabbit-MQ Channel created for queue "${queueName}".`);
        }

        return this.channels[queueName];
    }

    // Gửi tin nhắn đến queue
    async sendMessageToQueue(queueName, message) {
        const channel = await this.createChannel(queueName);
        channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)));
        console.log(`Message sent to queue "${queueName}":`, message);
    }

    // Lên lịch gửi tin nhắn đến queue
    async scheduleMessageForQueue(queueName, message, sendAt) {
        const channel = await this.createChannel(queueName);

        const job = schedule.scheduleJob(sendAt, () => {
            channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)));
            console.log(`Scheduled message sent to queue "${queueName}" at ${new Date().toLocaleString()}:`, message);
        });
        // Lưu lại job vào đối tượng `scheduledJobs` với key là queueName và thời gian gửi
        this.scheduledJobs[`${queueName}-${sendAt}`] = job;
        console.log(`Scheduled job for "${queueName}" at ${sendAt}`);
    }

    // Xóa lịch gửi tin nhắn (hủy job đã lên lịch)
    async deleteScheduledJob(queueName, sendAt) {
        const jobKey = `${queueName}-${sendAt}`;
        const job = this.scheduledJobs[jobKey];

        if (job) {
            job.cancel(); // Hủy bỏ job đã lên lịch
            delete this.scheduledJobs[jobKey]; // Xóa job khỏi đối tượng `scheduledJobs`
            console.log(`Scheduled job for "${queueName}" at ${sendAt} has been canceled.`);
        } else {
            console.log(`No scheduled job found for "${queueName}" at ${sendAt}.`);
        }
    }

    // Cập nhật lịch gửi tin nhắn (hủy job cũ và tạo job mới)
    async updateScheduledJob(queueName, message, oldSendAt, newSendAt) {
        // Xóa job cũ
        await this.deleteScheduledJob(queueName, oldSendAt);

        // Lên lịch job mới
        await this.scheduleMessageForQueue(queueName, message, newSendAt);
    }

    async startListeningEventFromQueue(queueName, onMessage) {
        const channel = await this.createChannel(queueName);
        channel.consume(queueName, (msg) => {
            if (msg !== null) {
                const content = JSON.parse(msg.content.toString());
                onMessage(content);
                channel.ack(msg);
            }
        });
    }
    async deleteQueue(queueName) {
        if (!this.connection) throw new Error('RabbitMQ is not connected.');

        const channel = await this.createChannel(queueName);
        await channel.deleteQueue(queueName); // Xóa queue trên RabbitMQ
        delete this.channels[queueName]; // Xóa channel khỏi đối tượng channels
        console.log(`Queue "${queueName}" has been deleted.`);
    }
    async ackByChannelName(queueName) {
        const channel = this.channels[queueName];

        if (!channel) {
            console.error(`No channel found for queue "${queueName}"`);
            return;
        }

        channel.consume(queueName, (msg) => {
            if (msg !== null) {
                try {
                    const content = JSON.parse(msg.content.toString());

                    // Ensure the message has the 'deliveryTag' before calling ack
                    if (msg.fields && msg.fields.deliveryTag) {
                        channel.ack(msg);  // Acknowledge the message
                        console.log(`Acknowledged message from "${queueName}":`, content);
                    } else {
                        console.error(`Invalid message format, no deliveryTag found:`, msg);
                    }
                } catch (error) {
                    console.error(`Error processing message from "${queueName}":`, error);
                }
            }
        });
    }

}

// (async () => {
//     const scheduler = new RabbitMQScheduler();
//     await scheduler.connect();
//     await scheduler.sendMessageToQueue('event-push-notification', {
//         topic: '/topics/group-47',
//         title: 'Sự kiện quan trọng',
//         message: 'Hãy tham gia ngay hôm nay!',
//     });

//     const sendAt = new Date(new Date().getTime() + 5000);
//     await scheduler.scheduleMessageForQueue('event-scheduler', {
//         eventId: 101,
//         message: 'Đây là tin nhắn được gửi tự động.',
//     }, sendAt);

//     const updatedSendAt = new Date(new Date().getTime() + 10000); // Cập nhật thời gian lên lịch sau 10 giây
//     await scheduler.updateScheduledJob('event-scheduler', {
//         eventId: 101,
//         message: 'Đây là tin nhắn cập nhật.',
//     }, sendAt, updatedSendAt);

//     // await scheduler.deleteScheduledJob('event-scheduler', updatedSendAt);

//     await scheduler.startListeningEventFromQueue('event-push-notification', (message) => {
//         console.log('Received from "event-push-notification":', message);
//     });

//     await scheduler.startListeningEventFromQueue('event-scheduler', (message) => {
//         console.log('Received from "event-scheduler":', message);
//     });
// })();

module.exports = new RabbitMQScheduler();

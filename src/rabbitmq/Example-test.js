
// const RabbitMQScheduler = require('./index.js');

// (
//     async () => {
//         // const scheduler = new RabbitMQScheduler();
//         await RabbitMQScheduler.connect()
       
//         await RabbitMQScheduler.sendMessageToQueue('/topics/group-47', {
//             title: "Thông báo",
//             message: "Test rabbit-mq messaging mai thi 10 point"
//         })
//     }
// )()


// type Event = {
//     start: string; // Ngày bắt đầu (định dạng 'YYYY-MM-DD')
//     end: string;   // Ngày kết thúc (định dạng 'YYYY-MM-DD')
// };
const events = [
    { start: '2024-12-01', end: '2024-12-02' },
    { start: '2024-12-10', end: '2024-12-10' }
];

function isEventValid(event) {
    const start = new Date(event.start).getTime();
    const end = new Date(event.end).getTime();
    return start <= end; // Ngày bắt đầu phải trước hoặc bằng ngày kết thúc
}

function isEventOverlap(newEvent, existingEvents) {
    if (!isEventValid(newEvent)) {
        throw new Error("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.");
    }

    return existingEvents.some(event => {
        const newStart = new Date(newEvent.start).getTime();
        const newEnd = new Date(newEvent.end).getTime();
        const existingStart = new Date(event.start).getTime();
        const existingEnd = new Date(event.end).getTime();

        return newStart <= existingEnd && newEnd >= existingStart;
    });
}

// Input: Event mới cần kiểm tra
const newEvent = {
    start: '2024-12-03',
    end: '2024-12-08'
};

try {
    if (isEventOverlap(newEvent, events)) {
        console.log("Event mới bị trùng thời gian với các event trước đó.");
    } else {
        console.log("Event mới không bị trùng thời gian.");
    }
} catch (error) {
    console.error(error.message);
}

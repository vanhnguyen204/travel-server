const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
const { parseRSS } = require('./rss/index')
const { connect } = require('./redis/index.js');
const { connectMongodb, testMysqlConnection } = require('./db/index.js')
const { friendNameSpace } = require('./socket/friend.io.js')
const { chatFriendNameSpace } = require('./socket/chat-friend.io.js')
const { videoCallNameSpace } = require('./socket/video-call.io.js')
const chatNamespace = require('./socket/chat-group.io.js');
const { groupNameSpace } = require('./socket/group.io.js')
const notificationNameSpace = require('./socket/notification.io.js');
const { foregroundNotifyNameSpace } = require('./socket/foreground-notify.io.js')
const routes = require('./routes/index.js')
const app = express();
const { ip } = require('./utils/ip.js');
const { updateGroupIdsAndListen } = require('./rabbitmq/eventStartListening.js');

const RabbitMQScheduler = require('./rabbitmq/index.js');
const reportNameSpace = require('./socket/report.io.js');
//connect rabbit-mq
// const rabbit_mq = new RabbitMQScheduler()
RabbitMQScheduler.connect()
.then(() => {
  updateGroupIdsAndListen()
    .then(res => {

    })
    .catch(e => {
      console.log('Error listen queue: ', e)
    })
})
.catch(e => {
  console.log('Error connect rabbit-mq: ', e)
});
// Kết nối tới Redis
connect()

// Kết nối mongodb
connectMongodb();
testMysqlConnection();
// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
routes(app)

app.use((req, res, next) => {
  next(createError(404));
});

app.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

const port = 5000;
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  }
});

chatNamespace(io);
friendNameSpace(io);
notificationNameSpace(io);
chatFriendNameSpace(io);
foregroundNotifyNameSpace(io);
videoCallNameSpace(io)
groupNameSpace(io)

reportNameSpace(io)

server.listen(port, ip, () => {
  console.log(`Server is listening at http://${ip}:${port}`);
});

app.use('/', (req, res, next) => {
  res.send('<h1>HELLO SERVER NODEJS</h1>')
})

module.exports = app;


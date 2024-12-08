const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
const {parseRSS} = require('./rss/index')
const {connect} = require('./redis/index.js');

const chatNamespace = require('./socket/chat-group.io.js'); // Import chatNamespace
const notificationNameSpace = require('./socket/notification.io.js')
const routes = require('./routes/index.js')
const app = express();
const ip = '192.168.0.100'; // Địa chỉ IP của máy chủ


// Kết nối tới Redis
connect()

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
// app.use('/rss',async (req, res) => {
//   const rssUrl = 'https://vnexpress.net/rss/du-lich.rss';
//   try {
//     const data = await parseRSS(rssUrl);
//     res.send(data);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// })
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
notificationNameSpace(io)
server.listen(port, ip, () => {
  console.log(`Server is listening at http://${ip}:${port}`);
});




module.exports =  app;

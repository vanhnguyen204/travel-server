const multer = require('multer');
const path = require('path');

// // Dùng __dirname để lấy thư mục hiện tại
// const storage = multer.diskStorage({
//     destination: (req, file, cb) => {
//         // Lấy thư mục public/images
//         cb(null, path.join(__dirname, '../public/images'));
//     },
//     filename: function (req, file, cb) {
//         // Sử dụng tên gốc của tệp khi lưu
//         cb(null, file.originalname);
//     }
// });
const storage = multer.memoryStorage();
// Middleware upload cho nhiều tệp
const upload = multer({ storage }).array('file');

// Middleware upload cho một tệp
const uploadSingleFile = multer({ storage }).single('file');

module.exports = { upload, uploadSingleFile };

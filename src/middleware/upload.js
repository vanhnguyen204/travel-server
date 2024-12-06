const multer = require('multer');
const path = require('path');
const { dirname } = require('path');
const { fileURLToPath } = require('url');

// Để lấy __dirname trong CommonJS
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cấu hình lưu trữ cho multer
const storage = multer.diskStorage({
    destination: path.join(__dirname, '../../public/images'), // Đường dẫn đến thư mục lưu trữ ảnh
    filename: function (req, file, cb) {
        cb(null, file.originalname); // Tên file sẽ là tên gốc của file
    }
});

// Cấu hình multer để xử lý nhiều file và một file
const upload = multer({ storage }).array('file');
const uploadSingleFile = multer({ storage }).single('file');

// Xuất các middleware upload để sử dụng trong các route
module.exports = { upload, uploadSingleFile };

const axios = require('axios'); // Thư viện để gửi yêu cầu HTTP (nếu cần)
const { ip } = require('../../utils/ip.js'); // Đường dẫn tới file utils/ip.js
const jwt = require('jsonwebtoken');

const secretKey = '/q5Il7oI//Hiv4va97MQAtYOaktNo188-23WY12YVRCRGBEwYECRg0T6YcrEzYWb';

// Hàm verify token
const verifyToken = async (token) => {
    return new Promise((resolve, reject) => {
        jwt.verify(token, secretKey, (err, decoded) => {
            if (err) {
                reject(err);
            } else {
                resolve(decoded);
            }
        });
    });
};

// Middleware xác thực token
const authenticateToken = async (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            status: 401,
            message: 'Không có quyền truy cập.',
            cause: 'Không thể kiểm tra người dùng.'
        });
    }

    try {
        const decoded = await verifyToken(token);

        // Kiểm tra ngày hết hạn của token
        const currentTime = Math.floor(Date.now() / 1000); // Lấy thời gian hiện tại (giây)
        if (decoded.exp && decoded.exp < currentTime) {
            return res.status(401).json({
                status: 401,
                message: 'Token đã hết hạn.',
                cause: 'Vui lòng đăng nhập lại.'
            });
        }

        // Gắn thông tin user vào request
        req.body.user = decoded;
        next();
    } catch (err) {
        res.status(400).json({
            status: 400,
            message: 'Xác thực thất bại.',
            cause: err.message === 'jwt expired' ? 'Token đã hết hạn.' : 'Token không hợp lệ.'
        });
    }
};

module.exports = { authenticateToken };

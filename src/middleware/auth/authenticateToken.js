const { jwtVerify } = require('jose'); // Thư viện jose
const { TextEncoder } = require('util'); // Để mã hóa secret key
const { ip } = require('../../utils/ip.js'); // Đường dẫn tới file utils/ip.js
const { pool } = require('../../db/index.js');

// Khóa bí mật để ký và xác thực token
const secretKey = '/q5Il7oI//Hiv4va97MQAtYOaktNo188-23WY12YVRCRGBEwYECRg0T6YcrEzYWb';

/**
 * Hàm verify token sử dụng jose
 * @param {string} token - Token cần xác thực
 * @returns {Promise<object>} Payload nếu token hợp lệ
 */
const verifyToken = async (token) => {
    try {
        const encoder = new TextEncoder();
        const key = encoder.encode(secretKey);

        // Xác minh token, bỏ qua kiểm tra `exp`
        const { payload } = await jwtVerify(token, key, {
            algorithms: ['HS512'], // Đảm bảo thuật toán phù hợp
            clockTolerance: 0,    // Tolerance cho thời gian (nếu cần)
        });

        // Kiểm tra thủ công claim `exp`
    
        const currentTime = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < currentTime) {
            throw new Error('Token đã hết hạn.');
        }

        return payload;
    } catch (err) {
        throw new Error(err.message || 'Token không hợp lệ');
    }
};


/**
 * Middleware xác thực token
 */
const authenticateToken = async (req, res, next) => {
    const authHeader = req.header('Authorization');
    const token = authHeader?.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            status: 401,
            message: 'Không có quyền truy cập.',
            cause: 'Thiếu token trong yêu cầu.'
        });
    }

    try {
        const decoded = await verifyToken(token);

        // Kiểm tra ngày hết hạn của token
        const currentTime = Math.floor(Date.now() / 1000); // Thời gian hiện tại (giây)
        // console.log('Current time:', currentTime);
        // console.log('Decoded token expiration:', decoded);
        const [checkUserIsLock] = await pool.promise().query('Select * from user where email = ? ', decoded.iss );
        if (checkUserIsLock[0].is_locked !== 'OPEN') {
            return res.status(401).json({
                status: false,
                message: 'Tài khoản của bạn đã bị khoá, vui lòng thử lại sau.',
                cause: 'Vui lòng đăng nhập lại.'
            });
        }
        if (decoded.exp && decoded.exp < currentTime) {
            return res.status(401).json({
                status: false,
                message: 'Token đã hết hạn.',
              
            });
        }
        const { password, roles, ...rest } = checkUserIsLock[0]
        req.body.user = decoded;
        console.log('user info: ', {
            ...rest
        })
        req.body.userInfo = {
            ...rest
        }
        next();
    } catch (err) {
        console.error('Error verifying token:', err);
        res.status(401).json({
            status: 401,
            message: 'Xác thực thất bại.',
            cause: err.message === 'JWTExpired' ? 'Token đã hết hạn.' : 'Token không hợp lệ.'
        });
    }
};

module.exports = { authenticateToken, secretKey };

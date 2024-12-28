const { messaging } = require("firebase-admin");
const { pool } = require("../../db");
const bcrypt = require('bcryptjs');
const { secretKey } = require("../../middleware/auth/authenticateToken");

const jose = require('jose');

const jwt = require('jsonwebtoken');

class AuthenticationController {

    async register(req, res, next) {
        try {
            const { fullname, email, password, location } = req.body;

            // Kiểm tra xem email đã tồn tại trong cơ sở dữ liệu hay chưa
            const [existingUser] = await pool.promise().query(
                'SELECT * FROM user WHERE email = ?',
                [email]
            );

            if (existingUser.length > 0) {
                return res.status(400).json({
                    status: false,
                    message: `Email ${email} đã tồn tại, vui lòng thử lại với email khác!`,
                });
            }

            // Xử lý thông tin location
            let latitude = null;
            let longitude = null;
            if (location) {
                const locParts = location.split(',');
                latitude = locParts[0];
                longitude = locParts[1];
            }

            // Mã hóa mật khẩu
            const hashedPassword = await bcrypt.hash(password, 10);

            // Gán vai trò mặc định là USER
            const roles = JSON.stringify(['USER']); // Lưu vai trò dưới dạng JSON trong cơ sở dữ liệu

            // Thêm người dùng vào cơ sở dữ liệu
            const [result] = await pool.promise().query(
                `INSERT INTO user (fullname, email, password, is_locked, latitude, longitude, roles) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [fullname, email, hashedPassword, 'OPEN', latitude, longitude, roles]
            );

            if (result.affectedRows === 0) {
                throw new Error('Transaction cannot complete!');
            }

            // Trả về phản hồi thành công
            res.status(201).json({
                status: true,
                message: 'Đăng ký tài khoản thành công.',
            });
        } catch (error) {
            console.error('Error during registration:', error);
            res.status(500).json({ status: false, message: error.message });
            next(error);
        }
    }


    async login(req, res, next) {
        try {
            const { email, password, deviceToken, currentDevice, location } = req.body;

            // Kiểm tra xem tài khoản có bị khóa hay không
            const [checkIsLocked] = await pool.promise().query(
                'SELECT * FROM user WHERE email = ? AND is_locked = "LOOK"',
                [email]
            );

            if (checkIsLocked.length > 0) {
                const result = checkIsLocked[0];
                const lockDate = new Date(result.lock_date);

                // Định dạng ngày (dd-mm-yyyy)
                const day = String(lockDate.getDate()).padStart(2, '0');
                const month = String(lockDate.getMonth() + 1).padStart(2, '0'); // Tháng bắt đầu từ 0
                const year = lockDate.getFullYear();

                return res.status(400).json({
                    message: `Tài khoản của bạn đã bị khóa đến ngày ${day}-${month}-${year}, vui lòng thử lại sau.`,
                    status: false,
                    data: null,
                });
            }

            // Lấy thông tin tài khoản từ cơ sở dữ liệu
            const [userResult] = await pool.promise().query(
                'SELECT * FROM user WHERE email = ?',
                [email]
            );

            if (userResult.length === 0) {
                return res.status(404).json({
                    status: false,
                    message: `Tài khoản ${email} không tồn tại, vui lòng kiểm tra lại.`,
                    data: null,
                });
            }

            const user = userResult[0];

            // Xử lý mật khẩu: loại bỏ tiền tố "{bcrypt}" nếu có
            const hashedPassword = user.password.startsWith('{bcrypt}')
                ? user.password.slice(8)
                : user.password;

            // Kiểm tra mật khẩu
            const isPasswordValid = await bcrypt.compare(password, hashedPassword);
            if (!isPasswordValid) {
                return res.status(401).json({
                    status: false,
                    message: 'Mật khẩu không đúng, vui lòng thử lại.',
                    data: null,
                });
            }

            // Tạo JWT token
            const token = await generateToken(user)

            // Cập nhật deviceToken, currentDevice, và location nếu có
            const latitude = location?.latitude || null;
            const longitude = location?.longitude || null;

            await pool.promise().query(
                'UPDATE user SET device_token = ?, current_device = ?, latitude = ?, longitude = ? WHERE email = ?',
                [deviceToken, currentDevice, latitude, longitude, email]
            );

            // Trả về phản hồi thành công
            const { password: _, roles, ...userWithoutPassword } = user; // Loại bỏ mật khẩu khỏi phản hồi
            res.status(200).json({
                status: true,
                message: 'Đăng nhập thành công.',
                data: {
                    token: token,
                    user: {
                        ...userWithoutPassword,
                        avatarUrl: userWithoutPassword.avatar_url, // Định dạng lại nếu cần
                    },
                },
            });
        } catch (error) {
            console.error('Error during login:', error);
            res.status(500).json({ error: error.message, status: false });
            next(error);
        }
    }

}

async function generateToken(user) {
    // Tạo payload với các claim cần thiết
    const claims = {
        iss: user.email, // Email trong claim "iss"
        sub: user.fullname, // Fullname trong claim "sub"
        exp: Math.floor(Date.now() / 1000) + 86400, // Thời gian hết hạn (24 giờ)
        iat: Math.floor(Date.now() / 1000), // Thời gian tạo token
        scope: buildScope(user) // Quyền hạn (scope)
    };

    // Tạo khóa bí mật từ SIGNER_KEY
    const _secretKey = new TextEncoder().encode(secretKey);

    // Ký token bằng thuật toán HS512
    const jwt = await new jose.SignJWT(claims)
        .setProtectedHeader({ alg: 'HS512' }) // Thuật toán HS512
        .sign(_secretKey);

    console.log('Generated JWT token:', jwt);
    return jwt;
}

function buildScope(user) {

    return Array.isArray(user.roles) && user.roles.length > 0 ? user.roles[0] : 'USER';
}

module.exports = new AuthenticationController();
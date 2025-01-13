const { messaging } = require("firebase-admin");
const { pool } = require("../../db");
const bcrypt = require("bcryptjs");
const { secretKey } = require("../../middleware/auth/authenticateToken");
const {
  setData: setDataRedis,
  getData: getDataRedis,
} = require("../../redis/index.js");
const jose = require("jose");
const { handleSendEmail } = require("../../middleware/mailer");

const KEY_VERIFY_CODE = "KEY_VERIFY_CODE";

class AuthenticationController {
  async handleConfirmVerifyCode(req, res, next) {
    try {

      const { code } = req.query;

      const { id: userId } = req.body.userInfo;
      const resCode = await getDataRedis(KEY_VERIFY_CODE + userId);
      return res.status(200).json({
        message: 'OKE la',
        data: {
          verifyCode: resCode,
          requestCode: code
        }
      })
    } catch (error) {
      console.error("Error handleConfirmVerifyCode:", error);
      res.status(500).json({ status: false, message: error.message });
      next(error);
    }
  }
  async handleRequestForgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      const [checkEmailExists] = await pool
        .promise()
        .query("SELECT id from user where email = ? ", [email]);
      if (checkEmailExists.length === 0) {
        return res.status(400).json({
          status: false,
          message: `Tài khoản ${email} không tồn tại, vui lòng kiểm tra lại.`,
        });
      }
      const verifyCode = Math.round(900000 * Math.random() + 100000);
      await handleSendEmail({
        userEmail: email,
        subject: "Lấy lại mật khẩu",
        text: `
        Xin chào,

        Để hoàn tất quá trình lấy lại mật khẩu, vui lòng sử dụng mã xác minh dưới đây:

        Mã xác minh của bạn: ${verifyCode}

        Mã này sẽ hết hạn sau 1 phút. Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email này.

        Nếu bạn gặp bất kỳ vấn đề nào, hãy liên hệ với chúng tôi qua email travelwithmefpl.work@gmail.com.

        Trân trọng,  
        Đội ngũ hỗ trợ của TravelWithMe
        `,
      });
      const verifyInfo = {
        code: verifyCode,
      };
      await setDataRedis(KEY_VERIFY_CODE + email, verifyInfo, 30);
      return res.status(200).json({
        message:'Mã xác nhận đã được gửi về email của bạn, vui lòng nhập mã 6 chữ số để thực hiện lấy lại mật khẩu.',
        status: false,
      })
    } catch (error) {
      console.error("Error request forgot password:", error);
      res.status(500).json({ status: false, message: error.message });
      next(error);
    }
  }
  async handleChangePassword(req, res, next) {
    try {
      const passwordRegex =
        /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,16}$/;

      const { userId } = req.params;
      const { oldPass, newPass } = req.body;
      console.log("Body: ", req.body);
      console.log("id: ", userId);
      const { email } = req.body.userInfo;

      if (+req.body.userInfo.id !== +userId) {
        return res.status(400).json({
          message: `Tài khoản này không phải của bạn, bạn không có quyền cập nhật mật khẩu.`,
          status: false,
        });
      }
      const [checkIsLocked] = await pool
        .promise()
        .query('SELECT * FROM user WHERE id = ? AND is_locked = "LOCK"', [
          userId,
        ]);

      if (checkIsLocked.length > 0) {
        const result = checkIsLocked[0];
        const lockDate = new Date(result.lock_date);

        // Định dạng ngày (dd-mm-yyyy)
        const day = String(lockDate.getDate()).padStart(2, "0");
        const month = String(lockDate.getMonth() + 1).padStart(2, "0"); // Tháng bắt đầu từ 0
        const year = lockDate.getFullYear();

        return res.status(400).json({
          message: `Tài khoản của bạn đã bị khóa đến ngày ${day}-${month}-${year}, vui lòng thử lại sau.`,
          status: false,
        });
      }
      // Lấy thông tin tài khoản từ cơ sở dữ liệu
      const [userResult] = await pool
        .promise()
        .query("SELECT * FROM user WHERE id = ?", [userId]);

      if (userResult.length === 0) {
        return res.status(400).json({
          status: false,
          message: `Tài khoản ${email} không tồn tại, vui lòng kiểm tra lại.`,
        });
      }

      const user = userResult[0];
      // Xử lý mật khẩu: loại bỏ tiền tố "{bcrypt}" nếu có
      const hashedPassword = user.password.startsWith("{bcrypt}")
        ? user.password.slice(8)
        : user.password;

      // Kiểm tra mật khẩu
      const isPasswordValid = await bcrypt.compare(oldPass, hashedPassword);
      if (!isPasswordValid) {
        return res.status(400).json({
          status: false,
          message: "Mật khẩu cũ không đúng, vui lòng thử lại.",
        });
      }
      if (!passwordRegex.test(newPass)) {
        return res.status(400).json({
          status: false,
          message:
            "Mật khẩu mới phải chứa ít nhất một chữ hoa, một số, một ký tự đặc biệt và có độ dài từ 8 đến 16 ký tự.",
        });
      }
      // Mã hóa mật khẩu
      const saltRounds = 10; // Số vòng mã hóa
      const hashedPasswordV2 = await bcrypt.hash(newPass, saltRounds);

      // Thêm `{bcrypt}` vào trước mã hóa
      const formattedPassword = `{bcrypt}${hashedPasswordV2}`;
      const [updatePassResult] = await pool
        .promise()
        .query("update user set password = ? where id = ? ", [
          hashedPasswordV2,
          userId,
        ]);
      res.status(200).json({
        status: true,
        message: "Cập nhật mật khẩu thành công.",
      });
    } catch (error) {
      console.error("Error change password:", error);
      res.status(500).json({ status: false, message: error.message });
      next(error);
    }
  }
  async getMyInformation(req, res, next) {
    try {
      // const verifyCode = Math.round( 900000*Math.random() + 100000);

      const { userId } = req.params;

      const [info] = await pool
        .promise()
        .query(
          "SELECT EMAIL, AVATAR_URL, BIO, FULLNAME from user where id = ?",
          [userId]
        );
      if (info.length === 0) {
        return res.status(400).json({
          message: "Tài khoản không tồn tại.",
          status: false,
        });
      }

      return res.status(200).json({
        message: "Lấy thông tin cá nhân người dùng thành công",
        data: info[0],
        status: false,
      });
    } catch (error) {
      console.error("Error get my information:", error);
      res.status(500).json({ status: false, message: error.message });
      next(error);
    }
  }
  async register(req, res, next) {
    try {
      const { fullname, email, password, location } = req.body;

      // Kiểm tra xem email đã tồn tại trong cơ sở dữ liệu hay chưa
      const [existingUser] = await pool
        .promise()
        .query("SELECT * FROM user WHERE email = ?", [email]);

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
        const locParts = location.split(",");
        latitude = locParts[0];
        longitude = locParts[1];
      }

      // Mã hóa mật khẩu
      const hashedPassword = await bcrypt.hash(password, 10);

      // Gán vai trò mặc định là USER
      const roles = JSON.stringify(["USER"]); // Lưu vai trò dưới dạng JSON trong cơ sở dữ liệu

      // Thêm người dùng vào cơ sở dữ liệu
      const [result] = await pool.promise().query(
        `INSERT INTO user (fullname, email, password, is_locked, latitude, longitude, roles) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [fullname, email, hashedPassword, "OPEN", latitude, longitude, roles]
      );

      if (result.affectedRows === 0) {
        throw new Error("Transaction cannot complete!");
      }

      // Trả về phản hồi thành công
      res.status(201).json({
        status: true,
        message: "Đăng ký tài khoản thành công.",
      });
    } catch (error) {
      console.error("Error during registration:", error);
      res.status(500).json({ status: false, message: error.message });
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password, deviceToken, currentDevice, location } =
        req.body;

      // Kiểm tra xem tài khoản có bị khóa hay không
      const [checkIsLocked] = await pool
        .promise()
        .query('SELECT * FROM user WHERE email = ? AND is_locked = "LOCK"', [
          email,
        ]);

      if (checkIsLocked.length > 0) {
        const result = checkIsLocked[0];
        const lockDate = new Date(result.lock_date);

        // Định dạng ngày (dd-mm-yyyy)
        const day = String(lockDate.getDate()).padStart(2, "0");
        const month = String(lockDate.getMonth() + 1).padStart(2, "0"); // Tháng bắt đầu từ 0
        const year = lockDate.getFullYear();

        return res.status(400).json({
          message: `Tài khoản của bạn đã bị khóa đến ngày ${day}-${month}-${year}, vui lòng thử lại sau.`,
          status: false,
        });
      }

      // Lấy thông tin tài khoản từ cơ sở dữ liệu
      const [userResult] = await pool
        .promise()
        .query("SELECT * FROM user WHERE email = ?", [email]);

      if (userResult.length === 0) {
        return res.status(404).json({
          status: false,
          message: `Tài khoản ${email} không tồn tại, vui lòng kiểm tra lại.`,
        });
      }

      const user = userResult[0];

      // Xử lý mật khẩu: loại bỏ tiền tố "{bcrypt}" nếu có
      const hashedPassword = user.password.startsWith("{bcrypt}")
        ? user.password.slice(8)
        : user.password;

      // Kiểm tra mật khẩu
      const isPasswordValid = await bcrypt.compare(password, hashedPassword);
      if (!isPasswordValid) {
        return res.status(401).json({
          status: false,
          message: "Mật khẩu không đúng, vui lòng thử lại.",
        });
      }

      // Tạo JWT token
      const token = await generateToken(user);

      // Cập nhật deviceToken, currentDevice, và location nếu có
      const latitude = location?.latitude || null;
      const longitude = location?.longitude || null;

      await pool
        .promise()
        .query(
          "UPDATE user SET device_token = ?, current_device = ?, latitude = ?, longitude = ? WHERE email = ?",
          [deviceToken, currentDevice, latitude, longitude, email]
        );

      // Trả về phản hồi thành công
      const { password: _, roles, ...userWithoutPassword } = user; // Loại bỏ mật khẩu khỏi phản hồi
      res.status(200).json({
        status: true,
        message: "Đăng nhập thành công.",
        data: {
          token: token,
          user: {
            ...userWithoutPassword,
            avatarUrl: userWithoutPassword.avatar_url, // Định dạng lại nếu cần
          },
        },
      });
    } catch (error) {
      console.error("Error during login:", error);
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
    scope: buildScope(user), // Quyền hạn (scope)
  };

  // Tạo khóa bí mật từ SIGNER_KEY
  const _secretKey = new TextEncoder().encode(secretKey);

  // Ký token bằng thuật toán HS512
  const jwt = await new jose.SignJWT(claims)
    .setProtectedHeader({ alg: "HS512" }) // Thuật toán HS512
    .sign(_secretKey);

  console.log("Generated JWT token:", jwt);
  return jwt;
}

function buildScope(user) {
  return Array.isArray(user.roles) && user.roles.length > 0
    ? user.roles[0]
    : "USER";
}

module.exports = new AuthenticationController();

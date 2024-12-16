const axios = require('axios'); // Thư viện để gửi yêu cầu HTTP
const { ip } = require('../../utils/ip.js')
const authenticateToken = async (req, res, next) => {


    try {
        const authHeader = req.headers['authorization'];
        if (!authHeader) {
            return res.status(401).json({ message: 'Access Token Missing', status: false });
        }
        const [BEARER, token] = authHeader.split(' ')


        if (!token) {
            return res.status(401).json({ message: 'Access Token Missing', status: false });
        }
        // Gửi yêu cầu xác thực token đến Spring Boot server
        const response = await axios.post(`http://${ip}:8080/onboarding/auth/token`, {
            deviceToken: '',
            currentDevice: 'IOS'
        }, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        console.log('Verify token: ', response.data);

        // Nếu Spring Boot xác thực thành công
        if (response.data && response.data.data) {

            return next(); // Tiếp tục xử lý API
        }

        return res.status(401).json({ message: 'Invalid Token', status: false });
    } catch (error) {
        console.error('Token verification error:', error.message);
        return res.status(401).json({ message: 'Unauthorized', status: false });
    }
};

module.exports = { authenticateToken };

var express = require('express');
const AuthenticationController = require('../app/controller/Authentication.controller');
const { authenticateToken } = require('../middleware/auth/authenticateToken');
var router = express.Router();




router.post('/login', AuthenticationController.login)
router.post('/register', AuthenticationController.register)
router.post('/request-recover-pass', AuthenticationController.handleRequestRecoverPassword);
router.post('/confirm-verifycode', authenticateToken, AuthenticationController.handleConfirmVerifyCode);
router.post('/request-change-pass', authenticateToken, AuthenticationController.handleRequestChangePass);

router.get('/user/information/:userId', authenticateToken, AuthenticationController.getMyInformation);



router.patch('/change-pass/:userId', authenticateToken, AuthenticationController.handleChangePassword);



module.exports = router;
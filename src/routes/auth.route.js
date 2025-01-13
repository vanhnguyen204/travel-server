var express = require('express');
const AuthenticationController = require('../app/controller/Authentication.controller');
const { authenticateToken } = require('../middleware/auth/authenticateToken');
var router = express.Router();



router.post('/login', AuthenticationController.login)
router.post('/register', AuthenticationController.register)

router.get('/user/information/:userId', authenticateToken, AuthenticationController.getMyInformation);

router.post('/change-pass/:userId', authenticateToken, AuthenticationController.handleChangePassword)


module.exports = router;
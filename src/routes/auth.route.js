var express = require('express');
const AuthenticationController = require('../app/controller/Authentication.controller');
var router = express.Router();



router.post('/login', AuthenticationController.login)
router.post('/register', AuthenticationController.register)


module.exports = router;
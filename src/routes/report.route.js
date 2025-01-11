

var express = require('express');
const AuthenticationController = require('../app/controller/Authentication.controller');
const { authenticateToken } = require('../middleware/auth/authenticateToken');
const ReportController = require('../app/controller/Report.controller');
const { upload } = require('../middleware/upload');
var router = express.Router();



router.post('/post', authenticateToken, upload, ReportController.handleReportPost)
router.post('/comment', authenticateToken, upload, ReportController.handleReportComment)

module.exports = router;
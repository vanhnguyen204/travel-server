var express = require('express');
var router = express.Router();
var NotificationController = require('../app/controller/Notification.controller.js');
const { authenticateToken } = require('../middleware/auth/authenticateToken.js');
router.patch('/mark-as-read/:userId', authenticateToken, NotificationController.markAsRead)
router.post('/', authenticateToken, NotificationController.createTravelPlanNotification);

router.get('/', authenticateToken, NotificationController.getNotification)


module.exports = router;
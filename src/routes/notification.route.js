var express = require('express');
var router = express.Router();
var NotificationController = require('../app/controller/Notification.controller.js')

router.post('/', NotificationController.createTravelPlanNotification);

router.get('/', NotificationController.getNotification)


module.exports = router;
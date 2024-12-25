var express = require('express');
var router = express.Router();
var NotifyTopicController = require('../app/controller/NotifyTopic.controller.js');
const { authenticateToken } = require('../middleware/auth/authenticateToken.js');

router.post('/group',
    authenticateToken,
    NotifyTopicController.createTopicForGroup);
router.delete('/group',
    authenticateToken,
    NotifyTopicController.deleteTopicWhenLeaveGroup);
router.post('/friend',
    authenticateToken,
    NotifyTopicController.createTopicWhenAcceptMakeFriend);
router.delete('/friend',
    authenticateToken,
    NotifyTopicController.deleteTopicWhenDeleteFriend);

router.get('/check-enable-notify-group',
    authenticateToken,
    NotifyTopicController.checkEnableNotificationGroup)
module.exports = router;
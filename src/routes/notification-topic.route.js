var express = require('express');
var router = express.Router();
var NotifyTopicController = require('../app/controller/NotifyTopic.controller.js')

router.post('/group', NotifyTopicController.createTopicForGroup);
router.delete('/group', NotifyTopicController.deleteTopicWhenLeaveGroup);
router.post('/friend', NotifyTopicController.createTopicWhenAcceptMakeFriend);
router.delete('/friend', NotifyTopicController.deleteTopicWhenDeleteFriend);
module.exports = router;
var express = require('express');
var router = express.Router();
const { authenticateToken } = require('../middleware/auth/authenticateToken.js');
const MessageController = require('../app/controller/Message.controller.js');
router.get('/friend/:referenceId', authenticateToken, MessageController.getMessagesFromFriend);
router.get('/group/:referenceId', authenticateToken, MessageController.getMessagesFromGroup);
router.get('/conversation/:referenceId', authenticateToken, MessageController.getMessageFromConversation);

module.exports  = router;
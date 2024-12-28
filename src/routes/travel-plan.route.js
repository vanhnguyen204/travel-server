var express = require('express');
var router = express.Router();

const { authenticateToken } = require('../middleware/auth/authenticateToken.js');
const TravelPlanController = require('../app/controller/TravelPlan.controller.js');
router.post('/validate',
    authenticateToken,
    TravelPlanController.validateEditTravelPlan);

module.exports = router;

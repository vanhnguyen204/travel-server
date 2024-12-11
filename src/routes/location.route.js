var express = require('express');
var router = express.Router();
var LocationController = require('../app/controller/Location.controller.js')

router.get('/search', LocationController.searchLocation)


module.exports = router;
const express = require('express');
const redisAction = require('../redis/index.js')
const { parseRSS } = require('../rss/index.js');

const route = express.Router();

const moment = require('moment');
const { authenticateToken } = require('../middleware/auth/authenticateToken.js');

route.get('/',  async (req, res, next) => {
    const rssUrl = 'https://vnexpress.net/rss/du-lich.rss';

    try {
    
        const getTravelRss = await redisAction.getData('vn-express-traveling-rss');
        const lastUpdateDate = await redisAction.getData('last-rss-update-date');
        const currentDate = moment().format('YYYY-MM-DD');

        if (!getTravelRss || lastUpdateDate !== currentDate) {
           
            console.log('Get data from vn-express');

            const data = await parseRSS(rssUrl);
            await redisAction.setData('vn-express-traveling-rss', JSON.stringify(data));
            await redisAction.setData('last-rss-update-date', currentDate);

            res.json(data);
        } else {
        
            console.log('Get data from redis');
            res.json(JSON.parse(getTravelRss));
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = route;
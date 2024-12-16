const rss = require('./rss.js');
const travelPlan = require('./notification.route.js')
const message = require('./message.route.js');
const conversation = require('./conversation.route.js');
const location = require('./location.route.js')
const route = (app) => {
  app.use('/news', rss);
  app.use('/notification', travelPlan);
  app.use('/message', message);
  app.use('/conversation', conversation);
  app.use('/location', location);
}

module.exports = route
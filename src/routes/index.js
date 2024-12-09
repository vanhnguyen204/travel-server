const rss = require('./rss.js');
const travelPlan = require('./travel-plan.route.js')
const message = require('./message.route.js');
const conversation = require('./conversation.route.js')
const route = (app) => {
  app.use('/news', rss);
  app.use('/travel/notification/travel-plan', travelPlan);
  app.use('/message', message);
  app.use('/conversation', conversation)
}

module.exports = route
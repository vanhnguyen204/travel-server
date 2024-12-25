const rss = require('./rss.js');
const travelPlan = require('./notification.route.js')
const message = require('./message.route.js');
const conversation = require('./conversation.route.js');
const location = require('./location.route.js')
const topic = require('./notification-topic.route.js')
const travelPlanV2 = require('./travel-plan.route.js')
const route = (app) => {
  app.use('/news', rss);
  app.use('/notification', travelPlan);
  app.use('/message', message);
  app.use('/conversation', conversation);
  app.use('/location', location);

  app.use('/topic', topic)
  app.use('/travel-plan', travelPlanV2)
}

module.exports = route
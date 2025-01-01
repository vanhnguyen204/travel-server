const rss = require('./rss.js');
const travelPlan = require('./notification.route.js')
const message = require('./message.route.js');
const conversation = require('./conversation.route.js');
const location = require('./location.route.js')
const topic = require('./notification-topic.route.js')
const travelPlanV2 = require('./travel-plan.route.js');
const auth = require('./auth.route.js')
const post = require('./post.route.js')
const comment = require('./comment.route.js')
const friend = require('./friend.route.js');
const group = require('./group.route.js')
const route = (app) => {
  app.use('/news', rss);
  app.use('/notification', travelPlan);
  app.use('/message', message);
  app.use('/conversation', conversation);
  app.use('/location', location);

  app.use('/topic', topic)
  app.use('/travel-plan', travelPlanV2);
  app.use('/auth', auth);
  app.use('/posts', post );
  app.use('/comments', comment);
  app.use('/friends',friend );
  app.use('/groups', group)
}

module.exports = route
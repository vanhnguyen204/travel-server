const rss = require('./rss.js')
const route = (app) => {
  app.use('/news', rss);
 
}

module.exports = route
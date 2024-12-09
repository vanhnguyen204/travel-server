const mongoose = require('mongoose')

const db_url = 'mongodb://localhost:27017/travel-with-me';
const connectMongodb = () => {
    mongoose.connect(db_url)
        .then(() => console.log('Connected mongodb "Travel with me"!')).catch(e => console.log(e));
}

module.exports = {connectMongodb}
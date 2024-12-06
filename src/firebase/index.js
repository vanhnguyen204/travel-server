const admin = require('firebase-admin');
const serviceAccount = require('./travel-with-me-9a7d4-firebase-adminsdk-efnoj-0571ee7fc1.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;

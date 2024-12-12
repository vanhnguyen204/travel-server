const mongoose = require('mongoose');
const mysql = require('mysql2');

// MongoDB URL
const db_url = 'mongodb://localhost:27017/travel-with-me';

// Kết nối MongoDB
const connectMongodb = () => {
    mongoose.connect(db_url)
        .then(() => console.log('Connected mongodb "Travel with me"!')).catch(e => console.log(e));
}

// Kết nối MySQL
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Vanh28082004@',
    database: 'Travel',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

// Kiểm tra kết nối MySQL
const testMysqlConnection = async () => {
    try {
        const [rows] = await pool.promise().query('SELECT 1');
        console.log('Connected to MySQL successfully!');
    } catch (error) {
        console.error('MySQL connection error:', error);
    }
};

// Export module
module.exports = { connectMongodb, pool, testMysqlConnection };

const mongoose = require('mongoose');
const mysql = require('mysql2');
require('dotenv').config(); // Load biến môi trường từ file .env

// MongoDB URL từ biến môi trường
const db_url = process.env.MONGODB_URL;

// Kết nối MongoDB
const connectMongodb = () => {
    mongoose.connect(db_url)
        .then(() => console.log('Mongodb: Connected mongodb "Travel with me"!'))
        .catch(e => console.log(e));
};

// Kết nối MySQL từ biến môi trường
const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.MYSQL_CONNECTION_LIMIT, 10) || 10,
    queueLimit: 0,
});

// Kiểm tra kết nối MySQL
const testMysqlConnection = async () => {
    try {
        const [rows] = await knex.select(['id']).from('user');
        // console.log('Row: ', rows)
        console.log('MySQL: Connected to MySQL with pool successfully!');
    } catch (error) {
        console.error('MySQL connection error:', error);
    }
};
const knex = require('knex')({
    client: 'mysql2',
    connection: {
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
    },
});
const testMysqlConnectionWithKnex = async () => {
    try {
        const [rows] = await pool.promise().query('SELECT 1');
        console.log('MySQL: Connected to MySQL with knex successfully!');
    } catch (error) {
        console.error('MySQL connection error:', error);
    }
};
// Export module
module.exports = { connectMongodb, pool, testMysqlConnection, knex, testMysqlConnectionWithKnex };

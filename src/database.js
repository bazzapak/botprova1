const { Sequelize } = require('sequelize');
module.exports = new Sequelize('Provaticket', 'root', 'uVE&sn8gi#O2', {
    dialect: 'mysql',
    host: process.env.DB_HOST
})
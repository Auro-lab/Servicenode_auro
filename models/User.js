const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM('user', 'tech', 'admin'), defaultValue: 'user' },
  resetOtp: { type: DataTypes.STRING, allowNull: true },
  resetOtpExpires: { type: DataTypes.DATE, allowNull: true }
});

module.exports = User;
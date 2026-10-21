const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Ticket = sequelize.define('Ticket', {
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
  priority: { 
    type: DataTypes.ENUM('Low', 'Medium', 'High', 'Urgent'), 
    defaultValue: 'Medium' 
  },
  status: { 
    type: DataTypes.ENUM('Open', 'In Progress', 'Resolved'), 
    defaultValue: 'Open' 
  }
});

module.exports = Ticket;
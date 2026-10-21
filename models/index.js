// models/index.js
const sequelize = require('../config/database');

const User = require('./User');
const Ticket = require('./Ticket');
const Category = require('./Category');
const Comment = require('./Comment');
const Notification = require('./Notification');
const Review = require('./Review');

// User & Ticket
User.hasMany(Ticket, { foreignKey: 'userId', as: 'CreatedTickets' });
Ticket.belongsTo(User, { foreignKey: 'userId', as: 'Creator' });

User.hasMany(Ticket, { foreignKey: 'techId', as: 'AssignedTickets' });
Ticket.belongsTo(User, { foreignKey: 'techId', as: 'Technician' });

// Category & Ticket
Category.hasMany(Ticket, { foreignKey: 'categoryId' });
Ticket.belongsTo(Category, { foreignKey: 'categoryId' });

// Ticket & Comment
Ticket.hasMany(Comment, { foreignKey: 'ticketId' });
Comment.belongsTo(Ticket, { foreignKey: 'ticketId' });

User.hasMany(Comment, { foreignKey: 'userId' });
Comment.belongsTo(User, { foreignKey: 'userId' });

// Notifications
Notification.belongsTo(User, { foreignKey: 'userId' });
Notification.belongsTo(Ticket, { foreignKey: 'ticketId' });

User.hasMany(Notification, { foreignKey: 'userId' });
Ticket.hasMany(Notification, { foreignKey: 'ticketId' });

// Review Associations
User.hasMany(Review, { foreignKey: 'userId', as: 'givenReviews' });
Review.belongsTo(User, { foreignKey: 'userId', as: 'customer' });

User.hasMany(Review, { foreignKey: 'technicianId', as: 'receivedReviews' });
Review.belongsTo(User, { foreignKey: 'technicianId', as: 'technician' });

Ticket.hasOne(Review, { foreignKey: 'ticketId' });
Review.belongsTo(Ticket, { foreignKey: 'ticketId' });

module.exports = {
  sequelize,
  User,
  Ticket,
  Category,
  Comment,
  Notification,
  Review
};
const { Notification } = require('../models');

module.exports = async (req, res, next) => {
  if (req.session && req.session.user) {
    try {
      const userNotifications = await Notification.findAll({
        where: { userId: req.session.user.id, isRead: false },
        order: [['createdAt', 'DESC']],
        limit: 5
      });
      res.locals.notifications = userNotifications;
    } catch (err) {
      console.error('Error fetching notifications:', err);
      res.locals.notifications = [];
    }
  } else {
    res.locals.notifications = [];
  }
  next();
};
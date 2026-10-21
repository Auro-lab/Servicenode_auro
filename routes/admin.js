const express = require('express');
const router = express.Router();
const { User, Review, Ticket } = require('../models');
const { authenticateToken } = require('../middleware/auth');

// Middleware to check for Admin role
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  res.status(403).send('Access denied. Admin privileges required.');
};

// Apply JWT authentication middleware to ALL admin routes in this file
router.use(authenticateToken);
router.use(isAdmin);

// GET /admin/users - List all registered users
router.get('/admin/users', async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'name', 'email', 'role', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });

    // Ensure req.user is passed so header.ejs knows the admin role
    res.render('admin/users', {
      user: req.user,
      users,
      error: null,
      success: null
    });
  } catch (err) {
    console.error('❌ Error fetching users:', err);
    res.status(500).send('Server Error loading admin user management.');
  }
});

// POST /admin/users/:id/role - Update user role
router.post('/admin/users/:id/role', async (req, res) => {
  const userId = req.params.id;
  const { role } = req.body;

  try {
    const targetUser = await User.findByPk(userId);

    if (!targetUser) {
      return res.status(404).send('User not found.');
    }

    // Prevent admin from demoting themselves
    if (targetUser.id === req.user.id && role !== 'admin') {
      const users = await User.findAll({ order: [['createdAt', 'DESC']] });
      return res.render('admin/users', {
        user: req.user,
        users,
        error: 'You cannot revoke your own Admin role.',
        success: null
      });
    }

    // Validate role input
    if (!['user', 'tech', 'admin'].includes(role)) {
      return res.status(400).send('Invalid role selected.');
    }

    targetUser.role = role;
    await targetUser.save();

    res.redirect('/admin/users');
  } catch (err) {
    console.error('❌ Error updating user role:', err);
    res.status(500).send('Failed to update user role.');
  }
});

// GET /admin/reviews - Standalone review auditing route
router.get('/admin/reviews', async (req, res) => {
  try {
    const reviews = await Review.findAll({
      include: [
        { model: User, as: 'customer', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'technician', attributes: ['id', 'name', 'email'] },
        { model: Ticket, attributes: ['id', 'title'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.render('admin/reviews', {
      user: req.user,
      reviews,
      error: null
    });
  } catch (err) {
    console.error('❌ Error fetching admin reviews:', err);
    res.status(500).send('Server Error loading review management.');
  }
});

module.exports = router;
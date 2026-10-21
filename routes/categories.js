const express = require('express');
const router = express.Router();
const { Category } = require('../models');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication middleware
router.use(authenticateToken);

// Middleware to check for Admin role
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  res.status(403).send('Access denied. Admin privileges required.');
};

// GET /categories - Render category management view
router.get('/categories', isAdmin, async (req, res) => {
  try {
    const categories = await Category.findAll({ order: [['name', 'ASC']] });

    res.render('categories/index', { // Adjust template name if yours is 'admin/categories'
      user: req.user, // Passed so header knows user is admin
      categories,
      error: null
    });
  } catch (err) {
    console.error('❌ Error fetching categories:', err);
    res.status(500).send('Server Error loading category management.');
  }
});

// POST /categories/create - Add new category
router.post('/categories/create', isAdmin, async (req, res) => {
  const { name } = req.body;

  try {
    if (!name || !name.trim()) {
      const categories = await Category.findAll({ order: [['name', 'ASC']] });
      return res.render('categories/index', {
        user: req.user,
        categories,
        error: 'Category name is required.'
      });
    }

    await Category.create({ name: name.trim() });
    res.redirect('/categories');
  } catch (err) {
    console.error('❌ Error creating category:', err);
    res.status(500).send('Failed to create category.');
  }
});

module.exports = router;
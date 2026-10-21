const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Ticket, Category, User, Comment, Notification, Review } = require('../models');
const { authenticateToken } = require('../middleware/auth');

// Apply JWT authentication middleware to ALL ticket routes in this file
router.use(authenticateToken);

// ==========================================
// 1. STATIC ROUTES
// ==========================================

// GET /dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const user = req.user;
    let whereClause = {};
    let reviews = [];
    let avgRating = '0.0';

    // Role-based ticket visibility
    if (user.role === 'user' || user.role === 'customer') {
      whereClause = { userId: user.id };
    } else if (user.role === 'tech') {
      whereClause = {
        [Op.or]: [
          { techId: user.id },
          { techId: null }
        ]
      };

      // Fetch reviews specifically for this technician
      reviews = await Review.findAll({
        where: { technicianId: user.id },
        include: [
          { model: User, as: 'customer', attributes: ['id', 'name', 'email'] },
          { model: Ticket, attributes: ['id', 'title'] }
        ],
        order: [['createdAt', 'DESC']]
      });

      if (reviews.length > 0) {
        const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
        avgRating = (sum / reviews.length).toFixed(1);
      }
    } else if (user.role === 'admin') {
      // Fetch all reviews for admin dashboard overview
      reviews = await Review.findAll({
        include: [
          { model: User, as: 'customer', attributes: ['id', 'name', 'email'] },
          { model: User, as: 'technician', attributes: ['id', 'name', 'email'] },
          { model: Ticket, attributes: ['id', 'title'] }
        ],
        order: [['createdAt', 'DESC']]
      });
    }

    const tickets = await Ticket.findAll({
      where: whereClause,
      include: [
        { model: Category, attributes: ['name'] },
        { model: User, as: 'Creator', attributes: ['name', 'email'] },
        { model: User, as: 'Technician', attributes: ['name'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    const stats = {
      total: tickets.length,
      open: tickets.filter(t => t.status === 'Open').length,
      inProgress: tickets.filter(t => t.status === 'In Progress').length,
      closed: tickets.filter(t => t.status === 'Closed' || t.status === 'Resolved' || t.status === 'Completed').length
    };

    res.render('dashboard', {
      user,
      tickets,
      stats,
      reviews,
      avgRating,
      error: null
    });
  } catch (err) {
    console.error('❌ Dashboard Error:', err);
    res.status(500).send('Server Error loading dashboard.');
  }
});

// GET /tickets -> Redirect base /tickets URL to dashboard
router.get('/tickets', (req, res) => {
  res.redirect('/dashboard');
});

// GET /tickets/new -> Render creation form
router.get('/tickets/new', async (req, res) => {
  try {
    const categories = await Category.findAll({ order: [['name', 'ASC']] });
    res.render('tickets/new', {
      user: req.user,
      categories,
      error: null
    });
  } catch (err) {
    console.error('❌ Error loading form:', err);
    res.status(500).send('Server Error loading form.');
  }
});

// POST /tickets/create -> Save new ticket
router.post('/tickets/create', async (req, res) => {
  const { title, description, categoryId, priority } = req.body;

  try {
    if (!title || !description || !categoryId) {
      const categories = await Category.findAll({ order: [['name', 'ASC']] });
      return res.render('tickets/new', {
        user: req.user,
        categories,
        error: 'Please fill in all required fields.'
      });
    }

    await Ticket.create({
      title: title.trim(),
      description: description.trim(),
      categoryId,
      priority: priority || 'Low',
      status: 'Open',
      userId: req.user.id
    });

    res.redirect('/dashboard');
  } catch (err) {
    console.error('❌ Error creating ticket:', err);
    const categories = await Category.findAll({ order: [['name', 'ASC']] });
    res.render('tickets/new', {
      user: req.user,
      categories,
      error: 'Failed to create ticket.'
    });
  }
});

// ==========================================
// 2. DYNAMIC ID ROUTES
// ==========================================

// GET /tickets/:id -> Single ticket view with role data
router.get('/tickets/:id', async (req, res) => {
  try {
    const ticketId = req.params.id;

    if (isNaN(ticketId)) {
      return res.redirect('/dashboard');
    }

    const ticket = await Ticket.findByPk(ticketId, {
      include: [
        { model: Category, attributes: ['id', 'name'] },
        { model: User, as: 'Creator', attributes: ['id', 'name', 'email', 'role'] },
        { model: User, as: 'Technician', attributes: ['id', 'name', 'email'] },
        {
          model: Comment,
          include: [{ model: User, attributes: ['id', 'name', 'role'] }]
        }
      ],
      order: [[{ model: Comment }, 'createdAt', 'ASC']]
    });

    if (!ticket) {
      return res.status(404).send('Ticket not found.');
    }

    const user = req.user;

    // Access check: Regular users can only view their own tickets
    if ((user.role === 'user' || user.role === 'customer') && ticket.userId !== user.id) {
      return res.status(403).send('Access denied.');
    }

    // Fetch tech/admin list for assignment controls
    const techUsers = await User.findAll({
      where: { role: ['tech', 'admin'] },
      attributes: ['id', 'name', 'role']
    });

    res.render('tickets/show', {
      user,
      ticket,
      techUsers,
      error: req.query.error || null
    });
  } catch (err) {
    console.error('❌ Error loading ticket detail:', err);
    res.status(500).send('Server Error loading ticket.');
  }
});

// POST /tickets/:id/update -> Update status or technician assignment
router.post('/tickets/:id/update', async (req, res) => {
  try {
    const { status, techId } = req.body;
    const ticket = await Ticket.findByPk(req.params.id);
    const currentUser = req.user;

    if (!ticket) {
      return res.status(404).send('Ticket not found.');
    }

    const oldStatus = ticket.status;

    // Update status/tech based on role
    if (status && (currentUser.role === 'tech' || currentUser.role === 'admin')) {
      ticket.status = status;
    }

    if (techId !== undefined && currentUser.role === 'admin') {
      ticket.techId = techId || null;
    } else if (currentUser.role === 'tech' && Number(techId) === currentUser.id) {
      ticket.techId = currentUser.id;
    }

    await ticket.save();

    // NOTIFICATION LOGIC: Notify ticket owner if status changed
    if (status && status !== oldStatus && ticket.userId !== currentUser.id) {
      await Notification.create({
        userId: ticket.userId,
        ticketId: ticket.id,
        message: `Your Ticket #${ticket.id} status was updated to "${status}" by ${currentUser.name}.`
      });
    }

    res.redirect(`/tickets/${ticket.id}`);
  } catch (err) {
    console.error('❌ Error updating ticket:', err);
    res.status(500).send('Failed to update ticket.');
  }
});

// POST /tickets/:id/comments -> Add new comment and trigger notification
router.post('/tickets/:id/comments', async (req, res) => {
  const ticketId = req.params.id;
  const { message } = req.body;
  const currentUser = req.user;

  try {
    if (!message || !message.trim()) {
      return res.redirect(`/tickets/${ticketId}?error=Comment cannot be empty`);
    }

    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) {
      return res.status(404).send('Ticket not found.');
    }

    // 1. Create the comment
    await Comment.create({
      message: message.trim(),
      ticketId: ticketId,
      userId: currentUser.id
    });

    // 2. Determine notification recipient
    let recipientId = null;

    if (currentUser.id === ticket.userId) {
      // If user commented, notify assigned tech
      recipientId = ticket.techId;
    } else {
      // If tech/admin commented, notify ticket creator
      recipientId = ticket.userId;
    }

    // 3. Send notification if recipient exists and isn't self
    if (recipientId && recipientId !== currentUser.id) {
      await Notification.create({
        userId: recipientId,
        ticketId: ticket.id,
        message: `${currentUser.name} commented on Ticket #${ticket.id}`
      });
    }

    res.redirect(`/tickets/${ticketId}`);
  } catch (err) {
    console.error('❌ Error adding comment:', err);
    res.status(500).send(`Failed to add comment: ${err.message}`);
  }
});

// GET /notifications/:id/read -> Mark notification as read ("seen")
router.get('/notifications/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findByPk(req.params.id);

    if (notification && notification.userId === req.user.id) {
      notification.isRead = true;
      await notification.save();
      return res.redirect(`/tickets/${notification.ticketId}`);
    }

    res.redirect('/dashboard');
  } catch (err) {
    console.error('❌ Error updating notification status:', err);
    res.redirect('/dashboard');
  }
});

module.exports = router;
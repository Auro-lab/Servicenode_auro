const express = require('express');
const router = express.Router();
const { Review } = require('../models');
const { authenticateToken } = require('../middleware/auth');

// POST /reviews/add
router.post('/add', authenticateToken, async (req, res) => {
  try {
    const { ticketId, technicianId, rating, speedRating, comment } = req.body;
    const customerId = req.user.id || req.user.userId; // Handles variation in JWT payload keys

    // 1. Validation Check
    if (!rating) {
      return res.status(400).json({ error: 'Please select a rating score.' });
    }

    // 2. Parse numbers cleanly
    const parsedTicketId = ticketId ? parseInt(ticketId, 10) : null;
    const parsedTechId = technicianId ? parseInt(technicianId, 10) : null;
    const parsedRating = parseInt(rating, 10);
    const parsedSpeed = speedRating ? parseInt(speedRating, 10) : null;

    // 3. Prevent duplicate reviews on the same ticket
    if (parsedTicketId) {
      const existingReview = await Review.findOne({ where: { ticketId: parsedTicketId } });
      if (existingReview) {
        return res.status(400).json({ error: 'You have already reviewed this service ticket.' });
      }
    }

    // 4. Save Review to DB
    const newReview = await Review.create({
      customerId: parseInt(customerId, 10),
      technicianId: parsedTechId,
      ticketId: parsedTicketId,
      rating: parsedRating,
      speedRating: parsedSpeed,
      comment: comment ? comment.trim() : ''
    });

    return res.status(201).json({ message: 'Review submitted successfully!', review: newReview });

  } catch (error) {
    // Print the full DB error to your terminal console for easy debugging
    console.error('❌ Detailed Review Submission Error:', error);

    // Return specific Sequelize or Database validation message if available
    const errorMsg = error.errors ? error.errors[0].message : error.message;
    return res.status(500).json({ error: `Database error: ${errorMsg}` });
  }
});

module.exports = router;
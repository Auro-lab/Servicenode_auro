const express = require('express');
const router = express.Router();
const { Review, Ticket, User } = require('../models');

// Middleware to protect routes (ensures user is logged in via JWT/session)
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'You must be logged in to leave a review.' });
  }
  next();
};

// 1. Submit a review for a technician
router.post('/add', requireAuth, async (req, res) => {
  try {
    const { ticketId, technicianId, rating, speedRating, comment } = req.body;
    const userId = req.user.id;

    // Optional: Check if a review already exists for this ticket
    if (ticketId) {
      const existingReview = await Review.findOne({ where: { ticketId } });
      if (existingReview) {
        return res.status(400).json({ error: 'You have already reviewed this service ticket.' });
      }
    }

    // Create the review
    const newReview = await Review.create({
      userId,
      technicianId,
      ticketId: ticketId || null,
      rating: parseInt(rating, 10),
      speedRating: speedRating ? parseInt(speedRating, 10) : null,
      comment
    });

    res.status(201).json({ message: 'Review submitted successfully!', review: newReview });
  } catch (error) {
    console.error('Error submitting review:', error);
    res.status(500).json({ error: 'Failed to submit review.' });
  }
});

// 2. Get all reviews & average rating for a specific technician
router.get('/technician/:id', async (req, res) => {
  try {
    const technicianId = req.params.id;

    const reviews = await Review.findAll({
      where: { technicianId },
      include: [
        { model: User, as: 'customer', attributes: ['id', 'name', 'email'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Calculate overall average and speed average
    const totalReviews = reviews.length;
    let avgRating = 0;
    let avgSpeedRating = 0;

    if (totalReviews > 0) {
      const sumRating = reviews.reduce((acc, r) => acc + r.rating, 0);
      avgRating = (sumRating / totalReviews).toFixed(1);

      const speedReviews = reviews.filter(r => r.speedRating !== null);
      if (speedReviews.length > 0) {
        const sumSpeed = speedReviews.reduce((acc, r) => acc + r.speedRating, 0);
        avgSpeedRating = (sumSpeed / speedReviews.length).toFixed(1);
      }
    }

    res.json({
      technicianId,
      totalReviews,
      avgRating,
      avgSpeedRating,
      reviews
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews.' });
  }
});

module.exports = router;
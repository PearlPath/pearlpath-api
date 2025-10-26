const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

// Placeholder for user routes
router.get('/profile', authenticateToken, (req, res) => {
  res.json({ message: 'User profile route' });
});

module.exports = router;

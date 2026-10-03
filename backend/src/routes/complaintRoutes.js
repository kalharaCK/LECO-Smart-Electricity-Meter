const express = require('express');
const {
  createComplaint,
  getMyComplaints,
  getComplaintById,
  updateComplaintStatus,
  getAllComplaints
} = require('../controllers/complaintController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { complaintRateLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

// All complaint routes require customer or staff authentication
router.use(requireAuth);

router.post('/', complaintRateLimiter, createComplaint);
router.get('/my', getMyComplaints);
router.get('/all', getAllComplaints);
router.get('/:id', getComplaintById);
router.patch('/:id/status', updateComplaintStatus);

module.exports = router;

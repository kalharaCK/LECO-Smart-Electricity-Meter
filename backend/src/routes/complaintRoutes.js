const express = require('express');
const {
  createComplaint,
  getMyComplaints,
  getComplaintById,
  updateComplaintStatus,
  getAllComplaints
} = require('../controllers/complaintController');
const { requireAuth, requireCustomer, requireStaff } = require('../middlewares/authMiddleware');
const { complaintRateLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

router.use(requireAuth);

/**
 * Staff-only operations
 * Customer tokens are strictly rejected
 */
router.get('/all', requireStaff, getAllComplaints);
router.patch('/:id/status', requireStaff, updateComplaintStatus);

/**
 * Customer-only operations
 */
router.post('/', requireCustomer, complaintRateLimiter, createComplaint);
router.get('/my', requireCustomer, getMyComplaints);

/**
 * Shared retrieval (Enforces either ownership or staff role inside controller)
 */
router.get('/:id', getComplaintById);

module.exports = router;

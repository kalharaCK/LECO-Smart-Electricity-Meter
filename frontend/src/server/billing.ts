import { Router } from 'express';

const router = Router();

router.get('/history', (req, res) => {
  // Mock billing data in LKR
  res.json({
    bills: [
      { id: 'INV-2023-11', month: 'November 2023', amount: 25350.00, dueDate: '2023-12-05', status: 'Paid' },
      { id: 'INV-2023-10', month: 'October 2023', amount: 27630.00, dueDate: '2023-11-05', status: 'Paid' },
      { id: 'INV-2023-09', month: 'September 2023', amount: 33060.00, dueDate: '2023-10-05', status: 'Paid' },
      { id: 'INV-2023-08', month: 'August 2023', amount: 40440.00, dueDate: '2023-09-05', status: 'Paid' },
    ]
  });
});

export default router;

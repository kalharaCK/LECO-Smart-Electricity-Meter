import { Router } from 'express';

const router = Router();

router.get('/metrics', (req, res) => {
  // Mock usage data
  res.json({
    currentPower: 2.42,
    todayUsage: 14.2,
    projectedCost: 42630.00,
    dailyPeak: 4.80,
    gridVoltage: 230.1,
    gridFrequency: 50.02
  });
});

export default router;

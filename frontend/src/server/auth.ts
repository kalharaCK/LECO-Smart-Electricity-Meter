import { Router } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();
const SECRET = process.env.JWT_SECRET || 'lumina-mock-secret';

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  // Mock login check
  if (username && password) {
    const token = jwt.sign({ user: username }, SECRET, { expiresIn: '2h' });
    res.json({ token, user: { name: username, meterId: '#LM-9920-X1' } });
  } else {
    res.status(401).json({ error: 'Username and password required' });
  }
});

export default router;

import { Router, Response } from 'express';
import { Holiday } from '../models/index.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET /api/holidays
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { month } = req.query;
    const filter: Record<string, string> = {};
    if (month) filter.month = month as string;
    
    const holidays = await Holiday.find(filter).sort({ date: 1 });
    return res.json({ success: true, data: holidays });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
});

// POST /api/holidays
router.post('/', requireRole('admin', 'superadmin'), async (req: AuthRequest, res: Response) => {
  try {
    const { date, name } = req.body;
    if (!date || !name) {
      return res.status(400).json({ success: false, error: 'Tarikh dan nama diperlukan' });
    }

    const month = date.substring(0, 7); // YYYY-MM
    const existing = await Holiday.findOne({ date });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Cuti umum sudah wujud pada tarikh ini' });
    }

    const holiday = await Holiday.create({ date, name, month });
    return res.json({ success: true, data: holiday });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
});

// DELETE /api/holidays/:date
router.delete('/:date', requireRole('admin', 'superadmin'), async (req: AuthRequest, res: Response) => {
  try {
    const { date } = req.params;
    const result = await Holiday.deleteOne({ date });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, error: 'Cuti umum tidak dijumpai' });
    }
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
});

export default router;
import { Router, Response } from 'express';
import { Preselection } from '../models/index.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET /api/preselections
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { month } = req.query;
    const filter: Record<string, string> = {};
    if (month) filter.month = month as string;
    
    const preselections = await Preselection.find(filter).sort({ date: 1 });
    return res.json({ success: true, data: preselections });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
});

// POST /api/preselections
router.post('/', requireRole('admin', 'superadmin'), async (req: AuthRequest, res: Response) => {
  try {
    const { month, date, slotType, employeeId } = req.body;
    
    if (!month || !date || !slotType || !employeeId) {
      return res.status(400).json({ success: false, error: 'Semua medan diperlukan' });
    }

    const preselection = await Preselection.findOneAndUpdate(
      { month, date, slotType },
      { month, date, slotType, employeeId },
      { upsert: true, new: true }
    );

    return res.json({ success: true, data: preselection });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
});

// DELETE /api/preselections/:id
router.delete('/:id', requireRole('admin', 'superadmin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await Preselection.findByIdAndDelete(id);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
});

export default router;
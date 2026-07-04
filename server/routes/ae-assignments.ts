import { Router, Response } from 'express';
import { AEAssignment } from '../models/index.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET /api/ae-assignments
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { month } = req.query;
    const filter: Record<string, string> = {};
    if (month) filter.month = month as string;
    
    const assignments = await AEAssignment.find(filter).sort({ date: 1 });
    return res.json({ success: true, data: assignments });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
});

// POST /api/ae-assignments/bulk
router.post('/bulk', requireRole('admin', 'superadmin'), async (req: AuthRequest, res: Response) => {
  try {
    const { month, assignments } = req.body;
    
    if (!month || !Array.isArray(assignments)) {
      return res.status(400).json({ success: false, error: 'Bulan dan tugasan diperlukan' });
    }

    // Remove existing assignments for this month
    await AEAssignment.deleteMany({ month });

    // Insert new assignments
    if (assignments.length > 0) {
      const docs = assignments.map((a: { date: string; department: string }) => ({
        month,
        date: a.date,
        department: a.department,
      }));
      await AEAssignment.insertMany(docs);
    }

    const result = await AEAssignment.find({ month }).sort({ date: 1 });
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
});

export default router;
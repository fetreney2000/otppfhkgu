import { Router, Response } from 'express';
import { Unavailability } from '../models/index.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET /api/unavailability
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { month, employeeId } = req.query;
    const filter: Record<string, string> = {};
    
    if (employeeId) {
      filter.employeeId = employeeId as string;
    }
    
    let unavail = await Unavailability.find(filter).sort({ date: 1 });
    
    // Filter by month if provided
    if (month) {
      unavail = unavail.filter(u => u.date.startsWith(month as string));
    }
    
    return res.json({ success: true, data: unavail });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
});

// POST /api/unavailability/bulk
router.post('/bulk', async (req: AuthRequest, res: Response) => {
  try {
    const { month, dates, employeeId } = req.body;
    
    if (!month || !Array.isArray(dates)) {
      return res.status(400).json({ success: false, error: 'Bulan dan tarikh diperlukan' });
    }

    // Use provided employeeId or current user's employee record
    const empId = employeeId || req.session?.name;
    
    if (!empId) {
      return res.status(400).json({ success: false, error: 'ID kakitangan diperlukan' });
    }

    // Remove existing unavailability for this employee in this month
    const monthDates = await Unavailability.find({ employeeId: empId });
    const toDelete = monthDates.filter(u => u.date.startsWith(month));
    for (const d of toDelete) {
      await Unavailability.deleteOne({ _id: d._id });
    }

    // Insert new dates
    if (dates.length > 0) {
      const docs = dates.map((date: string) => ({
        employeeId: empId,
        date,
        createdAt: new Date(),
      }));
      await Unavailability.insertMany(docs);
    }

    const result = await Unavailability.find({ employeeId: empId }).sort({ date: 1 });
    return res.json({ success: true, data: result.filter(u => u.date.startsWith(month)) });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
});

export default router;
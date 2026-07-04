import { Router, Response } from 'express';
import { Employee, RosterSheet, Unavailability, Holiday } from '../models/index.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET /api/workspace
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const month = (req.query.month as string) || new Date().toISOString().substring(0, 7);
    const empName = req.session?.name || '';

    const [employee, roster, unavail, holidays] = await Promise.all([
      Employee.findOne({ name: empName, active: true }).select('-password'),
      RosterSheet.findOne({ month, type: 'original' }),
      Unavailability.find({ employeeId: empName }),
      Holiday.find(),
    ]);

    const empRows = roster?.rows.filter(r => r.employeeName.toLowerCase() === empName.toLowerCase()) || [];
    const monthUnavail = unavail.filter(u => u.date.startsWith(month));

    return res.json({
      success: true,
      data: {
        employee,
        roster: empRows,
        unavailability: monthUnavail,
        holidays,
        month,
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
});

export default router;
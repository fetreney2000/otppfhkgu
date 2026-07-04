import { Router, Response } from 'express';
import { Employee, RosterArchive } from '../models/index.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET /api/annual-allocation
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const month = (req.query.month as string) || new Date().toISOString().substring(0, 7);
    const year = month.split('-')[0];
    
    const employees = await Employee.find({ active: true }).sort({ employeeId: 1 });
    const archive = await RosterArchive.find({
      month: { $regex: `^${year}`, $ne: month }
    });

    const data = employees.map(emp => {
      const empArchive = archive.filter(a => a.employeeId === emp.employeeId);
      return {
        ...emp.toObject(),
        totalAssignments: empArchive.length,
        annualAE: emp.annualAE,
        annualHalfPaidAE: emp.annualHalfPaidAE,
        annualPaidAE: emp.annualPaidAE,
        annualPHAE: emp.annualPHAE,
        annualPH: emp.annualPH,
      };
    });

    return res.json({ success: true, data: { employees: data, month } });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
});

export default router;
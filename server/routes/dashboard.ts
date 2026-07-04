import { Router, Response } from 'express';
import { Employee, Holiday, AEAssignment, Preselection, RosterSheet, RosterChangeLog, Unavailability } from '../models/index.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET /api/dashboard/admin
router.get('/admin', requireRole('admin', 'superadmin'), async (req: AuthRequest, res: Response) => {
  try {
    const month = (req.query.month as string) || new Date().toISOString().substring(0, 7);
    
    const [employees, holidays, aeAssignments, preselections, roster, rosterCopy, changeLog] = await Promise.all([
      Employee.find().sort({ employeeId: 1 }),
      Holiday.find({ month }).sort({ date: 1 }),
      AEAssignment.find({ month }).sort({ date: 1 }),
      Preselection.find({ month }).sort({ date: 1 }),
      RosterSheet.findOne({ month, type: 'original' }),
      RosterSheet.findOne({ month, type: 'copy' }),
      RosterChangeLog.find({ month }).sort({ changedAt: -1 }).limit(50),
    ]);

    return res.json({
      success: true,
      data: {
        employees,
        holidays,
        aeAssignments,
        preselections,
        rosterExists: !!roster,
        rosterCopyExists: !!rosterCopy,
        changeLog,
        month,
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
});

// GET /api/dashboard/employee
router.get('/employee', async (req: AuthRequest, res: Response) => {
  try {
    const month = (req.query.month as string) || new Date().toISOString().substring(0, 7);
    const empName = req.session?.name || '';
    
    const [profile, roster, unavailability] = await Promise.all([
      Employee.findOne({ name: empName, active: true }).select('-password'),
      RosterSheet.findOne({ month, type: 'original' }),
      Unavailability.find({ employeeId: empName }),
    ]);

    const schedule = roster?.rows.filter(r => r.employeeName.toLowerCase() === empName.toLowerCase()) || [];

    return res.json({
      success: true,
      data: {
        profile,
        schedule,
        unavailability: unavailability.filter(u => u.date.startsWith(month)),
        month,
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
});

export default router;
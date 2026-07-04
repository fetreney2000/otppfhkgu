import { Router, Response } from 'express';
import { Employee } from '../models/index.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET /api/profile
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const empName = req.session?.name || '';
    const employee = await Employee.findOne({ name: empName, active: true }).select('-password');
    if (!employee) {
      return res.status(404).json({ success: false, error: 'Profil tidak dijumpai' });
    }
    return res.json({ success: true, data: employee });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
});

// PUT /api/profile
router.put('/', async (req: AuthRequest, res: Response) => {
  try {
    const empName = req.session?.name || '';
    const { Name, Email, Department, Salary } = req.body;
    
    const updates: Record<string, unknown> = {};
    if (Name) updates.name = Name;
    if (Email) updates.email = Email.toLowerCase();
    if (Department) updates.department = Department;
    if (Salary !== undefined) updates.salary = Salary;

    const employee = await Employee.findOneAndUpdate(
      { name: empName, active: true },
      updates,
      { new: true }
    ).select('-password');

    if (!employee) {
      return res.status(404).json({ success: false, error: 'Profil tidak dijumpai' });
    }

    return res.json({ success: true, data: employee });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
});

export default router;
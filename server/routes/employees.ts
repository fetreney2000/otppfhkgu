import { Router, Response } from 'express';
import { Employee } from '../models/index.js';
import { sha256Hash } from '../utils/crypto.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/employees
router.get('/', requireRole('admin', 'superadmin'), async (req: AuthRequest, res: Response) => {
  try {
    const employees = await Employee.find().sort({ employeeId: 1 });
    return res.json({ success: true, data: employees });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
});

// POST /api/employees
router.post('/', requireRole('admin', 'superadmin'), async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId, name, department, role, email, maxHoursPerMonth, salary, password } = req.body;

    if (!employeeId || !name || !department || !role || !email || !salary || !password) {
      return res.status(400).json({ success: false, error: 'Semua medan diperlukan' });
    }

    const existing = await Employee.findOne({ 
      $or: [{ employeeId }, { email: email.toLowerCase() }] 
    });
    if (existing) {
      return res.status(400).json({ success: false, error: 'ID kakitangan atau e-mel sudah wujud' });
    }

    const employee = await Employee.create({
      employeeId,
      name,
      department,
      role,
      email: email.toLowerCase(),
      maxHoursPerMonth: maxHoursPerMonth || 40,
      salary,
      password: sha256Hash(password),
      active: true,
    });

    return res.json({ success: true, data: employee });
  } catch (error) {
    console.error('Create employee error:', error);
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
});

// PUT /api/employees/:id
router.put('/:id', requireRole('admin', 'superadmin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    // Hash password if provided
    if (updates.password) {
      updates.password = sha256Hash(updates.password);
    } else {
      delete updates.password;
    }

    if (updates.email) {
      updates.email = updates.email.toLowerCase();
    }

    const employee = await Employee.findByIdAndUpdate(id, updates, { new: true });
    if (!employee) {
      return res.status(404).json({ success: false, error: 'Kakitangan tidak dijumpai' });
    }

    return res.json({ success: true, data: employee });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
});

// DELETE /api/employees/:id
router.delete('/:id', requireRole('admin', 'superadmin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const employee = await Employee.findByIdAndDelete(id);
    if (!employee) {
      return res.status(404).json({ success: false, error: 'Kakitangan tidak dijumpai' });
    }
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
});

export default router;
import { Router, Response } from 'express';
import { Employee, Session, Config } from '../models/index.js';
import { sha256Hash, generateToken } from '../utils/crypto.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req: AuthRequest, res: Response) => {
  try {
    const { name, password } = req.body;
    
    if (!name || !password) {
      return res.status(400).json({ success: false, error: 'Nama dan kata laluan diperlukan' });
    }

    const hashedPassword = sha256Hash(password);
    const nameTrimmed = name.trim();

    // Check superadmin first
    const superAdminName = (process.env.SUPERADMIN_NAME || 'superadmin').toLowerCase();
    const superAdminHash = process.env.SUPERADMIN_PASSWORD_HASH || '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';
    
    if (nameTrimmed.toLowerCase() === superAdminName && hashedPassword === superAdminHash) {
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours
      
      await Session.create({ token, name: nameTrimmed, role: 'superadmin', expiresAt });
      
      return res.json({ success: true, role: 'superadmin', token, redirectUrl: '/admin' });
    }

    // Check admin config
    const adminNameConfig = await Config.findOne({ key: 'AdminName' });
    const adminPassConfig = await Config.findOne({ key: 'AdminPassword' });
    const adminName = adminNameConfig?.value || 'admin';
    const adminPassHash = adminPassConfig?.value || sha256Hash('admin');
    
    if (nameTrimmed.toLowerCase() === adminName.toLowerCase() && hashedPassword === adminPassHash) {
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
      
      await Session.create({ token, name: nameTrimmed, role: 'admin', expiresAt });
      
      return res.json({ success: true, role: 'admin', token, redirectUrl: '/admin' });
    }

    // Check employee
    const employee = await Employee.findOne({ 
      name: { $regex: new RegExp(`^${nameTrimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      active: true 
    });

    if (!employee) {
      return res.status(401).json({ success: false, error: 'Nama atau kata laluan salah' });
    }

    if (employee.password !== hashedPassword) {
      return res.status(401).json({ success: false, error: 'Nama atau kata laluan salah' });
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
    
    await Session.create({ token, name: employee.name, role: 'employee', expiresAt });
    
    return res.json({ success: true, role: 'employee', token, redirectUrl: '/my-schedule' });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req: AuthRequest, res: Response) => {
  try {
    const token = req.body.token || req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token;
    
    if (token) {
      await Session.deleteOne({ token });
    }
    
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.session) {
      return res.status(401).json({ success: false, error: 'Tidak dibenarkan' });
    }

    let profile = null;
    if (req.session.role === 'employee') {
      profile = await Employee.findOne({ name: req.session.name, active: true }).select('-password');
    }

    return res.json({ 
      success: true, 
      data: { 
        name: req.session.name, 
        role: req.session.role,
        profile 
      } 
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
});

export default router;
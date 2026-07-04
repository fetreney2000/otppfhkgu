import { Router, Response } from 'express';
import { Config } from '../models/index.js';
import { sha256Hash } from '../utils/crypto.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// PUT /api/settings/admin
router.put('/admin', requireRole('admin', 'superadmin'), async (req: AuthRequest, res: Response) => {
  try {
    const { cutoffDay, adminName, adminPassword, ...otherSettings } = req.body;
    
    if (cutoffDay !== undefined) {
      await Config.findOneAndUpdate(
        { key: 'UnavailabilityCutoffDay' },
        { key: 'UnavailabilityCutoffDay', value: String(cutoffDay) },
        { upsert: true }
      );
    }

    if (adminName) {
      await Config.findOneAndUpdate(
        { key: 'AdminName' },
        { key: 'AdminName', value: adminName },
        { upsert: true }
      );
    }

    if (adminPassword) {
      await Config.findOneAndUpdate(
        { key: 'AdminPassword' },
        { key: 'AdminPassword', value: sha256Hash(adminPassword) },
        { upsert: true }
      );
    }

    // Save any other config settings
    for (const [key, value] of Object.entries(otherSettings)) {
      if (value !== undefined && value !== null) {
        await Config.findOneAndUpdate(
          { key },
          { key, value: String(value) },
          { upsert: true }
        );
      }
    }

    const configs = await Config.find();
    const configMap: Record<string, string> = {};
    for (const c of configs) {
      configMap[c.key] = c.value;
    }

    return res.json({ success: true, data: configMap });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
});

// GET /api/settings (all config)
router.get('/', requireRole('admin', 'superadmin'), async (req: AuthRequest, res: Response) => {
  try {
    const configs = await Config.find();
    const configMap: Record<string, string> = {};
    for (const c of configs) {
      configMap[c.key] = c.value;
    }
    return res.json({ success: true, data: configMap });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
});

export default router;
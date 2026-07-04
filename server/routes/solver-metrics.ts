import { Router, Response } from 'express';
import { SolverMetric } from '../models/index.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET /api/solver-metrics
router.get('/', requireRole('superadmin'), async (req: AuthRequest, res: Response) => {
  try {
    const { monthFrom, monthTo, limit } = req.query;
    const filter: Record<string, Record<string, string>> = {};
    
    if (monthFrom || monthTo) {
      filter.month = {};
      if (monthFrom) filter.month.$gte = monthFrom as string;
      if (monthTo) filter.month.$lte = monthTo as string;
    }

    const maxLimit = limit ? parseInt(limit as string) : 200;
    const metrics = await SolverMetric.find(filter)
      .sort({ generatedAt: -1 })
      .limit(maxLimit);

    return res.json({ success: true, data: metrics });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
});

export default router;
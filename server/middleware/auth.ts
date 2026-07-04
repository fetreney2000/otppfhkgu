import { Request, Response, NextFunction } from 'express';
import { Session } from '../models/index.js';

export interface AuthRequest extends Request {
  session?: {
    name: string;
    role: 'admin' | 'employee' | 'superadmin';
    token: string;
  };
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    // Check Authorization header first, then cookie
    let token = req.headers.authorization?.replace('Bearer ', '');
    if (!token && req.cookies) {
      token = req.cookies.token;
    }
    
    if (!token) {
      return res.status(401).json({ success: false, error: 'Tidak dibenarkan' });
    }

    const session = await Session.findOne({ token });
    if (!session) {
      return res.status(401).json({ success: false, error: 'Sesi tidak sah' });
    }

    if (session.expiresAt < new Date()) {
      await Session.deleteOne({ _id: session._id });
      return res.status(401).json({ success: false, error: 'Sesi telah tamat tempoh' });
    }

    req.session = {
      name: session.name,
      role: session.role,
      token: session.token,
    };

    next();
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.session) {
      return res.status(401).json({ success: false, error: 'Tidak dibenarkan' });
    }
    if (!roles.includes(req.session.role)) {
      return res.status(403).json({ success: false, error: 'Akses ditolak' });
    }
    next();
  };
}
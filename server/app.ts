import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { connectDB } from './utils/db.js';

import authRoutes from './routes/auth.js';
import employeeRoutes from './routes/employees.js';
import holidayRoutes from './routes/holidays.js';
import aeAssignmentRoutes from './routes/ae-assignments.js';
import preselectionRoutes from './routes/preselections.js';
import unavailabilityRoutes from './routes/unavailability.js';
import rosterRoutes from './routes/roster.js';
import dashboardRoutes from './routes/dashboard.js';
import workspaceRoutes from './routes/workspace.js';
import profileRoutes from './routes/profile.js';
import settingsRoutes from './routes/settings.js';
import annualAllocationRoutes from './routes/annual-allocation.js';
import solverMetricsRoutes from './routes/solver-metrics.js';

export function createApp() {
  const app = express();

  // Middleware
  app.use(cors({
    origin: true,
    credentials: true,
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());

  // API Routes
  app.use('/auth', authRoutes);
  app.use('/employees', employeeRoutes);
  app.use('/holidays', holidayRoutes);
  app.use('/ae-assignments', aeAssignmentRoutes);
  app.use('/preselections', preselectionRoutes);
  app.use('/unavailability', unavailabilityRoutes);
  app.use('/roster', rosterRoutes);
  app.use('/dashboard', dashboardRoutes);
  app.use('/workspace', workspaceRoutes);
  app.use('/profile', profileRoutes);
  app.use('/settings', settingsRoutes);
  app.use('/annual-allocation', annualAllocationRoutes);
  app.use('/solver-metrics', solverMetricsRoutes);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return app;
}

// For standalone server usage (local development)
export async function startServer() {
  const dotenv = await import('dotenv');
  dotenv.config();
  
  await connectDB();
  const app = createApp();
  const PORT = process.env.PORT || 3001;
  
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
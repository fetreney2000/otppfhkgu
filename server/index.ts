import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/ae-assignments', aeAssignmentRoutes);
app.use('/api/preselections', preselectionRoutes);
app.use('/api/unavailability', unavailabilityRoutes);
app.use('/api/roster', rosterRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/workspace', workspaceRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/annual-allocation', annualAllocationRoutes);
app.use('/api/solver-metrics', solverMetricsRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Connect to MongoDB and start server
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });

export default app;
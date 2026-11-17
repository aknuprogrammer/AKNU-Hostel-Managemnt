import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

import { initializeSchema } from './models/schemaInit.js';
import { seedDatabase } from './models/seed.js';

import authRoutes from './routes/authRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import mealScannerRoutes from './routes/mealScannerRoutes.js';
import hostelRoutes from './routes/hostelRoutes.js';
import leaveRoutes from './routes/leaveRoutes.js';
import complaintRoutes from './routes/complaintRoutes.js';
import messRoutes from './routes/messRoutes.js';
import financeRoutes from './routes/financeRoutes.js';
import visitorRoutes from './routes/visitorRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import staffRoutes from './routes/staffRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security and standard middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'Adikavi Nannaya University Hostel Management API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// REST API v1 Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/students', studentRoutes);
app.use('/api/v1/meal-scans', mealScannerRoutes);
app.use('/api/v1/hostels', hostelRoutes);
app.use('/api/v1/leave', leaveRoutes);
app.use('/api/v1/complaints', complaintRoutes);
app.use('/api/v1/mess', messRoutes);
app.use('/api/v1/finance', financeRoutes);
app.use('/api/v1/visitors', visitorRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/staff', staffRoutes);

// Centralized Error Handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Unhandled Server Error]', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

async function startServer() {
  try {
    console.log('[Server] Connecting to database and verifying schema...');
    await initializeSchema();
    await seedDatabase();

    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(` AKNU Hostel Management System Server Running`);
      console.log(` Port: ${PORT}`);
      console.log(` Health: http://localhost:${PORT}/health`);
      console.log(` REST API Base: http://localhost:${PORT}/api/v1`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('[Server Bootstrap Failed]', err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;

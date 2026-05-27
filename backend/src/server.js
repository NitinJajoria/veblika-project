import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import deployRoutes from './routes/deploy.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', deployRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Connect to MongoDB then start server
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('[Server] MongoDB connected');
    app.listen(process.env.PORT || 4000, () => {
      console.log(`[Server] Running on port ${process.env.PORT || 4000}`);
    });
  })
  .catch((err) => {
    console.error('[Server] MongoDB connection error:', err);
    process.exit(1);
  });

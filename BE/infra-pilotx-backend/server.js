require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectToDb } = require('./config/db'); // Named import

const app = express();
const port = process.env.PORT || 5000;

// Enhanced CORS configuration
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection and server start
async function startServer() {
  try {
    // Connect to database
    await connectToDb();
    console.log('Database connection established');

    // Routes
    app.use('/api/github', require('./routes/github'));
    app.use('/api/cluster', require('./routes/cluster'));
    app.use('/api/app', require('./routes/app'));
    app.use('/api/cicd', require('./routes/cicd'));
    app.use('/api/monitoring', require('./routes/monitoring'));
    app.use('/api/ml', require('./routes/ml'));

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.status(200).json({ status: 'healthy' });
    });

    // Error handling middleware
    app.use((err, req, res, next) => {
      console.error('Global error handler:', err);
      res.status(500).json({
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    });

    app.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`);
    });
  } catch (err) {
    console.error('🔥 Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
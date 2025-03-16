require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./config/database');
const authRoutes = require('./routes/auth');
const donorRoutes = require('./routes/donors');
const requestRoutes = require('./routes/requests');
const adminRoutes = require('./routes/admin');
const requesterRoutes = require('./routes/requesters');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS Configuration - More permissive for development
app.use(cors());  // Allow all origins in development

// Enable pre-flight requests for all routes
app.options('*', cors());

// Test database connection
const testDbConnection = async () => {
  try {
    await db.query('SELECT 1');
    console.log('Database connection successful');
  } catch (error) {
    console.error('Error connecting to database:', error.message);
    process.exit(1);
  }
};

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/donors', donorRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/requesters', requesterRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, async () => {
  await testDbConnection();
  console.log(`Server is running on port ${PORT}`);
}); 
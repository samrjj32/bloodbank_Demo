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

// Add this near the top of your server.js file, before any routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Add a CORS test endpoint
app.get('/cors-test', (req, res) => {
  res.json({ message: 'CORS is working!' });
});

// Regular middleware
app.use(express.json());

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


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
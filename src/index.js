require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const pianoRoomRoutes = require('./routes/pianoRoom');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection with Atlas configuration
mongoose.connect(process.env.MONGODB_URI, {
  serverApi: {
    version: '1',
    strict: true,
    deprecationErrors: true,
  },
  connectTimeoutMS: 30000, // Increase connection timeout to 30 seconds
  socketTimeoutMS: 45000,  // Increase socket timeout to 45 seconds
  maxPoolSize: 50,         // Increase connection pool size
  minPoolSize: 10,         // Set minimum connection pool size
  retryWrites: true,       // Enable retry for write operations
  retryReads: true         // Enable retry for read operations
})
.then(() => console.log('Connected to MongoDB Atlas'))
.catch((err) => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/piano-rooms', pianoRoomRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 
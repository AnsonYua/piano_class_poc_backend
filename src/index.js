require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const pianoRoomRoutes = require('./routes/pianoRoom');
const studioStatusRoutes = require('./routes/studioStatusRoutes');
const hostAdminRoutes = require('./routes/hostAdminRoutes');
const teacherAdminRoutes = require('./routes/teacherAdminRoutes');
const app = express();

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/piano-shop', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/piano-rooms', pianoRoomRoutes);
app.use('/api/studio-status', studioStatusRoutes);
app.use('/api/host-admin', hostAdminRoutes);
app.use('/api/teacher-admin', teacherAdminRoutes);
// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
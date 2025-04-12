const express = require('express');
const router = express.Router();
const studioStatusService = require('../services/studioStatusService');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const PianoRoom = require('../models/PianoRoom');

// Helper function to verify JWT token and get user
const verifyToken = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Check if token is active in the database
    if (!user.isTokenActive(token)) {
      return res.status(401).json({ message: 'Token has been invalidated' });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Helper function to validate required fields
const validateRequiredFields = (data, requiredFields) => {
  const missingFields = requiredFields.filter(field => !data[field]);
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
  return true;
};

// Helper function to process a single status update
const processStatusUpdate = async (data, userId) => {
  const { studioId, roomId, date, timeSlotSection, sectionDescription, status } = data;
  
  validateRequiredFields(data, ['studioId', 'roomId', 'date', 'timeSlotSection', 'sectionDescription']);
  
  return await studioStatusService.createOrUpdateStatus({
    studioId,
    roomId,
    date: new Date(date),
    timeSlotSection,
    sectionDescription,
    userId,
    status: status || 'pending'
  });
};

// Helper function to handle errors in routes
const handleRouteError = (res, error, statusCode = 400) => {
  console.error('Route error:', error);
  res.status(statusCode).json({ message: error.message });
};

// Public routes
router.get('/check-availability', async (req, res) => {
    try {
        const { studioId, date, timeSlotSection } = req.query;
        
        validateRequiredFields({ studioId, date, timeSlotSection }, ['studioId', 'date', 'timeSlotSection']);

        const isAvailable = await studioStatusService.checkAvailability(
            studioId,
            new Date(date),
            timeSlotSection
        );

        res.json({ isAvailable });
    } catch (error) {
        handleRouteError(res, error, 500);
    }
});

router.get('/available-time-slots', async (req, res) => {
    try {
        const { studioId, date } = req.query;
        
        validateRequiredFields({ studioId, date }, ['studioId', 'date']);

        const timeSlots = await studioStatusService.getAvailableTimeSlots(
            studioId,
            new Date(date)
        );

        res.json({ timeSlots });
    } catch (error) {
        handleRouteError(res, error, 500);
    }
});

// User routes (require authentication)
router.use(verifyToken);

router.get('/my-entries', async (req, res) => {
    try {
        const statusEntries = await studioStatusService.getMyStatusEntries(req.user._id);
        res.json({ statusEntries });
    } catch (error) {
        handleRouteError(res, error, 500);
    }
});

router.get('/:id', async (req, res) => {
    try {
        const status = await studioStatusService.getStatusById(req.params.id);
        res.json({ status });
    } catch (error) {
        handleRouteError(res, error, 404);
    }
});

router.patch('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        
        validateRequiredFields({ status }, ['status']);

        const updatedStatus = await studioStatusService.updateStatusStatus(
            req.params.id,
            status
        );

        res.json({ status: updatedStatus });
    } catch (error) {
        handleRouteError(res, error);
    }
});

// Admin routes only shop_admin can access
router.use(async (req, res, next) => {
    if (req.user.role !== 'shop_admin') {
        return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    next();
});

router.post('/', async (req, res) => {
    try {
        const result = await processStatusUpdate(req.body, req.user._id);
        res.status(201).json({ status: result });
    } catch (error) {
        handleRouteError(res, error);
    }
});

router.get('/studio/:studioId', async (req, res) => {
    try {
        const { studioId } = req.params;
        
        validateRequiredFields({ studioId }, ['studioId']);

        const statusEntries = await studioStatusService.getStatusByStudio(studioId);
        res.json({ statusEntries });
    } catch (error) {
        handleRouteError(res, error, 500);
    }
});

router.get('/room/:roomId', async (req, res) => {
    try {
        const { roomId } = req.params;
        
        validateRequiredFields({ roomId }, ['roomId']);

        const statusEntries = await studioStatusService.getStatusByRoom(roomId);
        res.json({ statusEntries });
    } catch (error) {
        handleRouteError(res, error, 500);
    }
});

router.post('/block', async (req, res) => {
    try {
        const { studioId, roomId, date, timeSlotSection, sectionDescription, reason } = req.body;
        
        validateRequiredFields(
            { studioId, roomId, date, timeSlotSection, sectionDescription }, 
            ['studioId', 'roomId', 'date', 'timeSlotSection', 'sectionDescription']
        );

        const blockedStatus = await studioStatusService.blockTimeSlot({
            studioId,
            roomId,
            date: new Date(date),
            timeSlotSection,
            sectionDescription,
            reason
        });

        res.status(201).json({ status: blockedStatus });
    } catch (error) {
        handleRouteError(res, error);
    }
});

router.post('/batch-update', async (req, res) => {
    try {
        const { updates } = req.body;
        
        if (!Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({ message: 'Please provide an array of updates' });
        }

        const results = await Promise.all(
            updates.map(update => processStatusUpdate(update, req.user._id))
        );

        res.status(200).json({ statuses: results });
    } catch (error) {
        handleRouteError(res, error);
    }
});

module.exports = router; 
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
    console.log(req.originalUrl);
    if(req.originalUrl === '/api/studio-status/students/make-booking'||
        req.originalUrl === '/api/studio-status/students/mybooking'
        && req.user.role === 'student'
    ) {
        next();
        return;
    } else if (req.user.role !== 'shop_admin') {
        return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    next();
});

router.get('/students/mybooking', async (req, res) => {
    try {
        // req.user is set by verifyToken middleware
        const userId = req.user._id;
        // Get all studioStatus records for this user
        const statusEntries = await studioStatusService.getMyStatusEntries(userId);
        console.log(JSON.stringify(statusEntries));
        // For each entry, populate PianoRoom and student info
        // statusEntries already has roomId populated with 'name' field
        // Let's also populate the full PianoRoom if needed
        const pianoRoomMap = {};
        const roomIds = [...new Set(statusEntries.map(e => e.roomId && e.roomId._id ? e.roomId._id.toString() : e.roomId))].filter(Boolean);
        // Fetch all PianoRooms in one go
        const pianoRooms = await PianoRoom.find({ _id: { $in: roomIds } });
        pianoRooms.forEach(room => { pianoRoomMap[room._id.toString()] = room; });

        // Get the student record for the user (if role is student)
        let studentRecord = null;
        if (req.user.role === 'student') {
            // 'student' is an array field in User
            studentRecord = req.user.student || [];
        }

        const bookings = statusEntries.map(entry => {
            // Deep clone the pianoRoom object to avoid mutating shared Mongoose docs
            let room = pianoRoomMap[entry.roomId && entry.roomId._id ? entry.roomId._id.toString() : entry.roomId];
            room = room ? JSON.parse(JSON.stringify(room)) : null;
            if (room) {
                delete room.studios;
                delete room.roomCount;
                delete room.adminId;
                delete room.createdAt;
                delete room.updatedAt;
            }
            // Only return the student where _id === studentId
            let filteredStudent = null;
            if (Array.isArray(studentRecord) && entry.studentId) {
                filteredStudent = studentRecord[entry.studentId]|| null;
            }
            // Remove unwanted fields from entry itself
            const {
                roomId, __v, id, ...cleanEntry
            } = entry;
            if (cleanEntry.studioId && cleanEntry.studioId._id) {
                delete cleanEntry.studioId._id;
            }
            return {
                ...cleanEntry,
                pianoRoom: room,
                student: filteredStudent
            };
        });
        res.json({ bookings });
    } catch (error) {
        handleRouteError(res, error, 500);
    }
});

router.post('/students/make-booking', async (req, res) => {
    try {
        const { updates } = req.body;
        
        if (!Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({ message: 'Please provide an array of updates' });
        }

        // Validate all updates first
        updates.forEach(update => {
            validateRequiredFields(update, ['studioId', 'roomId', 'date', 'timeSlotSection', 'sectionDescription']);
        });

        // Use the new batch update method
        const result = await studioStatusService.batchUpdateStatus(updates, req.user._id);
        
        res.status(200).json({ 
            message: 'Batch update completed successfully',
            result: {
                modifiedCount: result.modifiedCount || 0,
                upsertedCount: result.upsertedCount || 0,
                skippedCount: result.skippedCount || { exact: 0, noChange: 0 },
                totalProcessed: updates.length
            }
        });
    } catch (error) {
        handleRouteError(res, error);
    }
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

        const result = await studioStatusService.getStatusByRoom(roomId);
        res.json(result);
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

        // Validate all updates first
        updates.forEach(update => {
            validateRequiredFields(update, ['studioId', 'roomId', 'date', 'timeSlotSection', 'sectionDescription']);
        });

        // Use the new batch update method
        const result = await studioStatusService.batchUpdateStatus(updates, req.user._id);
        
        res.status(200).json({ 
            message: 'Batch update completed successfully',
            result: {
                modifiedCount: result.modifiedCount || 0,
                upsertedCount: result.upsertedCount || 0,
                skippedCount: result.skippedCount || { exact: 0, noChange: 0 },
                totalProcessed: updates.length
            }
        });
    } catch (error) {
        handleRouteError(res, error);
    }
});

module.exports = router; 
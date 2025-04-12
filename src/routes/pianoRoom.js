const express = require('express');
const router = express.Router();
const pianoRoomService = require('../services/pianoRoomService');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

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

// Get all piano rooms for the authenticated admin
router.get('/', verifyToken, async (req, res) => {
    try {
        // User ID is obtained only from the bearer token
        const pianoRooms = await pianoRoomService.getPianoRoomsByAdmin(req.user._id);
        res.json(pianoRooms);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get a specific piano room by ID
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const pianoRoom = await pianoRoomService.getPianoRoomById(req.params.id);
        
        // Verify that the piano room belongs to the authenticated user from token
        if (pianoRoom.adminId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to access this piano room' });
        }
        
        res.json(pianoRoom);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
});

// Create a new piano room
router.post('/', verifyToken, async (req, res) => {
    try {
        // Extract only the piano room data from the request body
        const { name, district, address, roomCount } = req.body;

        // Validate roomCount
        if (roomCount < 1) {
            return res.status(400).json({ message: 'roomCount must be greater than 0' });
        }

        // Create piano room data with the user ID from the token only
        const pianoRoomData = {
            name,
            district,
            address,
            roomCount,
            adminId: req.user._id // User ID from the token only
        };

        const newPianoRoom = await pianoRoomService.createPianoRoom(pianoRoomData);
        res.status(201).json(newPianoRoom);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router; 
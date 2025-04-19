const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const StudioStatus = require('../models/StudioStatus');

// Middleware to check if user is a teacher
const checkTeacher = (req, res, next) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ message: 'Access denied. Teacher privileges required.' });
  }
  next();
};

// Get all available reservations (status = requested)
router.get('/getAllAvailabileReversation', auth, checkTeacher, async (req, res) => {
  try {
    const requestedStatuses = await StudioStatus.find({ status: 'requested' })
      .populate('userId', '-password -tokens -otp')
      .populate('roomId', '-studios -adminId -createdAt -updatedAt -roomCount')
      .populate('studioId', '-createdAt -updatedAt');

    // Reformat response similar to hostAdmin getCancelRequest
    const result = requestedStatuses.map(entry => {
      const studentIndex = parseInt(entry.studentId);
      const selectedStudent = entry.userId.student[studentIndex];
      return {
        _id: entry._id,
        status: entry.status,
        date: entry.date,
        timeSlotSection: entry.timeSlotSection,
        sectionDescription: entry.sectionDescription,
        reason: entry.reason,
        remark: entry.remark,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        user: {
          _id: entry.userId._id,
          role: entry.userId.role,
          contactNumber: entry.userId.contactNumber,
          name: entry.userId.name,
          isVerified: entry.userId.isVerified,
          accountStatus: entry.userId.accountStatus,
          loginFailCount: entry.userId.loginFailCount,
          verifyOtpCount: entry.userId.verifyOtpCount,
          resetFailCount: entry.userId.resetFailCount,
          createdAt: entry.userId.createdAt,
          __v: entry.userId.__v
        },
        room: entry.roomId,
        studio: entry.studioId,
        student: selectedStudent
      };
    });

    res.status(200).json({
      success: true,
      count: result.length,
      data: result
    });
  } catch (error) {
    console.error('Error fetching available reservations:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching available reservations',
      error: error.message
    });
  }
});

module.exports = router;

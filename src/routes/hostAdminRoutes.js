const express = require('express');
const router = express.Router();
const User = require('../models/User');
const StudioStatus = require('../models/StudioStatus');
const PianoRoom = require('../models/PianoRoom');
const PianoStudio = require('../models/PianoStudio');
const RefundStatus = require('../models/RefundStatus');
const auth = require('../middleware/auth');

// Middleware to check if user is a host_admin
const checkHostAdmin = async (req, res, next) => {
  if (req.user.role !== 'host_admin') {
    return res.status(403).json({ message: 'Access denied. Host admin privileges required.' });
  }
  next();
};

// Get all accounts with pending status
router.get('/getPendingAccounts', auth, checkHostAdmin, async (req, res) => {
  try {
    const pendingAccounts = await User.find({ accountStatus: 'pending' })
      .select('-password -tokens -otp') // Exclude sensitive information
      .sort({ createdAt: -1 }); // Sort by creation date, newest first
    
    // Convert createdAt to UTC+8 for each account
    const accountsWithUtc8 = pendingAccounts.map(account => {
      const obj = account.toObject();
      if (obj.createdAt) {
        const utc8 = new Date(obj.createdAt.getTime() + 8 * 60 * 60 * 1000);
        obj.createdAt_utc8 = utc8.toISOString().replace('T', ' ').replace('Z', '');
        delete obj.createdAt;
      }
      return obj;
    });

    res.status(200).json({ 
      success: true,
      count: accountsWithUtc8.length,
      data: accountsWithUtc8
    });
  } catch (error) {
    console.error('Error fetching pending accounts:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching pending accounts',
      error: error.message 
    });
  }
});

// Approve a pending account (set accountStatus to active)
router.patch('/approveAccount/:userId', auth, checkHostAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findOne({ _id: userId, accountStatus: 'pending' });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found or not pending.' });
    }
    user.accountStatus = 'active';
    await user.save();
    res.status(200).json({ success: true, message: 'User approved successfully.', userId: user._id });
  } catch (error) {
    console.error('Error approving user:', error);
    res.status(500).json({ success: false, message: 'Server error while approving user', error: error.message });
  }
});

// Placeholder for GET /api/host-admin/getAccountRequest
router.get('/getAccountRequest', (req, res) => {
  // TODO: Implement logic to retrieve account requests
  res.status(200).json({ message: 'getAccountRequest placeholder' });
});


// Get all canceled requests
router.get('/getCancelRequest', auth, checkHostAdmin, async (req, res) => {
  try {
    // Find all StudioStatus with status 'requestCanceled'
    const canceledStatuses = await StudioStatus.find({ status: 'requestCanceled' })
      .populate('userId', '-password -tokens -otp')
      .populate('roomId', '-studios -adminId -createdAt -updatedAt -roomCount') // Exclude the 'studios' field
      .populate('studioId', '-createdAt -updatedAt');

    const result = canceledStatuses.map(entry => {
      const studentIndex = parseInt(entry.studentId); // Convert studentId to integer index
      const selectedStudent = entry.userId.student[studentIndex]; // Get the student object at that index

      return {
        _id: entry._id,
        status: entry.status,
        date: entry.date,
        timeSlotSection: entry.timeSlotSection,
        reason: entry.reason,
        cancelReason: entry.cancelReason,
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
        student: selectedStudent // Return the student object
      };
    });

    res.status(200).json({
      success: true,
      count: result.length,
      data: result
    });
  } catch (error) {
    console.error('Error fetching canceled requests:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching canceled requests',
      error: error.message
    });
  }
});

// Approve a fund refund (move record to RefundStatus and delete from StudioStatus)
router.patch('/approveCancel/:studioStatusId', auth, checkHostAdmin, async (req, res) => {
  try {
    const { studioStatusId } = req.params;
    // Find the StudioStatus record
    const studioStatus = await StudioStatus.findById(studioStatusId);
    if (!studioStatus) {
      return res.status(404).json({ success: false, message: 'StudioStatus record not found.' });
    }
    // Only allow if status is 'requestCanceled'
    if (studioStatus.status !== 'requestCanceled') {
      return res.status(400).json({ success: false, message: 'Status is not requestCanceled.' });
    }
    // Create a new RefundStatus record with the same data
    const refundData = studioStatus.toObject();
    delete refundData._id;
    refundData.status = 'refund';
    const refundStatus = await RefundStatus.create(refundData);
    // Delete the original StudioStatus record
    await StudioStatus.deleteOne({ _id: studioStatusId });
    res.status(200).json({ success: true, message: 'Refund approved and record moved.', refund: refundStatus });
  } catch (error) {
    console.error('Error approving fund refund:', error);
    res.status(500).json({ success: false, message: 'Server error while approving fund refund', error: error.message });
  }
});

module.exports = router;

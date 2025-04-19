const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const StudioStatus = require('../models/StudioStatus');
const TeacherLesson = require('../models/TeacherLesson');

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
    const requestedStatuses = await StudioStatus.find({ status: 'requested' }).sort({ createdAt: -1 })
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

router.patch('/confirm/:studioStatusId', auth, checkTeacher, async (req, res) => {
  try {
    const { studioStatusId } = req.params;
    const studioStatus = await StudioStatus.findById(studioStatusId);
    if (!studioStatus) {
      return res.status(404).json({ success: false, message: 'StudioStatus record not found.' });
    }
    if (studioStatus.status !== 'requested') {
      return res.status(400).json({ success: false, message: 'Status is not requested.' });
    }
    // Update status to confirmed
    studioStatus.status = 'confirmed';
    studioStatus.teacherId = req.user._id;  // assign teacher ID
    await studioStatus.save();
    // Create teacher lesson record
    const lessonData = {
      studioStatusId: studioStatus._id,
      teacherId: req.user._id,
      studioId: studioStatus.studioId,
      roomId: studioStatus.roomId,
      studentId: studioStatus.studentId,
      date: studioStatus.date,
      timeSlotSection: studioStatus.timeSlotSection,
      sectionDescription: studioStatus.sectionDescription
    };
    const lesson = await TeacherLesson.create(lessonData);
    res.status(200).json({ success: true, message: 'Lesson confirmed and record created.', lesson });
  } catch (error) {
    console.error('Error confirming lesson:', error);
    res.status(500).json({ success: false, message: 'Server error while confirming lesson', error: error.message });
  }
});

// Get all lessons created by the teacher
router.get('/getAllMyLession', auth, checkTeacher, async (req, res) => {
  try {
    const lessons = await TeacherLesson.find({ teacherId: req.user._id, status: { $ne: 'canceled' } })
      .sort({ createdAt: -1 })
      .populate({ path: 'studioStatusId', populate: [
        { path: 'userId', select: '-password -tokens -otp' },
        { path: 'roomId', select: '-studios -adminId -createdAt -updatedAt -roomCount' },
        { path: 'studioId', select: '-createdAt -updatedAt' }
      ] })
      .populate({ path: 'roomId', select: '-studios -adminId -createdAt -updatedAt -roomCount' })
      .populate({ path: 'studioId', select: '-createdAt -updatedAt' });

    const result = lessons.map(lesson => {
      const status = lesson.studioStatusId;
      const studentIndex = parseInt(status.studentId, 10);
      const student = status.userId.student[studentIndex];
      return {
        _id: lesson._id,
        status: lesson.status,
        studioStatus: status.status,
        date: status.date,
        timeSlotSection: status.timeSlotSection,
        sectionDescription: status.sectionDescription,
        room: lesson.roomId,
        studio: lesson.studioId,
        user: {
          _id: status.userId._id,
          role: status.userId.role,
          contactNumber: status.userId.contactNumber,
          name: status.userId.name,
          isVerified: status.userId.isVerified,
          accountStatus: status.userId.accountStatus,
          loginFailCount: status.userId.loginFailCount,
          verifyOtpCount: status.userId.verifyOtpCount,
          resetFailCount: status.userId.resetFailCount,
          createdAt: status.userId.createdAt
        },
        student
      };
    });

    res.status(200).json({ success: true, count: result.length, data: result });
  } catch (error) {
    console.error('Error fetching my lessons:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching my lessons', error: error.message });
  }
});

// Update lesson status to pendingForComment (only creator can do this)
router.patch('/teacherLessons/:id/status', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { _id: userId } = req.user; // userId from token (set by auth middleware)
    // Only find lesson if status is not 'cancel'
    const lesson = await TeacherLesson.findOne({ _id: id, status: { $ne: 'canceled' } });
    if (!lesson) {
      return res.status(404).json({ success: false, message: 'TeacherLesson not found or status is cancel.' });
    }
    // Only creator (teacherId) can update status
    if (lesson.teacherId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'You are not authorized to update this lesson.' });
    }
    lesson.status = 'pendingForComment';
    await lesson.save();
    res.status(200).json({ success: true, message: 'Lesson status updated to pendingForComment.', lesson });
  } catch (error) {
    console.error('Error updating lesson status:', error);
    res.status(500).json({ success: false, message: 'Server error while updating lesson status', error: error.message });
  }
});

// Cancel a lesson: set TeacherLesson.status to 'canceled' and StudioStatus.status to 'requested'
router.patch('/teacherLessons/:id/cancel', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { _id: userId } = req.user;
    // Find the lesson and ensure it exists
    const lesson = await TeacherLesson.findById(id);
    if (!lesson) {
      return res.status(404).json({ success: false, message: 'TeacherLesson not found.' });
    }
    // Only creator (teacherId) can cancel
    if (lesson.teacherId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'You are not authorized to cancel this lesson.' });
    }
    // Update TeacherLesson status
    lesson.status = 'canceled';
    await lesson.save();
    // Update related StudioStatus to 'requested'
    const studioStatus = await StudioStatus.findById(lesson.studioStatusId);
    if (studioStatus) {
      studioStatus.status = 'requested';
      await studioStatus.save();
    }
    res.status(200).json({ success: true, message: 'Lesson canceled and studio status set to requested.', lesson });
  } catch (error) {
    console.error('Error canceling lesson:', error);
    res.status(500).json({ success: false, message: 'Server error while canceling lesson', error: error.message });
  }
});

// PATCH: Add comment or assessment to a teacher lesson
router.patch('/teacherLessons/:teacherLessonId/comment', auth, checkTeacher, async (req, res) => {
  try {
    const { teacherLessonId } = req.params;
    const { type, remark, options, level } = req.body;

    // 1. Get TeacherLesson
    const teacherLesson = await TeacherLesson.findById(teacherLessonId);
    if (!teacherLesson) {
      return res.status(404).json({ success: false, message: 'TeacherLesson not found.' });
    }

    // 2. Get StudioStatus
    const studioStatus = await StudioStatus.findById(teacherLesson.studioStatusId).populate('userId');
    if (!studioStatus) {
      return res.status(404).json({ success: false, message: 'StudioStatus not found.' });
    }

    // 3. Get User (student owner)
    const user = studioStatus.userId;
    const studentIndex = parseInt(studioStatus.studentId, 10);
    if (!user || !user.student || !user.student[studentIndex]) {
      return res.status(404).json({ success: false, message: 'Student not found in user.' });
    }

    // 4. Update based on type
    if (type === 'assessment') {
      // Update student's grade
      user.student[studentIndex].grade = level;
      // Add remark to lessonComment
      studioStatus.lessonComment = remark;
      await user.save();
      await studioStatus.save();
      return res.json({ success: true, message: 'Assessment comment and grade updated.' });
    } else if (type === 'lesson') {
      // Add remark and options
      studioStatus.lessonComment = remark;
      if (Array.isArray(options)) {
        studioStatus.options = options;
      }
      await studioStatus.save();
      return res.json({ success: true, message: 'Lesson comment and options updated.' });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid type. Must be "assessment" or "lesson".' });
    }
  } catch (error) {
    console.error('Error updating teacher lesson comment:', error);
    res.status(500).json({ success: false, message: 'Server error while updating teacher lesson comment', error: error.message });
  }
});

module.exports = router;

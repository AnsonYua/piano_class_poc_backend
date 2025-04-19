const mongoose = require('mongoose');

const teacherLessonSchema = new mongoose.Schema({
  studioStatusId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudioStatus',
    required: true
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  studioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PianoStudio',
    required: true
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PianoRoom',
    required: true
  },
  studentId: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  timeSlotSection: {
    type: String,
    required: true
  },
  sectionDescription: {
    type: String,
    required: true
  },    
  status: {
    type: String,
    enum: ['open','completed', 'pendingForComment',  'closed', 'canceled'],
    default: 'open'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('TeacherLesson', teacherLessonSchema);

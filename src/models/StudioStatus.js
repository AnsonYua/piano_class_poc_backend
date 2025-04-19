const mongoose = require('mongoose');
const { formatToUTC8ISOString } = require('../utils/dateUtils');

const studioStatusSchema = new mongoose.Schema({
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
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
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
        enum: ['requested','requestCanceled', 'confirmed',  'blocked','pending'],
        default: 'pending'
    },
    reason: {
        type: String,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    cancelReason: {
        type: String,
        required: false
    },
    remark: {
        type: String,
        required: false
    },
    studentId: {
        type: String,
        required: false
    },
    teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    lessonComment: {
        type: String,
        required: false
    },
    options: {
        type: [String],
        required: false
    }
}, {
    timestamps: true,
    toJSON: { 
        virtuals: true,
        transform: function(doc, ret) {
            // Remove the virtual id field
            delete ret.id;
            
            // Format dates to UTC+8
            if (ret.date) ret.date = formatToUTC8ISOString(ret.date);
            if (ret.createdAt) ret.createdAt = formatToUTC8ISOString(ret.createdAt);
            if (ret.updatedAt) ret.updatedAt = formatToUTC8ISOString(ret.updatedAt);
            
            return ret;
        }
    },
    toObject: { virtuals: true }
});

// Index for efficient querying
studioStatusSchema.index({ studioId: 1, date: 1, timeSlotSection: 1 });
studioStatusSchema.index({ roomId: 1, date: 1 });
studioStatusSchema.index({ userId: 1, date: 1 });

// Pre-save middleware to validate time range
studioStatusSchema.pre('save', function(next) {
    if (this.date < new Date()) {
        next(new Error('Date must be in the future'));
    }
    next();
});

const StudioStatus = mongoose.model('StudioStatus', studioStatusSchema);

module.exports = StudioStatus; 
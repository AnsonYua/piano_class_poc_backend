const mongoose = require('mongoose');

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
        enum: ['pending', 'confirmed', 'cancelled', 'blocked'],
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
    }
}, {
    timestamps: true,
    toJSON: { 
        virtuals: true,
        transform: function(doc, ret) {
            // Remove the virtual id field
            delete ret.id;
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
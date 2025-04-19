const mongoose = require('mongoose');
const { formatToUTC8ISOString } = require('../utils/dateUtils');

const refundStatusSchema = new mongoose.Schema({
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
    status: {
        type: String,
        enum: ['refund'],
        default: 'refund'
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
    }
}, {
    timestamps: true,
    toJSON: { 
        virtuals: true,
        transform: function(doc, ret) {
            delete ret.id;
            if (ret.date) ret.date = formatToUTC8ISOString(ret.date);
            if (ret.createdAt) ret.createdAt = formatToUTC8ISOString(ret.createdAt);
            if (ret.updatedAt) ret.updatedAt = formatToUTC8ISOString(ret.updatedAt);
            return ret;
        }
    },
    toObject: { virtuals: true }
});

const RefundStatus = mongoose.model('RefundStatus', refundStatusSchema);

module.exports = RefundStatus;

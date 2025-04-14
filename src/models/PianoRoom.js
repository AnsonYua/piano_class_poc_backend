const mongoose = require('mongoose');
const { formatToUTC8ISOString } = require('../utils/dateUtils');

const pianoRoomSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    district: {
        type: String,
        required: true,
        trim: true
    },
    address: {
        type: String,
        required: true,
        trim: true
    },
    roomCount: {
        type: Number,
        required: true,
        min: 1
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    studios: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PianoStudio'
    }],
    createdAt: {
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
            
            // Format dates to UTC+8
            if (ret.createdAt) ret.createdAt = formatToUTC8ISOString(ret.createdAt);
            if (ret.updatedAt) ret.updatedAt = formatToUTC8ISOString(ret.updatedAt);
            
            return ret;
        }
    },
    toObject: { virtuals: true }
});

const PianoRoom = mongoose.model('PianoRoom', pianoRoomSchema);

module.exports = PianoRoom; 
const mongoose = require('mongoose');
const { formatToUTC8ISOString } = require('../utils/dateUtils');

const pianoStudioSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    pianoRoomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PianoRoom',
        required: true
    },
    status: {
        type: String,
        enum: ['available', 'occupied', 'maintenance'],
        default: 'available'
    },
    description: {
        type: String,
        trim: true
    },
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

// Virtual field for studio status entries
pianoStudioSchema.virtual('statusEntries', {
    ref: 'StudioStatus',
    localField: '_id',
    foreignField: 'studioId',
    justOne: false
});

const PianoStudio = mongoose.model('PianoStudio', pianoStudioSchema);

module.exports = PianoStudio; 
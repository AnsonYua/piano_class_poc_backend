const mongoose = require('mongoose');

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
    }
}, {
    timestamps: true
});

const PianoStudio = mongoose.model('PianoStudio', pianoStudioSchema);

module.exports = PianoStudio; 
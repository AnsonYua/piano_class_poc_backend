const mongoose = require('mongoose');

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
    timestamps: true
});

const PianoRoom = mongoose.model('PianoRoom', pianoRoomSchema);

module.exports = PianoRoom; 
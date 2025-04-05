// models/SignupAttempt.js

const mongoose = require('mongoose');

const signupAttemptSchema = new mongoose.Schema({
    contactNumber: {
        type: String,
        required: true,
        trim: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: { expires: '10m' } // Automatically remove documents after 10 minutes
    }
});

const SignupAttempt = mongoose.model('SignupAttempt', signupAttemptSchema);

module.exports = SignupAttempt;
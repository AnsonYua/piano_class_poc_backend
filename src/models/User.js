const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['teacher', 'student', 'shop_admin','admin'],
    required: true
  },
  contactNumber: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  student: [{
    name: {
      type: String,
      required: true
    },
    age: {
      type: Number,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  isVerified: {
    type: Boolean,
    default: false
  },
  accountStatus: {
    type: String,
    enum: ['pending', 'active', 'inactive'],
    default: 'pending'
  },
  otp: {
    code: String,
    expiresAt: Date,
    generatedAt: Date // New field to track when the OTP was generated
  },
  loginFailCount: {
    type: Number,
    default: 0
  },
  verifyOtpCount: {
    type: Number,
    default: 0
  },
  resetFailCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create compound index for contactNumber and role
userSchema.index({ contactNumber: 1, role: 1 }, { unique: true });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
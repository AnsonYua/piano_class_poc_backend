const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['teacher', 'student', 'shop_admin','host_admin'],
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
  tokens: [{
    token: {
      type: String,
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      required: true
    }
  }],
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

// Method to add a token
userSchema.methods.addToken = async function(token, expiresAt) {
  this.tokens = this.tokens.concat({ token, expiresAt });
  await this.save();
  return this;
};

// Method to deactivate a token
userSchema.methods.deactivateToken = async function(token) {
  const tokenIndex = this.tokens.findIndex(t => t.token === token);
  if (tokenIndex !== -1) {
    this.tokens[tokenIndex].isActive = false;
    await this.save();
    return true;
  }
  return false;
};

// Method to check if a token is active
userSchema.methods.isTokenActive = function(token) {
  const tokenObj = this.tokens.find(t => t.token === token);
  return tokenObj && tokenObj.isActive;
};

module.exports = mongoose.model('User', userSchema);
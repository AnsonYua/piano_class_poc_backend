const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { sendOTPEmail } = require('../services/emailService');

const router = express.Router();

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Signup
router.post('/signup', async (req, res) => {
  try {
    const { password, contactNumber, name, student } = req.body;

    // Validate required fields
    if (!contactNumber || !password || !name) {
      return res.status(400).json({ message: 'Contact number, password, and name are required' });
    }

    // Validate student array
    if (!Array.isArray(student) || student.length < 1 || student.length > 10) {
      return res.status(400).json({ 
        message: 'Student array must contain 1-10 objects' 
      });
    }

    // Validate each student object
    for (const studentObj of student) {
      if (!studentObj.name || !studentObj.age) {
        return res.status(400).json({ 
          message: 'Each student must have a name and age' 
        });
      }
      // Optional: Add age validation
      if (isNaN(studentObj.age) || studentObj.age < 0) {
        return res.status(400).json({ 
          message: 'Student age must be a valid positive number' 
        });
      }
    }

    // Check if user already exists (using contactNumber as unique key)
    const existingUser = await User.findOne({ contactNumber });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this contact number already exists' });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create new user with additional fields
    const user = new User({
      password,
      contactNumber,
      name,
      student,
      otp: {
        code: otp,
        expiresAt: otpExpiry
      }
    });

    await user.save();

    // Send OTP to contactNumber (assuming this is a phone number)
    // You might need to modify your emailService to handle SMS instead
    await sendOTPEmail(contactNumber, otp); // Update this to appropriate SMS service

    res.status(201).json({ message: 'User created successfully. Please verify your contact number.' });
  } catch (error) {
    res.status(500).json({ message: 'Error creating user', error: error.message });
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { contactNumber, otp } = req.body;

    const user = await User.findOne({ contactNumber });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'Contact number already verified' });
    }

    if (!user.otp || user.otp.code !== otp) {
      user.verifyOtpCount += 1;
      await user.save();
      return res.status(400).json({ 
        message: 'Invalid OTP',
        verifyOtpCount: user.verifyOtpCount 
      });
    }

    if (new Date() > user.otp.expiresAt) {
      user.verifyOtpCount += 1;
      await user.save();
      return res.status(400).json({ 
        message: 'OTP has expired',
        verifyOtpCount: user.verifyOtpCount 
      });
    }

    user.isVerified = true;
    user.otp = undefined;
    // Reset verifyOtpCount on successful verification (optional)
    user.verifyOtpCount = 0;
    await user.save();

    res.json({ message: 'Contact number verified successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error verifying OTP', error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { contactNumber, password } = req.body;

    const user = await User.findOne({ contactNumber });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      user.loginFailCount += 1;
      await user.save();
      return res.status(401).json({ 
        message: 'Invalid credentials',
        loginFailCount: user.loginFailCount 
      });
    }

    if (!user.isVerified) {
      return res.status(401).json({ message: 'Please verify your contact number first' });
    }

    // Reset loginFailCount on successful login (optional)
    if (user.loginFailCount > 0) {
      user.loginFailCount = 0;
      await user.save();
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

    res.json({ token, user: { id: user._id, contactNumber: user.contactNumber } });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
});

// Check token
router.get('/check-token', auth, (req, res) => {
  res.json({ user: { id: req.user._id, email: req.user.email } });
});

module.exports = router; 
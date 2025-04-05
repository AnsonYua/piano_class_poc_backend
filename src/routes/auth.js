const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const SignupAttempt = require('../models/SignupAttempt'); 
const auth = require('../middleware/auth');
const { sendOTPWhatsApp } = require('../services/whatsappService');
const ERROR_CODES = require('../routes/authError');
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
          return res.status(400).json({
              errorCode: ERROR_CODES.MISSING_FIELDS.code,
              message: ERROR_CODES.MISSING_FIELDS.message
          });
      }

      // Validate student array
      if (!Array.isArray(student) || student.length < 1 || student.length > 10) {
          return res.status(400).json({
              errorCode: ERROR_CODES.INVALID_STUDENT_ARRAY.code,
              message: ERROR_CODES.INVALID_STUDENT_ARRAY.message
          });
      }

      // Validate each student object
      for (const studentObj of student) {
          if (!studentObj.name || !studentObj.age) {
              return res.status(400).json({
                  errorCode: ERROR_CODES.INVALID_STUDENT_DATA.code,
                  message: ERROR_CODES.INVALID_STUDENT_DATA.message
              });
          }
          if (isNaN(studentObj.age) || studentObj.age < 0) {
              return res.status(400).json({
                  errorCode: ERROR_CODES.INVALID_STUDENT_AGE.code,
                  message: ERROR_CODES.INVALID_STUDENT_AGE.message
              });
          }
          if (studentObj.age <= 5) {
              return res.status(400).json({
                  errorCode: ERROR_CODES.STUDENT_AGE_TOO_LOW.code,
                  message: ERROR_CODES.STUDENT_AGE_TOO_LOW.message
              });
          }
      }

      // Check signup attempts in the last 10 minutes
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const attempts = await SignupAttempt.countDocuments({
          contactNumber,
          createdAt: { $gte: tenMinutesAgo }
      });

      if (attempts >= 10) {
          return res.status(429).json({
              errorCode: ERROR_CODES.TOO_MANY_ATTEMPTS.code,
              message: ERROR_CODES.TOO_MANY_ATTEMPTS.message
          });
      }

      // Start Mongoose transaction
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
          // Check if user already exists within the transaction
          const existingUser = await User.findOne({ contactNumber }).session(session);
          if (existingUser) {
              if (existingUser.isVerified) {
                  await session.abortTransaction();
                  return res.status(400).json({
                      errorCode: ERROR_CODES.USER_ALREADY_EXISTS.code,
                      message: ERROR_CODES.USER_ALREADY_EXISTS.message
                  });
              }
              // Delete unverified existing user
              await User.deleteOne({ contactNumber }).session(session);
          }

          // Generate OTP
          const otp = generateOTP();
          const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

          // Create new user within the transaction
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
          await user.save({ session });

          // Log the signup attempt
          const signupAttempt = new SignupAttempt({
              contactNumber,
              createdAt: new Date()
          });
          await signupAttempt.save();

          // Send OTP via WhatsApp (outside transaction as it’s an external call)
          await sendOTPWhatsApp(contactNumber, otp);

          // Commit the transaction
          await session.commitTransaction();
          res.status(201).json({ message: 'User created successfully. Please verify your contact number.' });
      } catch (error) {
          // Abort transaction on error
          await session.abortTransaction();
          throw error; // Re-throw to be caught by outer try-catch
      } finally {
          // End the session
          session.endSession();
      }
  } catch (error) {
      res.status(500).json({
          errorCode: ERROR_CODES.INTERNAL_SERVER_ERROR.code,
          message: ERROR_CODES.INTERNAL_SERVER_ERROR.message,
          error: error.message
      });
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
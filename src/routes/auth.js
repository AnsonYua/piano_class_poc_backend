const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const SignupAttempt = require('../models/SignupAttempt'); 
const auth = require('../middleware/auth');
const { sendOTPWhatsApp } = require('../services/whatsappService');
const ERROR_CODES = require('../routes/authError');
const router = express.Router();

const OTP_EXPIRATION_TIME = 10 * 60 * 1000; // 10 minutes in milliseconds

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Signup
router.post('/signup', async (req, res) => {
  try {
      const { password, contactNumber, name, student } = req.body;
      const role = 'student';
      // Validate required fields
      if (!contactNumber || !password || !name || !role) {
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

      // Validate role
      const validRoles = ['teacher', 'student', 'piano_admin'];
      if (!validRoles.includes(role)) {
          return res.status(400).json({
              errorCode:  ERROR_CODES.INVALID_ROLE.code,
              message: ERROR_CODES.INVALID_ROLE.message
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
          const otpExpiry = new Date(Date.now() + OTP_EXPIRATION_TIME); // Use the variable

          // Create new user within the transaction
          const user = new User({
              password,
              contactNumber,
              name,
              student,
              role,
              otp: {
                  code: otp,
                  expiresAt: otpExpiry,
                  generatedAt: new Date() 
              }
          });
          await user.save({ session });

          // Log the signup attempt
          const signupAttempt = new SignupAttempt({
              contactNumber,
              createdAt: new Date()
          });
          await signupAttempt.save();

          // Send OTP via WhatsApp (outside transaction as it's an external call)
          await sendOTPWhatsApp(contactNumber, otp);

          // Commit the transaction
          await session.commitTransaction();
          res.status(201).json({ 
            message: 'User created successfully. Please verify your contact number.',
            token: user._id // Return the ObjectId of the user
          });
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
    const { token, otp } = req.body; // Change contactNumber to userId
    userId = token;
    // Validate required fields
    if (!userId || !otp) {
      return res.status(400).json({
        errorCode: ERROR_CODES.MISSING_FIELDS.code,
        message: 'Contact number and OTP are required'
      });
    }

    const user = await User.findById(userId); // Find user by ObjectId
    if (!user) {
      return res.status(404).json({
        errorCode: ERROR_CODES.USER_NOT_FOUND.code,
        message: ERROR_CODES.USER_NOT_FOUND.message
      });
    }


    if (user.isVerified) {
      return res.status(400).json({
        errorCode: ERROR_CODES.ALREADY_VERIFIED.code,
        message: ERROR_CODES.ALREADY_VERIFIED.message
      });
    }

    // Check for too many attempts
    if (user.verifyOtpCount >= 5) {
      return res.status(429).json({
        errorCode: ERROR_CODES.TOO_MANY_OTP_ATTEMPTS.code,
        message: ERROR_CODES.TOO_MANY_OTP_ATTEMPTS.message
      });
    }

    if (!user.otp || user.otp.code !== otp) {
      user.verifyOtpCount += 1;
      await user.save();
      return res.status(400).json({
        errorCode: ERROR_CODES.INVALID_OTP.code,
        message: ERROR_CODES.INVALID_OTP.message,
        verifyOtpCount: user.verifyOtpCount
      });
    }

    if (new Date() > user.otp.expiresAt) {
      user.verifyOtpCount += 1;
      await user.save();
      return res.status(400).json({
        errorCode: ERROR_CODES.OTP_EXPIRED.code,
        message: ERROR_CODES.OTP_EXPIRED.message,
        verifyOtpCount: user.verifyOtpCount
      });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.verifyOtpCount = 0;
    await user.save();

    res.json({ message: 'Contact number verified successfully' });
  } catch (error) {
    res.status(500).json({
      errorCode: ERROR_CODES.INTERNAL_SERVER_ERROR.code,
      message: ERROR_CODES.INTERNAL_SERVER_ERROR.message,
      error: error.message
    });
  }
});

// Resend OTP
router.post('/resend-otp', async (req, res) => {
  try {
    const { token } = req.body; // Change contactNumber to userId
    userId = token;
    // Validate required fields
    if (!userId) {
      return res.status(400).json({
        errorCode: ERROR_CODES.MISSING_FIELDS.code,
        message: ERROR_CODES.MISSING_FIELDS.message
      });
    }

    const user = await User.findById(userId); 
    if (!user) {
      return res.status(404).json({
        errorCode: ERROR_CODES.USER_NOT_FOUND.code,
        message: ERROR_CODES.USER_NOT_FOUND.message
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        errorCode: ERROR_CODES.ALREADY_VERIFIED.code,
        message: ERROR_CODES.ALREADY_VERIFIED.message
      });
    }

    // Check if the OTP was generated within the last minute
    if (user.otp && user.otp.generatedAt > new Date(Date.now() - 60 * 1000)) {
      return res.status(400).json({
        errorCode: ERROR_CODES.OTP_TOO_RECENT.code,
        message: ERROR_CODES.OTP_TOO_RECENT.message
      });
    }

    // Check for too many attempts in the last 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const attempts = await SignupAttempt.countDocuments({
      contactNumber: user.contactNumber,
      createdAt: { $gte: tenMinutesAgo }
    });

    if (attempts >= 5) {
      return res.status(429).json({
        errorCode: ERROR_CODES.TOO_MANY_ATTEMPTS.code,
        message: ERROR_CODES.TOO_MANY_ATTEMPTS.message
      });
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + OTP_EXPIRATION_TIME); // Use the variable

    user.otp = {
      code: otp,
      expiresAt: otpExpiry,
      generatedAt: new Date()
    };
    user.verifyOtpCount = 0;
    await user.save();

    // Log the attempt
    const signupAttempt = new SignupAttempt({
      contactNumber: user.contactNumber,
      createdAt: new Date()
    });
    await signupAttempt.save();

    // Send OTP via WhatsApp
    await sendOTPWhatsApp(user.contactNumber, otp);

    res.json({ message: 'OTP resent successfully' });
  } catch (error) {
    res.status(500).json({
      errorCode: ERROR_CODES.INTERNAL_SERVER_ERROR.code,
      message: ERROR_CODES.INTERNAL_SERVER_ERROR.message,
      error: error.message
    });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { contactNumber, password } = req.body;

    // Validate required fields
    if (!contactNumber || !password) {
      return res.status(400).json({
        errorCode: ERROR_CODES.MISSING_FIELDS.code,
        message:  ERROR_CODES.MISSING_FIELDS.message
      });
    }

    const user = await User.findOne({ contactNumber });
    if (!user) {
      return res.status(401).json({
        errorCode: ERROR_CODES.INVALID_CREDENTIALS.code,
        message: ERROR_CODES.INVALID_CREDENTIALS.message
      });
    }

    if (!user.isVerified) {
      return res.status(401).json({
        errorCode: ERROR_CODES.UNVERIFIED_USER.code,
        message: ERROR_CODES.UNVERIFIED_USER.message
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      user.loginFailCount += 1;
      await user.save();
      return res.status(401).json({
        errorCode: ERROR_CODES.INVALID_CREDENTIALS.code,
        message: ERROR_CODES.INVALID_CREDENTIALS.message,
        loginFailCount: user.loginFailCount
      });
    }

    // Reset loginFailCount on successful login
    if (user.loginFailCount > 0) {
      user.loginFailCount = 0;
      await user.save();
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

    res.json({
      token,
      user: {
        id: user._id,
        contactNumber: user.contactNumber,
        name: user.name
      }
    });
  } catch (error) {
    res.status(500).json({
      errorCode: ERROR_CODES.INTERNAL_SERVER_ERROR.code,
      message: ERROR_CODES.INTERNAL_SERVER_ERROR.message,
      error: error.message
    });
  }
});

// Request Password Reset
router.post('/request-reset-password', async (req, res) => {
  try {
    const { contactNumber } = req.body;

    // Validate required fields
    if (!contactNumber) {
      return res.status(400).json({
        errorCode: ERROR_CODES.MISSING_FIELDS.code,
        message:  ERROR_CODES.MISSING_FIELDS.message
      });
    }

    const user = await User.findOne({ contactNumber });
    if (!user) {
      return res.status(404).json({
        errorCode: ERROR_CODES.USER_NOT_FOUND.code,
        message: ERROR_CODES.USER_NOT_FOUND.message
      });
    }

    if (!user.isVerified) {
      return res.status(401).json({
        errorCode: ERROR_CODES.UNVERIFIED_USER.code,
        message: ERROR_CODES.UNVERIFIED_USER.message
      });
    }

    // Check for too many reset attempts
    if (user.resetFailCount >= 5) {
      return res.status(429).json({
        errorCode: ERROR_CODES.TOO_MANY_RESET_ATTEMPTS.code,
        message: ERROR_CODES.TOO_MANY_RESET_ATTEMPTS.message
      });
    }

    // Check if the OTP was generated within the last minute
    if (user.otp && user.otp.generatedAt > new Date(Date.now() - 60 * 1000)) {
      return res.status(400).json({
        errorCode: ERROR_CODES.OTP_TOO_RECENT.code,
        message: ERROR_CODES.OTP_TOO_RECENT.message
      });
    }

    // Check the number of OTP requests in the last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentRequests = user.otpRequests || [];
    const validRequests = recentRequests.filter(requestTime => requestTime > twentyFourHoursAgo);

    if (validRequests.length >= 5) {
      return res.status(429).json({
        errorCode: ERROR_CODES.TOO_MANY_REQUESTS.code,
        message: 'You can only request a password reset OTP 5 times in a day.'
      });
    }

    // Add the current request time to the list
    validRequests.push(new Date());
    user.otpRequests = validRequests; // Update the user's OTP request timestamps
    await user.save();

    // Generate reset OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + OTP_EXPIRATION_TIME); // 10 minutes

    user.otp = {
      code: otp,
      expiresAt: otpExpiry,
      generatedAt: new Date() // Store the time of OTP generation
    };
    await user.save();

    // Send OTP via WhatsApp
    await sendOTPWhatsApp(contactNumber, otp);

    // Clear failed attempts on successful request
    user.resetFailAttempts = []; // Clear failed attempts
    await user.save();

    // Return user ID as token
    res.json({ message: 'Password reset OTP sent successfully', token: user._id });
  } catch (error) {
    res.status(500).json({
      errorCode: ERROR_CODES.INTERNAL_SERVER_ERROR.code,
      message: ERROR_CODES.INTERNAL_SERVER_ERROR.message,
      error: error.message
    });
  }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, otp, newPassword } = req.body; // Change contactNumber to token

    // Validate required fields
    if (!token || !otp || !newPassword) {
      return res.status(400).json({
        errorCode: ERROR_CODES.MISSING_FIELDS.code,
        message: 'User ID, OTP, and new password are required'
      });
    }

    const user = await User.findById(token); // Find user by ObjectId
    if (!user) {
      return res.status(404).json({
        errorCode: ERROR_CODES.USER_NOT_FOUND.code,
        message: ERROR_CODES.USER_NOT_FOUND.message
      });
    }

    if (!user.isVerified) {
      return res.status(401).json({
        errorCode: ERROR_CODES.UNVERIFIED_USER.code,
        message: ERROR_CODES.UNVERIFIED_USER.message
      });
    }

    // Check the number of failed reset attempts in the last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentFails = user.resetFailAttempts || [];
    const validFails = recentFails.filter(attemptTime => attemptTime > twentyFourHoursAgo);

    if (validFails.length >= 5) {
      return res.status(429).json({
        errorCode: ERROR_CODES.TOO_MANY_RESET_ATTEMPTS.code,
        message: 'You cannot request a password reset within 24 hours after 5 failed attempts.'
      });
    }

    if (!user.otp || user.otp.code !== otp) {
      user.resetFailAttempts = validFails; // Keep the valid fails
      user.resetFailAttempts.push(new Date()); // Add the current failed attempt
      await user.save();
      return res.status(400).json({
        errorCode: ERROR_CODES.INVALID_OTP.code,
        message: ERROR_CODES.INVALID_OTP.message,
        resetFailCount: user.resetFailAttempts.length
      });
    }

    if (new Date() > user.otp.expiresAt) {
      user.resetFailAttempts = validFails; // Keep the valid fails
      user.resetFailAttempts.push(new Date()); // Add the current failed attempt
      await user.save();
      return res.status(400).json({
        errorCode: ERROR_CODES.OTP_EXPIRED.code,
        message: ERROR_CODES.OTP_EXPIRED.message,
        resetFailCount: user.resetFailAttempts.length
      });
    }

    // Update password and clear OTP
    user.password = newPassword;
    user.otp = undefined;
    user.resetFailAttempts = []; // Clear failed attempts on success
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({
      errorCode: ERROR_CODES.INTERNAL_SERVER_ERROR.code,
      message: ERROR_CODES.INTERNAL_SERVER_ERROR.message,
      error: error.message
    });
  }
});

// Check token
router.get('/check-token', auth, (req, res) => {
  try {
    res.json({
      user: {
        id: req.user._id,
        contactNumber: req.user.contactNumber,
        name: req.user.name
      }
    });
  } catch (error) {
    res.status(500).json({
      errorCode: ERROR_CODES.INTERNAL_SERVER_ERROR.code,
      message: ERROR_CODES.INTERNAL_SERVER_ERROR.message,
      error: error.message
    });
  }
});

module.exports = router; 
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const SignupAttempt = require('../models/SignupAttempt'); 
const auth = require('../middleware/auth');
const { sendOTPWhatsApp } = require('../services/whatsappService');
const ERROR_CODES = require('./error');
const router = express.Router();

const OTP_EXPIRATION_TIME = 10 * 60 * 1000; // 10 minutes in milliseconds
const VALID_USER_TYPES = ["student", "teacher", "shop_admin", "admin"];

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Validate user type
const validateUserType = (userType) => {
  if (!VALID_USER_TYPES.includes(userType)) {
    return {
      isValid: false,
      error: {
        errorCode: ERROR_CODES.INVALID_ROLE.code,
        message: ERROR_CODES.INVALID_ROLE.message
      }
    };
  }
  return { isValid: true };
};

// Validate required fields
const validateRequiredFields = (fields, fieldNames) => {
  for (const field of fieldNames) {
    if (!fields[field]) {
      return {
        isValid: false,
        error: {
          errorCode: ERROR_CODES.MISSING_FIELDS.code,
          message: ERROR_CODES.MISSING_FIELDS.message
        }
      };
    }
  }
  return { isValid: true };
};

// Find user by criteria
const findUser = async (criteria, role, session = null) => {
  if (!role) {
    throw new Error('Role is required for user lookup');
  }
  const query = User.findOne({ ...criteria, role });
  if (session) {
    query.session(session);
  }
  return await query;
};

// Validate student data
const validateStudentData = (student) => {
  if (!Array.isArray(student) || student.length < 1 || student.length > 10) {
    return {
      isValid: false,
      error: {
        errorCode: ERROR_CODES.INVALID_STUDENT_ARRAY.code,
        message: ERROR_CODES.INVALID_STUDENT_ARRAY.message
      }
    };
  }

  for (const studentObj of student) {
    if (!studentObj.name || !studentObj.age) {
      return {
        isValid: false,
        error: {
          errorCode: ERROR_CODES.INVALID_STUDENT_DATA.code,
          message: ERROR_CODES.INVALID_STUDENT_DATA.message
        }
      };
    }
    if (isNaN(studentObj.age) || studentObj.age < 0) {
      return {
        isValid: false,
        error: {
          errorCode: ERROR_CODES.INVALID_STUDENT_AGE.code,
          message: ERROR_CODES.INVALID_STUDENT_AGE.message
        }
      };
    }
    if (studentObj.age <= 5) {
      return {
        isValid: false,
        error: {
          errorCode: ERROR_CODES.STUDENT_AGE_TOO_LOW.code,
          message: ERROR_CODES.STUDENT_AGE_TOO_LOW.message
        }
      };
    }
  }
  return { isValid: true };
};

// Handle signup route
const handleSignup = async (req, res, userType) => {
  const validation = validateUserType(userType);
  if (!validation.isValid) {
    return res.status(400).send(validation.error);
  }
  await signupUser(req, res, userType);
};

router.post('/signup', async (req, res) => {
  await handleSignup(req, res, "student");
});

router.post('/:userType/signup', async (req, res) => {
  await handleSignup(req, res, req.params.userType);
});

async function signupUser(req, res, type) {
  try {
    const { password, contactNumber, name, student } = req.body;
    const role = type;

    // Validate required fields
    const fieldValidation = validateRequiredFields(req.body, ['contactNumber', 'password', 'name']);
    if (!fieldValidation.isValid) {
      return res.status(400).json(fieldValidation.error);
    }

    // Validate role
    const roleValidation = validateUserType(role);
    if (!roleValidation.isValid) {
      return res.status(400).json(roleValidation.error);
    }

    // Validate student data if role is student
    if (role === 'student') {
      const studentValidation = validateStudentData(student);
      if (!studentValidation.isValid) {
        return res.status(400).json(studentValidation.error);
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
      const existingUser = await findUser({ contactNumber }, role, session);
      if (existingUser) {
        if (existingUser.isVerified) {
          await session.abortTransaction();
          return res.status(400).json({
            errorCode: ERROR_CODES.USER_ALREADY_EXISTS.code,
            message: ERROR_CODES.USER_ALREADY_EXISTS.message
          });
        }
        // Delete unverified existing user
        await User.deleteOne({ contactNumber, role }).session(session);
      }

      // Generate OTP
      const otp = generateOTP();
      const otpExpiry = new Date(Date.now() + OTP_EXPIRATION_TIME);

      // Create new user within the transaction
      const user = new User({
        password,
        contactNumber,
        name,
        student,
        role,
        accountStatus: 'pending', // Set initial account status to pending for all user types
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
      await signupAttempt.save({ session });

      // Send OTP via WhatsApp (outside transaction as it's an external call)
      await sendOTPWhatsApp(contactNumber, otp);

      // Commit the transaction
      await session.commitTransaction();
      res.status(201).json({
        message: 'User created successfully. Please verify your contact number.',
        token: user._id
      });
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      throw error;
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
}

// Common OTP verification function
async function verifyOTP(req, res, userType) {
  try {
    const validation = validateUserType(userType);
    if (!validation.isValid) {
      return res.status(400).json(validation.error);
    }

    const { token, otp } = req.body;
    const fieldValidation = validateRequiredFields(req.body, ['token', 'otp']);
    if (!fieldValidation.isValid) {
      return res.status(400).json({
        errorCode: ERROR_CODES.MISSING_USER_ID_OTP.code,
        message: ERROR_CODES.MISSING_USER_ID_OTP.message
      });
    }

    const userId = token;
    const user = await findUser({ _id: userId }, userType);
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
    
    // Update account status based on user type
    if (user.role === 'student') {
      user.accountStatus = 'active'; // Set to active for students after OTP verification
    }
    // For teachers and shop_admin, accountStatus remains 'pending' even after OTP verification
    
    await user.save();

    res.json({ message: 'Contact number verified successfully' });
  } catch (error) {
    res.status(500).json({
      errorCode: ERROR_CODES.INTERNAL_SERVER_ERROR.code,
      message: ERROR_CODES.INTERNAL_SERVER_ERROR.message,
      error: error.message
    });
  }
}

// Verify OTP for students (dedicated endpoint)
router.post('/verify-otp', async (req, res) => {
  await verifyOTP(req, res, 'student');
});

// Verify OTP for other user types
router.post('/:userType/verify-otp', async (req, res) => {
  await verifyOTP(req, res, req.params.userType);
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

// Common login function
async function handleLogin(req, res, userType) {
  try {
    const validation = validateUserType(userType);
    if (!validation.isValid) {
      return res.status(400).json(validation.error);
    }

    const { contactNumber, password } = req.body;
    const fieldValidation = validateRequiredFields(req.body, ['contactNumber', 'password']);
    if (!fieldValidation.isValid) {
      return res.status(400).json(fieldValidation.error);
    }

    const user = await findUser({ contactNumber }, userType);
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

    // Check if account is not active
    if (user.accountStatus !== 'active') {
      return res.status(403).json({
        errorCode: ERROR_CODES.ACCOUNT_NOT_ACTIVE.code,
        message: ERROR_CODES.ACCOUNT_NOT_ACTIVE.message
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

    // Generate token with 7 days expiration
    const tokenExpiresIn = '7d';
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: tokenExpiresIn
    });

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    // Save token in the database
    await user.addToken(token, expiresAt);

    res.json({
      token,
      user: {
        //id: user._id,
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
}

// Login for students (dedicated endpoint)
router.post('/login', async (req, res) => {
  await handleLogin(req, res, 'student');
});

// Login for other user types
router.post('/:userType/login', async (req, res) => {
  await handleLogin(req, res, req.params.userType);
});

// Common function for handling password reset requests
async function handlePasswordResetRequest(req, res, userType) {
  try {
    const { contactNumber } = req.body;
    const fieldValidation = validateRequiredFields(req.body, ['contactNumber']);
    if (!fieldValidation.isValid) {
      return res.status(400).json(fieldValidation.error);
    }

    const user = await findUser({ contactNumber }, userType);
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

    // Check if account is not active
    if (user.accountStatus !== 'active') {
      return res.status(403).json({
        errorCode: ERROR_CODES.ACCOUNT_NOT_ACTIVE.code,
        message: ERROR_CODES.ACCOUNT_NOT_ACTIVE.message
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
}

// Request Password Reset for Students (dedicated endpoint)
router.post('/request-reset-password', async (req, res) => {
  await handlePasswordResetRequest(req, res, 'student');
});

// Request Password Reset for other user types
router.post('/:userType/request-reset-password', async (req, res) => {
  const userType = req.params.userType;
  const validation = validateUserType(userType);
  if (!validation.isValid) {
    return res.status(400).json(validation.error);
  }
  
  await handlePasswordResetRequest(req, res, userType);
});

// Reset Password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, otp, newPassword } = req.body;
    const fieldValidation = validateRequiredFields(req.body, ['token', 'otp', 'newPassword']);
    if (!fieldValidation.isValid) {
      return res.status(400).json({
        errorCode: ERROR_CODES.MISSING_USER_ID_OTP_PASSWORD.code,
        message: ERROR_CODES.MISSING_USER_ID_OTP_PASSWORD.message
      });
    }

    // Find user by ID without specifying role
    const user = await User.findById(token);
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

// Validate Token
router.post('/validate-token', async (req, res) => {
  try {
    const { token } = req.body; // Extract token from request body

    // Validate required fields
    if (!token) {
      return res.status(400).json({
        errorCode: ERROR_CODES.MISSING_FIELDS.code,
        message: 'Token is required'
      });
    }

    // Verify the token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      // Handle token verification errors
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          errorCode: ERROR_CODES.INVALID_TOKEN.code,
          message: ERROR_CODES.INVALID_TOKEN.message
        });
      }
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          errorCode: ERROR_CODES.TOKEN_EXPIRED.code,
          message: ERROR_CODES.TOKEN_EXPIRED.message
        });
      }
      throw error; // Re-throw other errors
    }
    
    // Find user by ID
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({
        errorCode: ERROR_CODES.USER_NOT_FOUND.code,
        message: ERROR_CODES.USER_NOT_FOUND.message
      });
    }
    
    // Check if token is active in the database
    if (!user.isTokenActive(token)) {
      return res.status(401).json({
        errorCode: ERROR_CODES.INVALID_TOKEN.code,
        message: 'Token has been invalidated'
      });
    }
    
    // If verification is successful, return the user ID and role
    res.json({ 
      userId: decoded.userId,
      role: user.role
    });
  } catch (error) {
    // Handle token verification errors
    res.status(500).json({
      errorCode: ERROR_CODES.INTERNAL_SERVER_ERROR.code,
      message: ERROR_CODES.INTERNAL_SERVER_ERROR.message,
      error: error.message
    });
  }
});

// Logout route
router.post('/logout', auth, async (req, res) => {
  try {
    const token = req.token;
    const user = req.user;
    
    // Deactivate the token in the database
    const deactivated = await user.deactivateToken(token);
    
    if (!deactivated) {
      return res.status(400).json({
        errorCode: ERROR_CODES.INTERNAL_SERVER_ERROR.code,
        message: 'Token not found or already deactivated'
      });
    }
    
    res.status(200).json({ 
      message: 'Logged out successfully',
      userId: user._id
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      errorCode: ERROR_CODES.INTERNAL_SERVER_ERROR.code,
      message: ERROR_CODES.INTERNAL_SERVER_ERROR.message,
      error: error.message 
    });
  }
});

module.exports = router; 
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const ERROR_CODES = require('./error');
const jwt = require('jsonwebtoken');

// Get user profile
router.get('/getProfile', async (req, res) => {
  await getUserProfile(req, res, "student");
});

router.get('/:userType/getProfile', async (req, res) => {
  const userType = req.params.userType;
  const validUserTypes = ["student", "teacher", "shop_admin", "host_admin"];

  if (validUserTypes.includes(userType)) {
    await getUserProfile(req, res, userType);
  } else {
    res.status(400).send({ error: "Invalid user type" });
  }
});

async function getUserProfile(req, res,type){
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        errorCode: ERROR_CODES.MISSING_FIELDS.code,
        message: 'Authentication token is required'
      });
    }

    // Verify the token directly
    let userId;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.userId;
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
    const user = await User.findById(userId).select('-password -otp -loginFailCount -verifyOtpCount -resetFailCount');
    
    if (!user) {
      return res.status(404).json({
        errorCode: ERROR_CODES.USER_NOT_FOUND.code,
        message: ERROR_CODES.USER_NOT_FOUND.message
      });
    }
    if (type != user.role){
      return res.status(404).json({
        errorCode: ERROR_CODES.INTERNAL_SERVER_ERROR.code,
        message: ERROR_CODES.INTERNAL_SERVER_ERROR.message,
      });
    }

    // Check if token is active in the database
    if (!user.isTokenActive(token)) {
      return res.status(401).json({
        errorCode: ERROR_CODES.INVALID_TOKEN.code,
        message: 'Token has been invalidated'
      });
    }

    // Check if the user is verified
    if (!user.isVerified) {
      return res.status(403).json({
        errorCode: ERROR_CODES.UNVERIFIED_USER.code,
        message: ERROR_CODES.UNVERIFIED_USER.message
      });
    }

    res.json({
      user: {
        //id: user._id,
        name: user.name,
        contactNumber: user.contactNumber,
        role: user.role,
        student: user.student,
        isVerified: user.isVerified,
        createdAt: user.createdAt
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

module.exports = router; 
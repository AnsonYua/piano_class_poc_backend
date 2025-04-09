// errors.js
module.exports = {
    MISSING_FIELDS: {
      code: 'MISSING_FIELDS',
      message: 'Contact number, password, and name are required'
    },
    MISSING_USER_ID_OTP: {
      code: 'MISSING_USER_ID_OTP',
      message: 'User ID and OTP are required'
    },
    MISSING_USER_ID_OTP_PASSWORD: {
      code: 'MISSING_USER_ID_OTP_PASSWORD',
      message: 'User ID, OTP, and new password are required'
    },
    INVALID_STUDENT_ARRAY: {
      code: 'INVALID_STUDENT_ARRAY',
      message: 'Student array must contain 1-10 objects'
    },
    INVALID_STUDENT_DATA: {
      code: 'INVALID_STUDENT_DATA',
      message: 'Each student must have a name and age'
    },
    INVALID_STUDENT_AGE: {
      code: 'INVALID_STUDENT_AGE',
      message: 'Student age must be a valid positive number'
    },
    STUDENT_AGE_TOO_LOW: {
      code: 'STUDENT_AGE_TOO_LOW',
      message: 'Student age must be greater than 5'
    },
    USER_ALREADY_EXISTS: {
      code: 'USER_ALREADY_EXISTS',
      message: 'User with this contact number already exists and is verified'
    },
    INTERNAL_SERVER_ERROR: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Error creating user'
    },
    INVALID_CREDENTIALS: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid contact number or password'
    },
    TOO_MANY_ATTEMPTS: {
        code: 'TOO_MANY_ATTEMPTS',
        message: 'Too many signup attempts. Please try again later.'
    },
    USER_NOT_FOUND: {
        code: 'USER_NOT_FOUND',
        message: 'User not found'
    },
    ALREADY_VERIFIED: {
        code: 'ALREADY_VERIFIED',
        message: 'Contact number already verified'
    },
    INVALID_OTP: {
        code: 'INVALID_OTP',
        message: 'Invalid OTP'
    },
    OTP_EXPIRED: {
        code: 'OTP_EXPIRED',
        message: 'OTP has expired'
    },
    TOO_MANY_OTP_ATTEMPTS: {
        code: 'TOO_MANY_OTP_ATTEMPTS',
        message: 'Too many OTP verification attempts. Please try again later.'
    },
    TOO_MANY_RESET_ATTEMPTS: {
        code: 'TOO_MANY_RESET_ATTEMPTS',
        message: 'Too many password reset attempts. Please try again later.'
    },
    UNVERIFIED_USER: {
        code: 'UNVERIFIED_USER',
        message: 'Please verify your contact number first'
    },
    INVALID_ROLE: {
        code: 'INVALID_ROLE',
        message: 'Invalid role'
    },
    OTP_TOO_RECENT: {
        code: 'OTP_TOO_RECENT',
        message: 'Please wait before requesting a new OTP'
    },
    INVALID_TOKEN: {
        code: 'INVALID_TOKEN',
        message: 'Invalid token'
    },
    TOKEN_EXPIRED: {
        code: 'TOKEN_EXPIRED',
        message: 'Token has expired'
    },
    ACCOUNT_NOT_ACTIVE: {
        code: 'ACCOUNT_NOT_ACTIVE',
        message: 'Your account is not active. Please contact support.'
    }
};
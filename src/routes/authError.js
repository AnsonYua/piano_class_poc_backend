// errors.js
module.exports = {
    MISSING_FIELDS: {
      code: 'MISSING_FIELDS',
      message: 'Contact number, password, and name are required'
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
    }
  };
const studioStatusService = require('../services/studioStatusService');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

// Public routes
exports.checkAvailability = catchAsync(async (req, res, next) => {
    const { studioId, startTime, endTime } = req.query;
    
    if (!studioId || !startTime || !endTime) {
        return next(new AppError('Please provide studioId, startTime, and endTime', 400));
    }
    
    const isAvailable = await studioStatusService.checkAvailability(
        studioId,
        new Date(startTime),
        new Date(endTime)
    );
    
    res.status(200).json({
        status: 'success',
        data: { isAvailable }
    });
});

exports.getAvailableTimeSlots = catchAsync(async (req, res, next) => {
    const { studioId, date } = req.query;
    
    if (!studioId || !date) {
        return next(new AppError('Please provide studioId and date', 400));
    }
    
    const timeSlots = await studioStatusService.getAvailableTimeSlots(
        studioId,
        new Date(date)
    );
    
    res.status(200).json({
        status: 'success',
        data: { timeSlots }
    });
});

// User routes
exports.createStatus = catchAsync(async (req, res, next) => {
    const { studioId, startTime, endTime, reason } = req.body;
    
    if (!studioId || !startTime || !endTime) {
        return next(new AppError('Please provide studioId, startTime, and endTime', 400));
    }
    
    const status = await studioStatusService.createStudioStatus(
        studioId,
        req.user.id,
        new Date(startTime),
        new Date(endTime),
        reason
    );
    
    res.status(201).json({
        status: 'success',
        data: { status }
    });
});

exports.getMyStatusEntries = catchAsync(async (req, res) => {
    const statusEntries = await studioStatusService.getMyStatusEntries(req.user.id);
    
    res.status(200).json({
        status: 'success',
        data: { statusEntries }
    });
});

exports.getStatusById = catchAsync(async (req, res, next) => {
    const status = await studioStatusService.getStatusById(req.params.id);
    
    res.status(200).json({
        status: 'success',
        data: { status }
    });
});

exports.updateStatus = catchAsync(async (req, res, next) => {
    const { status } = req.body;
    
    if (!status) {
        return next(new AppError('Please provide the new status', 400));
    }
    
    const updatedStatus = await studioStatusService.updateStatusStatus(
        req.params.id,
        req.user.id,
        status
    );
    
    res.status(200).json({
        status: 'success',
        data: { status: updatedStatus }
    });
});

// Admin routes
exports.getStatusByStudio = catchAsync(async (req, res, next) => {
    const { studioId } = req.params;
    
    if (!studioId) {
        return next(new AppError('Please provide studioId', 400));
    }
    
    const statusEntries = await studioStatusService.getStatusByStudio(studioId);
    
    res.status(200).json({
        status: 'success',
        data: { statusEntries }
    });
});

exports.blockTimeSlot = catchAsync(async (req, res, next) => {
    const { studioId, startTime, endTime, reason } = req.body;
    
    if (!studioId || !startTime || !endTime) {
        return next(new AppError('Please provide studioId, startTime, and endTime', 400));
    }
    
    const blockedStatus = await studioStatusService.blockTimeSlot(
        studioId,
        new Date(startTime),
        new Date(endTime),
        reason
    );
    
    res.status(201).json({
        status: 'success',
        data: { status: blockedStatus }
    });
}); 
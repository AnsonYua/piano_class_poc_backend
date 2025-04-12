const StudioStatus = require('../models/StudioStatus');
const { BadRequestError, NotFoundError, AppError } = require('../utils/errors');

class StudioStatusService {
    // Create a new studio status entry or update existing one
    async createOrUpdateStatus(data) {
        const { studioId, roomId, date, timeSlotSection, sectionDescription, userId, status = 'pending' } = data;
        
        // Check if a record with the same details already exists
        const existingRecord = await StudioStatus.findOne({
            studioId,
            roomId,
            date,
            timeSlotSection
        });

        if (existingRecord) {
            // Update the existing record with new data
            existingRecord.sectionDescription = sectionDescription;
            existingRecord.userId = userId;
            existingRecord.status = status;
            return await existingRecord.save();
        }
        
        // Check if the time slot is available
        const isAvailable = await this.checkAvailability(studioId, date, timeSlotSection);
        if (!isAvailable) {
            throw new BadRequestError('Time slot is not available');
        }
        
        const studioStatus = new StudioStatus({
            studioId,
            roomId,
            date,
            timeSlotSection,
            sectionDescription,
            userId,
            status
        });
        
        return await studioStatus.save();
    }
    
    // Get all status entries for a studio
    async getStatusByStudio(studioId) {
        return await StudioStatus.find({ studioId })
            .populate('userId', 'name email')
            .sort({ date: 1, timeSlotSection: 1 });
    }
    
    // Get all status entries for a room
    async getStatusByRoom(roomId) {
        return await StudioStatus.find({ roomId })
            .populate('userId', 'name email')
            .populate('studioId', 'name')
            .sort({ date: 1, timeSlotSection: 1 });
    }
    
    // Get all status entries for a user
    async getMyStatusEntries(userId) {
        return await StudioStatus.find({ userId })
            .populate('studioId', 'name')
            .populate('roomId', 'name')
            .sort({ date: 1, timeSlotSection: 1 });
    }
    
    // Get a single status entry by ID
    async getStatusById(id) {
        const status = await StudioStatus.findById(id)
            .populate('userId', 'name email')
            .populate('studioId', 'name')
            .populate('roomId', 'name');
            
        if (!status) {
            throw new NotFoundError('Studio status entry not found');
        }
        
        return status;
    }
    
    // Update a status entry
    async updateStatusStatus(id, status) {
        const studioStatus = await StudioStatus.findById(id);
        
        if (!studioStatus) {
            throw new NotFoundError('Studio status entry not found');
        }
        
        studioStatus.status = status;
        return await studioStatus.save();
    }
    
    // Check if a time slot is available
    async checkAvailability(studioId, date, timeSlotSection) {
        const conflictingBookings = await StudioStatus.find({
            studioId,
            date,
            timeSlotSection,
            status: { $in: ['confirmed', 'blocked'] }
        });
        
        return conflictingBookings.length === 0;
    }
    
    // Get available time slots for a studio on a specific date
    async getAvailableTimeSlots(studioId, date) {
        const bookedSlots = await StudioStatus.find({
            studioId,
            date,
            status: { $in: ['confirmed', 'blocked'] }
        });
        
        // Get all booked time slot sections
        const bookedSections = bookedSlots.map(booking => booking.timeSlotSection);
        
        // Get all existing time slot sections from the database
        const allSections = await StudioStatus.distinct('timeSlotSection', { studioId });
        
        // If no sections exist yet, return an empty array
        if (allSections.length === 0) {
            return [];
        }
        
        // Filter out booked sections
        const availableSections = allSections.filter(section => !bookedSections.includes(section));
        
        return availableSections.map(section => ({
            timeSlotSection: section,
            description: section // Use the section name as description if not provided
        }));
    }
    
    // Block a time slot (admin function)
    async blockTimeSlot(data) {
        const { studioId, roomId, date, timeSlotSection, sectionDescription, reason } = data;
        
        // Check if the time slot is available
        const isAvailable = await this.checkAvailability(studioId, date, timeSlotSection);
        if (!isAvailable) {
            throw new BadRequestError('Time slot is not available');
        }
        
        const studioStatus = new StudioStatus({
            studioId,
            roomId,
            date,
            timeSlotSection,
            sectionDescription,
            status: 'blocked',
            reason
        });
        
        return await studioStatus.save();
    }
}

module.exports = new StudioStatusService(); 
const StudioStatus = require('../models/StudioStatus');
const { BadRequestError, NotFoundError, AppError } = require('../utils/errors');
const { formatToUTC8ISOString } = require('../utils/dateUtils');

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
        const statusEntries = await StudioStatus.find({ studioId })
            .populate('userId', 'name email')
            .sort({ date: 1, timeSlotSection: 1 });
            
        // Format dates to UTC+8
        return statusEntries.map(entry => {
            const entryObj = entry.toObject();
            entryObj.date = formatToUTC8ISOString(entryObj.date);
            entryObj.createdAt = formatToUTC8ISOString(entryObj.createdAt);
            entryObj.updatedAt = formatToUTC8ISOString(entryObj.updatedAt);
            return entryObj;
        });
    }
    
    // Get all status entries for a room
    async getStatusByRoom(roomId) {
        const statusEntries = await StudioStatus.find({ roomId })
            .populate('userId', 'name email')
            .populate('studioId', 'name')
            .sort({ date: 1, timeSlotSection: 1 });
            
        // Group by studio
        const studiosMap = {};
        
        statusEntries.forEach(entry => {
            const studioId = entry.studioId._id.toString();
            
            if (!studiosMap[studioId]) {
                studiosMap[studioId] = {
                    _id: studioId,
                    name: entry.studioId.name,
                    statusEntries: []
                };
            }
            
            // Format the date in UTC+8
            const formattedDate = formatToUTC8ISOString(entry.date);
            
            // Find if an entry with this date already exists
            let dateEntry = studiosMap[studioId].statusEntries.find(
                se => se.date === formattedDate
            );
            
            // If no entry exists for this date, create one
            if (!dateEntry) {
                dateEntry = {
                    date: formattedDate,
                    slot: []
                };
                studiosMap[studioId].statusEntries.push(dateEntry);
            }
            
            // Add the slot to the date entry
            dateEntry.slot.push({
                timeSlotSection: entry.timeSlotSection,
                sectionDescription: entry.sectionDescription,
                status: entry.status,
                createdAt: formatToUTC8ISOString(entry.createdAt),
                updatedAt: formatToUTC8ISOString(entry.updatedAt),
                modifiedBy: {
                    id: entry.userId._id,
                    name: entry.userId.name,
                    modifiedAt: formatToUTC8ISOString(entry.updatedAt)
                }
            });
        });
        
        // Convert to array format
        const studios = Object.values(studiosMap);
        
        return {
            roomId,
            studios
        };
    }
    
    // Get all status entries for a user
    async getMyStatusEntries(userId) {
        const statusEntries = await StudioStatus.find({ userId })
            .populate('studioId', 'name')
            .populate('roomId', 'name')
            .sort({ date: 1, timeSlotSection: 1 });
            
        // Format dates to UTC+8
        return statusEntries.map(entry => {
            const entryObj = entry.toObject();
            entryObj.date = formatToUTC8ISOString(entryObj.date);
            entryObj.createdAt = formatToUTC8ISOString(entryObj.createdAt);
            entryObj.updatedAt = formatToUTC8ISOString(entryObj.updatedAt);
            return entryObj;
        });
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
        
        // Format dates to UTC+8
        const statusObj = status.toObject();
        statusObj.date = formatToUTC8ISOString(statusObj.date);
        statusObj.createdAt = formatToUTC8ISOString(statusObj.createdAt);
        statusObj.updatedAt = formatToUTC8ISOString(statusObj.updatedAt);
        
        return statusObj;
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

    // Batch update or create multiple status entries
    async batchUpdateStatus(updates, userId) {
        if (!Array.isArray(updates) || updates.length === 0) {
            throw new BadRequestError('Updates must be a non-empty array');
        }

        // Prepare query to find all existing records in one go
        const queryConditions = updates.map(update => ({
            studioId: update.studioId,
            roomId: update.roomId,
            date: new Date(update.date),
            timeSlotSection: update.timeSlotSection
        }));

        // Find all existing records in a single query
        const existingRecords = await StudioStatus.find({
            $or: queryConditions
        });

        // Create a map for quick lookup
        const existingRecordsMap = {};
        existingRecords.forEach(record => {
            // Use UTC+8 formatted date for the key
            const key = `${record.studioId}-${record.roomId}-${formatToUTC8ISOString(record.date)}-${record.timeSlotSection}`;
            existingRecordsMap[key] = record;
        });

        // Prepare bulk operations
        const bulkOps = [];
        const skippedCount = { exact: 0, noChange: 0 };
        let deleteCount = 0;
        
        for (const update of updates) {
            const { studioId, roomId, date, timeSlotSection, sectionDescription, status } = update;
            // Use UTC+8 formatted date for the key

            const key = `${studioId}-${roomId}-${formatToUTC8ISOString(new Date(date))}-${timeSlotSection}`;
            
            if (existingRecordsMap[key]) {
                const existingRecord = existingRecordsMap[key];
                
                if (status === 'delete') {
                    // Prepare delete operation
                    bulkOps.push({
                        deleteOne: {
                            filter: { _id: existingRecord._id }
                        }
                    });
                    deleteCount++;
                    continue;
                }
                
                // Check if the record is exactly the same
                const isExactMatch = 
                    existingRecord.sectionDescription === sectionDescription &&
                    existingRecord.userId.toString() === userId.toString() &&
                    existingRecord.status === (status || 'pending');
                
                if (isExactMatch) {
                    // Skip if the record is exactly the same
                    skippedCount.exact++;
                    continue;
                }
                
                // Update existing record
                bulkOps.push({
                    updateOne: {
                        filter: { _id: existingRecord._id },
                        update: {
                            $set: {
                                sectionDescription,
                                userId,
                                status: status || 'pending'
                            }
                        }
                    }
                });
            } else {
                console.log(JSON.stringify(update));
                if(update.remark) {
                    console.log(update.remark);
                    console.log(update.studentId);
                    bulkOps.push({
                        insertOne: {
                            document: {
                                studioId,
                                roomId,
                                date: new Date(date),
                                timeSlotSection,
                                sectionDescription,
                                userId,
                                status: status || 'pending',
                                remark: update.remark,
                                studentId: update.studentId
                            }
                        }
                    });
                }else{
                    // Create new record
                    bulkOps.push({
                        insertOne: {
                            document: {
                                studioId,
                                roomId,
                                date: new Date(date),
                                timeSlotSection,
                                sectionDescription,
                                userId,
                                status: status || 'pending'
                            }
                        }
                    });
                }
            }
        }

        // Execute bulk operations
        let result = { modifiedCount: 0, upsertedCount: 0 };
        if (bulkOps.length > 0) {
            result = await StudioStatus.bulkWrite(bulkOps);
        }

        // Add skipped counts and delete count to the result
        return {
            ...result,
            skippedCount,
            deleteCount
        };
    }
}

module.exports = new StudioStatusService(); 
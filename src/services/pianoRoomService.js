const PianoRoom = require('../models/PianoRoom');
const PianoStudio = require('../models/PianoStudio');
const StudioStatus = require('../models/StudioStatus');
const { formatToUTC8ISOString } = require('../utils/dateUtils');

const pianoRoomService = {
    // Get all piano rooms for an admin
    async getPianoRoomsByAdmin(adminId) {
        try {
            const pianoRooms = await PianoRoom.find({ adminId })
                .populate('studios')
                .sort({ createdAt: 1 });
                
            // Convert to plain objects to apply the toJSON transform
            const processedPianoRooms = pianoRooms.map(room => {
                // Convert to plain object with virtuals
                const roomObj = room.toObject();
                
                // Process studios if they exist
                if (roomObj.studios && roomObj.studios.length > 0) {
                    roomObj.studios = roomObj.studios.map(studio => {
                        // Convert to plain object with virtuals
                        const studioObj = studio.toObject ? studio.toObject() : studio;
                        
                        // Explicitly remove the id field if it exists
                        if (studioObj.id) {
                            delete studioObj.id;
                        }
                        
                        return studioObj;
                    });
                }
                
                // Explicitly remove the id field if it exists
                if (roomObj.id) {
                    delete roomObj.id;
                }
                
                return roomObj;
            });
            
            return processedPianoRooms;
        } catch (error) {
            throw new Error('Error fetching piano rooms: ' + error.message);
        }
    },

    // Create a new piano room
    async createPianoRoom(pianoRoomData) {
        try {
            const pianoRoom = new PianoRoom(pianoRoomData);
            await pianoRoom.save();
            
            // Create the specified number of studios for this piano room
            const studios = [];
            for (let i = 0; i < pianoRoomData.roomCount; i++) {
                const studio = new PianoStudio({
                    name: `Studio ${i + 1}`,
                    pianoRoomId: pianoRoom._id,
                    description: `Studio ${i + 1} of ${pianoRoomData.name}`
                });
                await studio.save();
                studios.push(studio._id);
            }
            
            // Update the piano room with the created studios
            pianoRoom.studios = studios;
            await pianoRoom.save();
            
            return pianoRoom;
        } catch (error) {
            throw new Error('Error creating piano room: ' + error.message);
        }
    },

    // Get a single piano room by ID
    async getPianoRoomById(id) {
        try {
            const pianoRoom = await PianoRoom.findById(id)
                .populate({
                    path: 'studios',
                    populate: {
                        path: 'statusEntries',
                        model: 'StudioStatus'
                    }
                });
                
            if (!pianoRoom) {
                throw new Error('Piano room not found');
            }
            
            // Process the studios to format status information by date
            const processedStudios = pianoRoom.studios.map(studio => {
                // Convert to plain object with virtuals
                const studioObj = studio.toObject();
                
                // Explicitly remove the id field if it exists
                if (studioObj.id) {
                    delete studioObj.id;
                }
                
                // Group status entries by date
                const statusByDate = {};
                
                if (studio.statusEntries && studio.statusEntries.length > 0) {
                    studio.statusEntries.forEach(status => {
                        // Format date to UTC+8
                        const dateStr = formatToUTC8ISOString(status.startTime).split('T')[0]; // Format: YYYY-MM-DD
                        
                        if (!statusByDate[dateStr]) {
                            statusByDate[dateStr] = {
                                date: dateStr,
                                slots: []
                            };
                        }
                        
                        statusByDate[dateStr].slots.push({
                            startTime: formatToUTC8ISOString(status.startTime),
                            endTime: formatToUTC8ISOString(status.endTime),
                            status: status.status,
                            statusId: status._id
                        });
                    });
                }
                
                // Convert to array format
                studioObj.statusEntries = Object.values(statusByDate);
                
                return studioObj;
            });
            
            // Convert pianoRoom to plain object with virtuals
            const pianoRoomObj = pianoRoom.toObject();
            
            // Explicitly remove the id field if it exists
            if (pianoRoomObj.id) {
                delete pianoRoomObj.id;
            }
            
            // Replace the studios with the processed version
            pianoRoomObj.studios = processedStudios;
            
            return pianoRoomObj;
        } catch (error) {
            throw new Error('Error fetching piano room: ' + error.message);
        }
    },
    
    // Get a single studio by ID
    async getStudioById(id) {
        try {
            const studio = await PianoStudio.findById(id);
            if (!studio) {
                throw new Error('Studio not found');
            }
            
            // Convert to plain object with virtuals
            const studioObj = studio.toObject();
            
            // Explicitly remove the id field if it exists
            if (studioObj.id) {
                delete studioObj.id;
            }
            
            return studioObj;
        } catch (error) {
            throw new Error('Error fetching studio: ' + error.message);
        }
    },

    // Check room availability based on district, section, and date
    async checkRoomAvailability(district, section, date) {
        try {
            // First, find all piano rooms in the specified district
            const pianoRooms = await PianoRoom.find({ district });
            
            if (!pianoRooms || pianoRooms.length === 0) {
                return []; // Case 2: No rooms found in the district
            }
            
            // Get all studio IDs from these piano rooms
            const studioIds = pianoRooms.flatMap(room => room.studios);
            
            // Check for section0 records for the given date
            const section0Records = await StudioStatus.find({
                studioId: { $in: studioIds },
                date: new Date(date),
                timeSlotSection: 'section0'
            });
            
            // Check for records with the requested section for the given date
            const sectionRecords = await StudioStatus.find({
                studioId: { $in: studioIds },
                date: new Date(date),
                timeSlotSection: section
            });
            
            // If there are no section0 records at all, return empty array (Case 3)
            if (section0Records.length === 0) {
                return [];
            }
            
            // Process each piano room separately
            const availableRooms = [];
            
            for (const room of pianoRooms) {
                const roomStudioIds = room.studios.map(id => id.toString());
                
                // Check if this room has section0 records
                const roomHasSection0 = section0Records.some(record => 
                    roomStudioIds.includes(record.studioId.toString())
                );
                
                // Check if this room has section records
                const roomHasSection = sectionRecords.some(record => 
                    roomStudioIds.includes(record.studioId.toString())
                );
                
                // If room has section0 but no section records, it's available
                if (roomHasSection0 && !roomHasSection) {
                    availableRooms.push(room);
                }
            }
            
            return availableRooms;
        } catch (error) {
            throw new Error('Error checking room availability: ' + error.message);
        }
    }
};

module.exports = pianoRoomService; 
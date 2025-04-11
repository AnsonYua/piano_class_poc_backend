const PianoRoom = require('../models/PianoRoom');
const PianoStudio = require('../models/PianoStudio');

const pianoRoomService = {
    // Get all piano rooms for an admin
    async getPianoRoomsByAdmin(adminId) {
        try {
            const pianoRooms = await PianoRoom.find({ adminId })
                .populate('studios')
                .sort({ createdAt: -1 });
            return pianoRooms;
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
            const pianoRoom = await PianoRoom.findById(id).populate('studios');
            if (!pianoRoom) {
                throw new Error('Piano room not found');
            }
            return pianoRoom;
        } catch (error) {
            throw new Error('Error fetching piano room: ' + error.message);
        }
    }
};

module.exports = pianoRoomService; 
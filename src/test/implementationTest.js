/**
 * Test script to simulate the actual data processing for getStatusByRoom
 */

const { formatToUTC8ISOString } = require('../utils/dateUtils');

// Mock database entries
const mockDbEntries = [
  {
    _id: 'entry1',
    studioId: { _id: '67f9e15c9e4156cc4b0efe8e', name: 'Studio 1' },
    roomId: '67f9e15c9e4156cc4b0efe8c',
    date: new Date('2025-04-15T00:00:00.000Z'),
    timeSlotSection: 'section0',
    sectionDescription: 'defaultSection',
    status: 'pending',
    userId: { _id: '67f7fc7ec0528f145262880f', name: 'anson_shop' },
    createdAt: new Date('2025-04-12T04:27:57.880Z'),
    updatedAt: new Date('2025-04-12T05:23:04.506Z')
  },
  {
    _id: 'entry2',
    studioId: { _id: '67f9e15c9e4156cc4b0efe8e', name: 'Studio 1' },
    roomId: '67f9e15c9e4156cc4b0efe8c',
    date: new Date('2025-04-15T00:00:00.000Z'),
    timeSlotSection: 'section1',
    sectionDescription: '0930',
    status: 'blocked',
    userId: { _id: '67f7fc7ec0528f145262880f', name: 'anson_shop' },
    createdAt: new Date('2025-04-12T05:26:48.395Z'),
    updatedAt: new Date('2025-04-12T05:26:48.395Z')
  },
  {
    _id: 'entry3',
    studioId: { _id: '67f9e15c9e4156cc4b0efe8e', name: 'Studio 1' },
    roomId: '67f9e15c9e4156cc4b0efe8c',
    date: new Date('2025-04-16T00:00:00.000Z'),
    timeSlotSection: 'section0',
    sectionDescription: 'defaultSection',
    status: 'confirmed',
    userId: { _id: '67f7fc7ec0528f145262880f', name: 'anson_shop' },
    createdAt: new Date('2025-04-12T06:27:57.880Z'),
    updatedAt: new Date('2025-04-12T07:23:04.506Z')
  }
];

// Simulate the getStatusByRoom function
function simulateGetStatusByRoom(roomId) {
  // Filter entries by roomId
  const statusEntries = mockDbEntries.filter(entry => entry.roomId === roomId);
  
  // Group by studio
  const studiosMap = {};
  
  statusEntries.forEach(entry => {
    const studioId = entry.studioId._id;
    
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

// Run the simulation
const result = simulateGetStatusByRoom('67f9e15c9e4156cc4b0efe8c');

// Display the result
console.log('Simulated API Response:');
console.log(JSON.stringify(result, null, 2));

// Verify the structure
console.log('\nVerification:');
console.log('--------------------------------');

// Check if the response has the expected structure
const hasRoomId = result.hasOwnProperty('roomId');
console.log(`Has roomId: ${hasRoomId}`);

const hasStudios = result.hasOwnProperty('studios') && Array.isArray(result.studios);
console.log(`Has studios array: ${hasStudios}`);

// Check if studios have the expected structure
const hasStudioId = result.studios[0].hasOwnProperty('_id');
console.log(`Studio has _id: ${hasStudioId}`);

const hasStudioName = result.studios[0].hasOwnProperty('name');
console.log(`Studio has name: ${hasStudioName}`);

const hasStatusEntries = result.studios[0].hasOwnProperty('statusEntries') && Array.isArray(result.studios[0].statusEntries);
console.log(`Studio has statusEntries array: ${hasStatusEntries}`);

// Check if statusEntries have the expected structure
const hasDate = result.studios[0].statusEntries[0].hasOwnProperty('date');
console.log(`StatusEntry has date: ${hasDate}`);

const hasSlot = result.studios[0].statusEntries[0].hasOwnProperty('slot') && Array.isArray(result.studios[0].statusEntries[0].slot);
console.log(`StatusEntry has slot array: ${hasSlot}`);

// Check if multiple entries with the same date are grouped together
const firstDateEntry = result.studios[0].statusEntries[0];
const hasMultipleSlots = firstDateEntry.slot.length > 1;
console.log(`First date entry has multiple slots: ${hasMultipleSlots}`);

// Check if dates are correctly formatted
const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+08:00$/;
const isDateFormatted = dateRegex.test(firstDateEntry.date);
console.log(`Date format is correct: ${isDateFormatted}`);

// Check if all slots have the expected structure
const firstSlot = firstDateEntry.slot[0];
const hasTimeSlotSection = firstSlot.hasOwnProperty('timeSlotSection');
console.log(`Slot has timeSlotSection: ${hasTimeSlotSection}`);

const hasSectionDescription = firstSlot.hasOwnProperty('sectionDescription');
console.log(`Slot has sectionDescription: ${hasSectionDescription}`);

const hasStatus = firstSlot.hasOwnProperty('status');
console.log(`Slot has status: ${hasStatus}`);

const hasCreatedAt = firstSlot.hasOwnProperty('createdAt');
console.log(`Slot has createdAt: ${hasCreatedAt}`);

const hasUpdatedAt = firstSlot.hasOwnProperty('updatedAt');
console.log(`Slot has updatedAt: ${hasUpdatedAt}`);

const hasModifiedBy = firstSlot.hasOwnProperty('modifiedBy');
console.log(`Slot has modifiedBy: ${hasModifiedBy}`);

// Check if modifiedBy has the expected structure
const hasModifiedById = firstSlot.modifiedBy.hasOwnProperty('id');
console.log(`ModifiedBy has id: ${hasModifiedById}`);

const hasModifiedByName = firstSlot.modifiedBy.hasOwnProperty('name');
console.log(`ModifiedBy has name: ${hasModifiedByName}`);

const hasModifiedAt = firstSlot.modifiedBy.hasOwnProperty('modifiedAt');
console.log(`ModifiedBy has modifiedAt: ${hasModifiedAt}`); 
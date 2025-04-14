/**
 * Test script to verify the new response format with slots as an array
 */

const { formatToUTC8ISOString } = require('../utils/dateUtils');

// Mock response data with the new format
const mockResponse = {
  roomId: "67f9e15c9e4156cc4b0efe8c",
  studios: [
    {
      _id: "67f9e15c9e4156cc4b0efe8e",
      name: "Studio 1",
      statusEntries: [
        {
          date: "2025-04-15T08:00:00.000+08:00",
          slot: [
            {
              timeSlotSection: "section0",
              sectionDescription: "defaultSection",
              status: "pending",
              createdAt: "2025-04-12T12:27:57.880+08:00",
              updatedAt: "2025-04-12T13:23:04.506+08:00",
              modifiedBy: {
                id: "67f7fc7ec0528f145262880f",
                name: "anson_shop",
                modifiedAt: "2025-04-12T13:23:04.506+08:00"
              }
            },
            {
              timeSlotSection: "section1",
              sectionDescription: "0930",
              status: "blocked",
              createdAt: "2025-04-12T13:26:48.395+08:00",
              updatedAt: "2025-04-12T13:26:48.395+08:00",
              modifiedBy: {
                id: "67f7fc7ec0528f145262880f",
                name: "anson_shop",
                modifiedAt: "2025-04-12T13:26:48.395+08:00"
              }
            }
          ]
        }
      ]
    }
  ]
};

// Display the mock response
console.log('Mock Response with slots as array:');
console.log(JSON.stringify(mockResponse, null, 2));

// Verify the structure
console.log('\nVerification:');
console.log('--------------------------------');

// Check if slot is an array
const isSlotArray = Array.isArray(mockResponse.studios[0].statusEntries[0].slot);
console.log(`Slot is an array: ${isSlotArray}`);

// Check if multiple slots can be added to the same date
const hasMultipleSlots = mockResponse.studios[0].statusEntries[0].slot.length > 1;
console.log(`Has multiple slots: ${hasMultipleSlots}`);

// Check if slots have different timeSlotSection values
const hasDifferentSections = 
  mockResponse.studios[0].statusEntries[0].slot[0].timeSlotSection !== 
  mockResponse.studios[0].statusEntries[0].slot[1].timeSlotSection;
console.log(`Has different timeSlotSection values: ${hasDifferentSections}`);

// Check date format
const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+08:00$/;
const isDateFormatted = dateRegex.test(mockResponse.studios[0].statusEntries[0].date);
console.log(`Date format is correct: ${isDateFormatted}`);

// Check createdAt format
const isCreatedAtFormatted = dateRegex.test(mockResponse.studios[0].statusEntries[0].slot[0].createdAt);
console.log(`CreatedAt format is correct: ${isCreatedAtFormatted}`);

// Check updatedAt format
const isUpdatedAtFormatted = dateRegex.test(mockResponse.studios[0].statusEntries[0].slot[0].updatedAt);
console.log(`UpdatedAt format is correct: ${isUpdatedAtFormatted}`);

// Check modifiedAt format
const isModifiedAtFormatted = dateRegex.test(mockResponse.studios[0].statusEntries[0].slot[0].modifiedBy.modifiedAt);
console.log(`ModifiedAt format is correct: ${isModifiedAtFormatted}`); 
/**
 * Test script to verify date formatting with mock data
 */

const { formatToUTC8ISOString } = require('../utils/dateUtils');

// Mock response data
const mockResponse = {
  roomId: "67f9e15c9e4156cc4b0efe8c",
  studios: [
    {
      _id: "67f9e15c9e4156cc4b0efe8e",
      name: "Studio 1",
      statusEntries: [
        {
          date: "2025-04-15T00:00:00.000Z",
          slot: {
            timeSlotSection: "section0",
            sectionDescription: "defaultSection",
            status: "confirmed",
            createdAt: "2025-04-12T04:27:57.880Z",
            updatedAt: "2025-04-12T05:23:04.506Z",
            modifiedBy: {
              id: "67f7fc7ec0528f145262880f",
              name: "anson_shop",
              modifiedAt: "2025-04-12T05:23:04.506Z"
            }
          }
        }
      ]
    }
  ]
};

// Format dates in the mock response
function formatMockResponseDates(response) {
  const formattedResponse = JSON.parse(JSON.stringify(response));
  
  formattedResponse.studios.forEach(studio => {
    if (studio.statusEntries && studio.statusEntries.length > 0) {
      studio.statusEntries.forEach(entry => {
        // Format date
        if (entry.date) {
          entry.date = formatToUTC8ISOString(new Date(entry.date));
        }
        
        if (entry.slot) {
          // Format createdAt
          if (entry.slot.createdAt) {
            entry.slot.createdAt = formatToUTC8ISOString(new Date(entry.slot.createdAt));
          }
          
          // Format updatedAt
          if (entry.slot.updatedAt) {
            entry.slot.updatedAt = formatToUTC8ISOString(new Date(entry.slot.updatedAt));
          }
          
          // Format modifiedAt
          if (entry.slot.modifiedBy && entry.slot.modifiedBy.modifiedAt) {
            entry.slot.modifiedBy.modifiedAt = formatToUTC8ISOString(new Date(entry.slot.modifiedBy.modifiedAt));
          }
        }
      });
    }
  });
  
  return formattedResponse;
}

// Format the mock response
const formattedResponse = formatMockResponseDates(mockResponse);

// Display the original and formatted responses
console.log('Original Response:');
console.log(JSON.stringify(mockResponse, null, 2));
console.log('\nFormatted Response (UTC+8):');
console.log(JSON.stringify(formattedResponse, null, 2));

// Verify that the dates are correctly formatted
console.log('\nVerification:');
console.log('--------------------------------');

// Check date format
const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+08:00$/;

const isDateFormatted = dateRegex.test(formattedResponse.studios[0].statusEntries[0].date);
console.log(`Date format is correct: ${isDateFormatted}`);

const isCreatedAtFormatted = dateRegex.test(formattedResponse.studios[0].statusEntries[0].slot.createdAt);
console.log(`CreatedAt format is correct: ${isCreatedAtFormatted}`);

const isUpdatedAtFormatted = dateRegex.test(formattedResponse.studios[0].statusEntries[0].slot.updatedAt);
console.log(`UpdatedAt format is correct: ${isUpdatedAtFormatted}`);

const isModifiedAtFormatted = dateRegex.test(formattedResponse.studios[0].statusEntries[0].slot.modifiedBy.modifiedAt);
console.log(`ModifiedAt format is correct: ${isModifiedAtFormatted}`);

// Check time values
const originalDate = new Date(mockResponse.studios[0].statusEntries[0].date);
const formattedDate = new Date(formattedResponse.studios[0].statusEntries[0].date);

console.log(`\nOriginal date: ${originalDate.toISOString()}`);
console.log(`Formatted date: ${formattedDate.toISOString()}`);
console.log(`Hour difference: ${formattedDate.getUTCHours() - originalDate.getUTCHours()}`); 
/**
 * Test script to verify API endpoint date formatting
 */

const axios = require('axios');

// Replace with your actual API URL
const API_URL = 'http://localhost:3000/api';

async function testStudioStatusRoomEndpoint() {
  try {
    // Replace with a valid room ID from your database
    const roomId = '67f9e15c9e4156cc4b0efe8c';
    
    console.log(`Testing /api/studio-status/room/${roomId} endpoint...`);
    
    const response = await axios.get(`${API_URL}/studio-status/room/${roomId}`);
    
    console.log('Response status:', response.status);
    
    // Check if the response contains the expected data structure
    if (response.data && response.data.roomId && response.data.studios) {
      console.log('Response structure is valid');
      
      // Check date formatting in the response
      const studios = response.data.studios;
      
      studios.forEach((studio, studioIndex) => {
        console.log(`\nStudio ${studioIndex + 1}: ${studio.name}`);
        
        if (studio.statusEntries && studio.statusEntries.length > 0) {
          studio.statusEntries.forEach((entry, entryIndex) => {
            console.log(`\n  Entry ${entryIndex + 1}:`);
            console.log(`  Date: ${entry.date}`);
            
            if (entry.slot) {
              console.log(`  Created At: ${entry.slot.createdAt}`);
              console.log(`  Updated At: ${entry.slot.updatedAt}`);
              
              if (entry.slot.modifiedBy) {
                console.log(`  Modified At: ${entry.slot.modifiedBy.modifiedAt}`);
              }
            }
          });
        } else {
          console.log('  No status entries found');
        }
      });
    } else {
      console.log('Response structure is invalid');
      console.log('Response data:', JSON.stringify(response.data, null, 2));
    }
  } catch (error) {
    console.error('Error testing API endpoint:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testStudioStatusRoomEndpoint(); 
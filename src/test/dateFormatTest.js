/**
 * Test script to verify UTC+8 date formatting
 */

const { formatToUTC8ISOString } = require('../utils/dateUtils');

// Test dates
const testDates = [
  new Date('2025-04-12T04:27:57.880Z'),
  new Date('2025-04-12T05:23:04.506Z'),
  new Date(),
];

console.log('Testing UTC+8 date formatting:');
console.log('--------------------------------');

testDates.forEach((date, index) => {
  console.log(`Test ${index + 1}:`);
  console.log(`Original date: ${date.toISOString()}`);
  console.log(`UTC+8 formatted: ${formatToUTC8ISOString(date)}`);
  console.log('--------------------------------');
});

// Test with the specific dates from the issue
const issueDate1 = new Date('2025-04-12T04:27:57.880Z');
const issueDate2 = new Date('2025-04-12T05:23:04.506Z');

console.log('Issue dates:');
console.log('--------------------------------');
console.log(`Original date 1: ${issueDate1.toISOString()}`);
console.log(`UTC+8 formatted 1: ${formatToUTC8ISOString(issueDate1)}`);
console.log('--------------------------------');
console.log(`Original date 2: ${issueDate2.toISOString()}`);
console.log(`UTC+8 formatted 2: ${formatToUTC8ISOString(issueDate2)}`);
console.log('--------------------------------'); 
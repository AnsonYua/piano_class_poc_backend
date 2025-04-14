/**
 * Date utility functions for handling UTC+8 timezone
 */

/**
 * Convert a date to UTC+8 timezone
 * @param {Date} date - The date to convert
 * @returns {Date} - The date in UTC+8 timezone
 */
const toUTC8 = (date) => {
  if (!date) return null;
  
  // Create a new date object to avoid modifying the original
  const utc8Date = new Date(date);
  
  // Add 8 hours to convert to UTC+8
  utc8Date.setHours(utc8Date.getHours() + 8);
  
  return utc8Date;
};

/**
 * Format a date to ISO string in UTC+8
 * @param {Date} date - The date to format
 * @returns {string} - The formatted date string
 */
const formatToUTC8ISOString = (date) => {
  if (!date) return null;
  
  const utc8Date = toUTC8(date);
  
  // Format as YYYY-MM-DDTHH:mm:ss.sss+08:00
  const year = utc8Date.getUTCFullYear();
  const month = String(utc8Date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(utc8Date.getUTCDate()).padStart(2, '0');
  const hours = String(utc8Date.getUTCHours()).padStart(2, '0');
  const minutes = String(utc8Date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(utc8Date.getUTCSeconds()).padStart(2, '0');
  const milliseconds = String(utc8Date.getUTCMilliseconds()).padStart(3, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}+08:00`;
};

/**
 * Format a date to a readable string in UTC+8
 * @param {Date} date - The date to format
 * @param {string} format - The format to use (default: 'YYYY-MM-DD HH:mm:ss')
 * @returns {string} - The formatted date string
 */
const formatToUTC8String = (date, format = 'YYYY-MM-DD HH:mm:ss') => {
  if (!date) return null;
  
  const utc8Date = toUTC8(date);
  
  const year = utc8Date.getUTCFullYear();
  const month = String(utc8Date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(utc8Date.getUTCDate()).padStart(2, '0');
  const hours = String(utc8Date.getUTCHours()).padStart(2, '0');
  const minutes = String(utc8Date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(utc8Date.getUTCSeconds()).padStart(2, '0');
  
  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
};

module.exports = {
  toUTC8,
  formatToUTC8ISOString,
  formatToUTC8String
}; 
/**
 * Date Formatting Utility
 * All dates in app follow DD/MM/YYYY format
 */

// Format date object to DD/MM/YYYY string
export const formatDateDMY = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

// Parse DD/MM/YYYY string to Date object
export const parseDateDMY = (dateString) => {
  if (!dateString || typeof dateString !== 'string') return null;
  
  // Only accept DD/MM/YYYY format
  const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const match = dateString.match(regex);
  
  if (!match) return null;
  
  const [, day, month, year] = match;
  const d = parseInt(day, 10);
  const m = parseInt(month, 10) - 1;
  const y = parseInt(year, 10);
  
  // Validate date ranges
  if (d < 1 || d > 31 || m < 0 || m > 11 || y < 1900 || y > 2100) {
    return null;
  }
  
  const date = new Date(y, m, d);
  
  // Check if date is valid (handles invalid days like Feb 30)
  if (date.getDate() !== d || date.getMonth() !== m || date.getFullYear() !== y) {
    return null;
  }
  
  return date;
};

// Format for display in UI
export const formatDateDisplay = (date) => {
  if (!date) return 'Select date';
  const d = new Date(date);
  return formatDateDMY(d);
};

// Get today's date
export const getTodayDMY = () => {
  return formatDateDMY(new Date());
};

// Check if date is in future
export const isFutureDate = (date) => {
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  return checkDate > today;
};

// Check if date is today or future
export const isTodayOrFuture = (date) => {
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  return checkDate >= today;
};

// Format for API submission (ISO string)
export const formatDateForAPI = (date) => {
  if (!date) return null;
  const d = new Date(date);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
};

/**
 * All date operations in this application use Eastern Standard Time (EST)
 */
const EST_TIMEZONE = 'America/New_York';

/**
 * Gets the current date in EST timezone with time set to midnight
 * @returns Date object representing midnight EST
 */
export function getESTDate(date: Date = new Date()): Date {
  const estString = date.toLocaleString('en-US', { timeZone: EST_TIMEZONE });
  const estDate = new Date(estString);
  estDate.setHours(0, 0, 0, 0);
  return estDate;
}

/**
 * Gets the start of today in EST (midnight)
 * @returns Date object for start of today in EST
 */
export function getESTToday(): Date {
  return getESTDate(new Date());
}

/**
 * Gets the start of yesterday in EST (midnight)
 * @returns Date object for start of yesterday in EST
 */
export function getESTYesterday(): Date {
  const today = getESTToday();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday;
}

/**
 * Gets the start of tomorrow in EST (midnight)
 * @returns Date object for start of tomorrow in EST
 */
export function getESTTomorrow(): Date {
  const today = getESTToday();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
}

/**
 * Converts any date/timestamp to EST timezone
 * @param date - Date string or Date object
 * @returns Date object in EST timezone
 */
export function toEST(date: string | Date): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  const estString = d.toLocaleString('en-US', { timeZone: EST_TIMEZONE });
  return new Date(estString);
}

/**
 * Gets current date/time in EST
 * @returns Date object representing current moment in EST
 */
export function nowInEST(): Date {
  return toEST(new Date());
}

/**
 * Gets current date in EST in YYYY-MM-DD format
 * @returns String in YYYY-MM-DD format representing today in EST
 */
export function getTodayDateString(): string {
  // Get current time in EST timezone
  const now = new Date();
  const estString = now.toLocaleString('en-US', {
    timeZone: EST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  // Parse the MM/DD/YYYY format returned by toLocaleString
  const [month, day, year] = estString.split(/[\/,\s]+/).filter(Boolean);

  return `${year}-${month}-${day}`;
}

/**
 * Formats a date string (YYYY-MM-DD) for display without timezone issues
 * @param dateString - Date string in YYYY-MM-DD format or Date object
 * @returns Formatted date string
 */
export function formatDateForDisplay(dateString: string | Date): string {
  if (!dateString) return '';

  // Convert to string if it's a Date object, using local date components to avoid timezone shifts
  let dateStr: string;
  if (typeof dateString === 'string') {
    dateStr = dateString;
  } else {
    const year = dateString.getFullYear();
    const month = String(dateString.getMonth() + 1).padStart(2, '0');
    const day = String(dateString.getDate()).padStart(2, '0');
    dateStr = `${year}-${month}-${day}`;
  }

  // Extract date from ISO string if needed (e.g., "2026-01-20T00:00:00Z" -> "2026-01-20")
  if (dateStr.includes('T')) {
    dateStr = dateStr.split('T')[0];
  }

  // Parse the date components directly to avoid timezone issues
  const [year, month, day] = dateStr.split('-').map(Number);

  // Create date string manually to avoid any timezone conversion
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  return `${monthNames[month - 1]} ${day}, ${year}`;
}

/**
 * Formats a date string (YYYY-MM-DD) with weekday for display
 * @param dateString - Date string in YYYY-MM-DD format or Date object
 * @returns Formatted date string with weekday
 */
export function formatDateWithWeekday(dateString: string | Date): string {
  if (!dateString) return '';

  // Convert to string if it's a Date object, using local date components to avoid timezone shifts
  let dateStr: string;
  if (typeof dateString === 'string') {
    dateStr = dateString;
  } else {
    const year = dateString.getFullYear();
    const month = String(dateString.getMonth() + 1).padStart(2, '0');
    const day = String(dateString.getDate()).padStart(2, '0');
    dateStr = `${year}-${month}-${day}`;
  }

  // Extract date from ISO string if needed
  if (dateStr.includes('T')) {
    dateStr = dateStr.split('T')[0];
  }

  // Parse the date components locally to avoid timezone issues
  const [year, month, day] = dateStr.split('-').map(Number);

  // Create a date at noon local time to avoid any timezone edge cases
  const date = new Date(year, month - 1, day, 12, 0, 0);

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Formats a date string (YYYY-MM-DD) for display in short format
 * @param dateString - Date string in YYYY-MM-DD format or Date object
 * @returns Formatted date string in MM/DD/YYYY format
 */
export function formatDateShort(dateString: string | Date): string {
  if (!dateString) return '';

  // Convert to string if it's a Date object, using local date components to avoid timezone shifts
  let dateStr: string;
  if (typeof dateString === 'string') {
    dateStr = dateString;
  } else {
    const year = dateString.getFullYear();
    const month = String(dateString.getMonth() + 1).padStart(2, '0');
    const day = String(dateString.getDate()).padStart(2, '0');
    dateStr = `${year}-${month}-${day}`;
  }

  // Extract date from ISO string if needed
  if (dateStr.includes('T')) {
    dateStr = dateStr.split('T')[0];
  }

  // Parse the date components locally to avoid timezone issues
  const [year, month, day] = dateStr.split('-').map(Number);

  // Create a date at noon local time to avoid any timezone edge cases
  const date = new Date(year, month - 1, day, 12, 0, 0);

  return date.toLocaleDateString('en-US');
}

/**
 * Converts a date string to YYYY-MM-DD format for date inputs
 * Handles both ISO strings and date-only strings
 * @param dateString - Date string to convert or Date object
 * @returns Date string in YYYY-MM-DD format
 */
export function formatDateForInput(dateString: string | Date): string {
  if (!dateString) return '';

  // Convert to string if it's a Date object, using local date components to avoid timezone shifts
  let dateStr: string;
  if (typeof dateString === 'string') {
    dateStr = dateString;
  } else {
    const year = dateString.getFullYear();
    const month = String(dateString.getMonth() + 1).padStart(2, '0');
    const day = String(dateString.getDate()).padStart(2, '0');
    dateStr = `${year}-${month}-${day}`;
  }

  // Extract date from ISO string if needed
  if (dateStr.includes('T')) {
    dateStr = dateStr.split('T')[0];
  }

  // If it's already in YYYY-MM-DD format, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // Otherwise parse and format using UTC to avoid timezone issues
  const date = new Date(dateStr);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Formats a timestamp for display in EST timezone
 * @param timestamp - ISO timestamp string
 * @returns Formatted timestamp string in EST
 */
export function formatTimestampForDisplay(timestamp: string): string {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: EST_TIMEZONE
  });
}

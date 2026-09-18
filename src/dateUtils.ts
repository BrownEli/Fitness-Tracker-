/**
 * Unified Date Utility Module
 * Enforces DD/MM/YYYY date formatting across the entire application.
 */

/**
 * Formats a date string (YYYY-MM-DD, ISO string) or Date object into "DD/MM/YYYY".
 * Example: '2026-08-29' -> '29/08/2026'
 */
export function formatDateDDMMYYYY(dateInput?: string | Date | null): string {
  if (!dateInput) return '';

  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (!trimmed) return '';

    // If already in DD/MM/YYYY format
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      return trimmed;
    }

    // Match YYYY-MM-DD (optionally followed by time)
    const ymdMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (ymdMatch) {
      const year = ymdMatch[1];
      const month = ymdMatch[2].padStart(2, '0');
      const day = ymdMatch[3].padStart(2, '0');
      return `${day}/${month}/${year}`;
    }

    // Fallback: parse via Date
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }

    return trimmed;
  }

  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    const day = String(dateInput.getDate()).padStart(2, '0');
    const month = String(dateInput.getMonth() + 1).padStart(2, '0');
    const year = dateInput.getFullYear();
    return `${day}/${month}/${year}`;
  }

  return '';
}

/**
 * Returns a friendly date label like "Today, 29/08/2026" or "Saturday, 29/08/2026"
 */
export function formatDateWithDayDDMMYYYY(dateStr: string): string {
  if (!dateStr) return '';
  const formatted = formatDateDDMMYYYY(dateStr);
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  try {
    const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`);
    if (!isNaN(d.getTime())) {
      const todayStr = new Date().toISOString().split('T')[0];
      if (dateStr === todayStr) {
        return `Today, ${formatted}`;
      }
      return `${DAYS[d.getDay()]}, ${formatted}`;
    }
  } catch {}

  return formatted;
}

/**
 * Adds days to a YYYY-MM-DD string and returns a YYYY-MM-DD string
 */
export function addDaysToDateString(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Gets today's date in YYYY-MM-DD format
 */
export function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Gets day of week name from YYYY-MM-DD
 */
export function getDayNameFromDateString(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}

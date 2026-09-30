import { Event, Team } from '../types';

/**
 * Parses event date (YYYY-MM-DD) and time (HH:MM) into start and end Date objects.
 * Default duration is set to 90 minutes (typical match / training duration).
 */
export function getEventDateRange(event: Event, durationMinutes = 90): { start: Date; end: Date } {
  const dateParts = event.date.split('-');
  const timeParts = event.time ? event.time.split(':') : ['18', '00'];

  const year = parseInt(dateParts[0], 10) || 2026;
  const month = (parseInt(dateParts[1], 10) || 1) - 1;
  const day = parseInt(dateParts[2], 10) || 1;
  const hours = parseInt(timeParts[0], 10) || 0;
  const minutes = parseInt(timeParts[1], 10) || 0;

  const start = new Date(year, month, day, hours, minutes, 0, 0);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  return { start, end };
}

/**
 * Formats date into UTC format for Google Calendar (YYYYMMDDTHHmmssZ)
 */
function formatDateToUtcCompact(date: Date): string {
  const pad = (n: number) => (n < 10 ? '0' + n : String(n));
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  );
}

/**
 * Formats date into local format for .ics file (YYYYMMDDTHHmmss)
 */
function formatDateToLocalCompact(date: Date): string {
  const pad = (n: number) => (n < 10 ? '0' + n : String(n));
  return (
    date.getFullYear() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    'T' +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  );
}

/**
 * Builds Google Calendar web direct link
 */
export function getGoogleCalendarUrl(event: Event, activeTeam?: Team | null): string {
  const { start, end } = getEventDateRange(event);
  const startStr = formatDateToUtcCompact(start);
  const endStr = formatDateToUtcCompact(end);

  const teamName = activeTeam ? `Tým: ${activeTeam.name} (#${activeTeam.code})\n` : '';
  const descPart = event.description ? `Popis: ${event.description}\n\n` : '';
  const details = `${descPart}${teamName}Aplikace Sejdeme se?\nDocházka a podrobnosti v týmové aplikaci.`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${startStr}/${endStr}`,
    details: details,
    location: event.location || '',
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Builds Outlook.com / Office 365 web direct link
 */
export function getOutlookCalendarUrl(event: Event, activeTeam?: Team | null): string {
  const { start, end } = getEventDateRange(event);
  const teamName = activeTeam ? `Tým: ${activeTeam.name} (#${activeTeam.code})\n` : '';
  const descPart = event.description ? `Popis: ${event.description}\n\n` : '';
  const details = `${descPart}${teamName}Aplikace Sejdeme se?\nDocházka a podrobnosti v týmové aplikaci.`;

  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
    body: details,
    location: event.location || '',
  });

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/**
 * Builds Yahoo Calendar web link
 */
export function getYahooCalendarUrl(event: Event, activeTeam?: Team | null): string {
  const { start, end } = getEventDateRange(event);
  const teamName = activeTeam ? `Tým: ${activeTeam.name} (#${activeTeam.code})\n` : '';
  const descPart = event.description ? `Popis: ${event.description}\n\n` : '';
  const details = `${descPart}${teamName}Aplikace Sejdeme se?\nDocházka a podrobnosti v týmové aplikaci.`;

  const params = new URLSearchParams({
    v: '60',
    title: event.title,
    st: formatDateToUtcCompact(start),
    et: formatDateToUtcCompact(end),
    desc: details,
    in_loc: event.location || '',
  });

  return `https://calendar.yahoo.com/?${params.toString()}`;
}

/**
 * Generates and triggers download of an .ics (iCalendar) file
 * Supported natively by Apple Calendar (iOS / macOS), Google Calendar, Outlook, Android, etc.
 */
export function downloadIcsFile(event: Event, activeTeam?: Team | null): void {
  const { start, end } = getEventDateRange(event);
  const startStr = formatDateToLocalCompact(start);
  const endStr = formatDateToLocalCompact(end);
  const nowStr = formatDateToUtcCompact(new Date());

  const teamName = activeTeam ? `Tým: ${activeTeam.name} (#${activeTeam.code})\n` : '';
  const descPart = event.description ? `Popis: ${event.description}\n\n` : '';
  const description = `${descPart}${teamName}Aplikace Sejdeme se?\nDocházka a podrobnosti v týmové aplikaci.`
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,');

  const title = event.title.replace(/,/g, '\\,');
  const location = (event.location || '').replace(/,/g, '\\,');

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sejdeme se//Tymova aplikace//CZ',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:sejdemese-event-${event.id}@sejdemese.app`,
    `DTSTAMP:${nowStr}`,
    `DTSTART:${startStr}`,
    `DTEND:${endStr}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    location ? `LOCATION:${location}` : '',
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Připomenutí: ' + title,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  
  // Safe filename
  const cleanTitle = event.title.toLowerCase().replace(/[^a-z0-9]/gi, '_').slice(0, 30);
  link.setAttribute('download', `${cleanTitle || 'udalost'}_${event.date}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

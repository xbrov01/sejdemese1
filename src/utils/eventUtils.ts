import { Event } from '../types';

/**
 * Zjistí, zda událost již proběhla v minulosti vzhledem k aktuálnímu datu a času.
 */
export const isEventPast = (event: { date: string; time?: string }): boolean => {
  if (!event || !event.date) return false;

  try {
    let dateStr = String(event.date).trim();
    
    // Podpora formátu DD.MM.YYYY nebo D.M.YYYY
    if (dateStr.includes('.')) {
      const parts = dateStr.split('.').map((p) => p.trim()).filter(Boolean);
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        dateStr = `${year}-${month}-${day}`;
      }
    }

    // Normalizace času na HH:mm:ss
    let timeStr = '23:59:59';
    if (event.time && String(event.time).trim()) {
      const cleanTime = String(event.time).trim();
      const timeParts = cleanTime.split(':').map((p) => p.trim());
      if (timeParts.length >= 2) {
        const hour = timeParts[0].padStart(2, '0');
        const min = timeParts[1].padStart(2, '0');
        const sec = timeParts[2] ? timeParts[2].padStart(2, '0') : '00';
        timeStr = `${hour}:${min}:${sec}`;
      }
    }

    // Pokus o parsování lokálního datumu a času
    const dateTimeIso = `${dateStr}T${timeStr}`;
    const parsedDate = new Date(dateTimeIso);

    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.getTime() < Date.now();
    }

    // Záložní varianta
    const fallback = new Date(`${dateStr} 23:59:59`);
    if (!isNaN(fallback.getTime())) {
      return fallback.getTime() < Date.now();
    }
  } catch (err) {
    console.error('Chyba při vyhodnocování data události:', err);
  }

  return false;
};

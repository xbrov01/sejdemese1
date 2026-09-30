import { db, collection, addDoc, doc, updateDoc, deleteDoc, getDocs, query, where } from '../lib/firebase';
import { Event, Team, UserProfile, NotificationItem, AttendanceRecord } from '../types';
import { isEventPast } from './eventUtils';
import { isNative, scheduleNativeNotification, scheduleScheduledNativeNotification } from '../lib/capacitor';

/**
 * Zjistí aktuální stav oprávnění k notifikacím (pro nativní aplikaci i webový prohlížeč)
 */
export const checkNotificationPermissionStatus = async (): Promise<'granted' | 'denied' | 'default'> => {
  if (isNative) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display === 'granted') return 'granted';
      if (perm.display === 'denied') return 'denied';
      return 'default';
    } catch {
      return 'denied';
    }
  }

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission as 'granted' | 'denied' | 'default';
};

/**
 * Požádá o povolení notifikací (buď přes Capacitor na nativním zařízení nebo přes Web Notification API)
 */
export const requestWebNotificationPermission = async (): Promise<NotificationPermission> => {
  if (isNative) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      let perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        perm = await LocalNotifications.requestPermissions();
      }
      return perm.display === 'granted' ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  }

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.error('Chyba při žádosti o notifikace:', err);
    return 'denied';
  }
};

/**
 * Zobrazí systémovou notifikaci na Androidu/iOS přes Capacitor, nebo v prohlížeči přes Service Worker / Notification API
 */
export const showBrowserNotification = async (
  title: string,
  body: string,
  icon = '/favicon.ico',
  data?: any
): Promise<boolean> => {
  // 0. Prioritní nativní cesta přes Capacitor (Android APK & iOS)
  if (isNative) {
    try {
      const success = await scheduleNativeNotification({
        title,
        body,
        data,
      });
      if (success) return true;
    } catch (capErr) {
      console.warn('[Capacitor] Chyba při odeslání lokální notifikace:', capErr);
    }
  }

  // 1. Web prohlížeč
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  // Pokud je oprávnění ve výchozím stavu, pokusíme se požádat
  if (Notification.permission === 'default') {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return false;
    } catch {
      return false;
    }
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  const notificationOptions = {
    body,
    icon,
    badge: icon,
    vibrate: [200, 100, 200],
    tag: (data && data.tag) || `sejdemese-${Date.now()}`,
    renotify: true,
    data: {
      url: window.location.origin,
      ...data,
    },
  };

  // 1. Prioritní zobrazení přes Service Worker (nutné pro Android Chrome a PWA)
  if ('serviceWorker' in navigator) {
    try {
      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        registration = await navigator.serviceWorker.ready;
      }
      if (registration && typeof registration.showNotification === 'function') {
        await registration.showNotification(title, notificationOptions);
        return true;
      }
    } catch (swErr) {
      console.warn('Service Worker showNotification selhal, zkouším fallback:', swErr);
    }
  }

  // 2. Fallback na klasické Notification API (pro Desktop prohlížeče)
  try {
    new Notification(title, notificationOptions);
    return true;
  } catch (err) {
    console.warn('Fallback new Notification selhal (typické pro mobilní Android Chrome):', err);
  }

  return false;
};

/**
 * Otestuje zobrazení systémové notifikace na aktuálním zařízení
 */
export const sendTestBrowserNotification = async (): Promise<boolean> => {
  if (isNative) {
    return await scheduleNativeNotification({
      title: 'Sejdeme se • Nativní notifikace',
      body: 'Systémová oznámení v nativní aplikaci fungují skvěle!',
    });
  }

  const perm = await requestWebNotificationPermission();
  if (perm !== 'granted') {
    return false;
  }
  return await showBrowserNotification(
    'Sejdeme se • Zkušební notifikace',
    'Systémová oznámení na tomto zařízení úspěšně fungují!',
    '/favicon.ico',
    { tag: 'test-notification' }
  );
};


/**
 * Výchozí předvolby notifikací pro tým
 */
export const getDefaultTeamNotificationPreferences = () => ({
  teamRemindersEnabled: true,
  attendanceReminderEnabled: true,
  attendanceReminderHours: 24,
  chatNotificationsEnabled: true,
  eventCreatedNotificationEnabled: true,
  eventUpdatedNotificationEnabled: true,
  eventCancelledNotificationEnabled: true,
});

/**
 * Získá nastavení notifikací pro konkrétní tým daného uživatele (s aplikací výchozích hodnot)
 */
export const getUserTeamNotificationPreferences = (user: UserProfile, teamId: string) => {
  const defaults = getDefaultTeamNotificationPreferences();
  const userTeamPrefs = user.notificationPreferences?.[teamId];
  
  if (!userTeamPrefs) {
    return defaults;
  }

  return {
    teamRemindersEnabled: userTeamPrefs.teamRemindersEnabled !== undefined ? userTeamPrefs.teamRemindersEnabled : defaults.teamRemindersEnabled,
    attendanceReminderEnabled: userTeamPrefs.attendanceReminderEnabled !== undefined ? userTeamPrefs.attendanceReminderEnabled : defaults.attendanceReminderEnabled,
    attendanceReminderHours: userTeamPrefs.attendanceReminderHours !== undefined ? userTeamPrefs.attendanceReminderHours : defaults.attendanceReminderHours,
    chatNotificationsEnabled: userTeamPrefs.chatNotificationsEnabled !== undefined ? userTeamPrefs.chatNotificationsEnabled : defaults.chatNotificationsEnabled,
    eventCreatedNotificationEnabled: userTeamPrefs.eventCreatedNotificationEnabled !== undefined ? userTeamPrefs.eventCreatedNotificationEnabled : defaults.eventCreatedNotificationEnabled,
    eventUpdatedNotificationEnabled: userTeamPrefs.eventUpdatedNotificationEnabled !== undefined ? userTeamPrefs.eventUpdatedNotificationEnabled : defaults.eventUpdatedNotificationEnabled,
    eventCancelledNotificationEnabled: userTeamPrefs.eventCancelledNotificationEnabled !== undefined ? userTeamPrefs.eventCancelledNotificationEnabled : defaults.eventCancelledNotificationEnabled,
  };
};

/**
 * Vytvoří novou notifikaci v databázi (s kontrolou proti duplicitě podle notificationKey).
 * Pokud je notifikace určena pro aktuálně přihlášeného uživatele v popředí, rovnou vyvolá systémovou notifikaci.
 */
export const createNotification = async (
  notif: Omit<NotificationItem, 'id' | 'read' | 'createdAt'> & { notificationKey?: string },
  currentUserEmail?: string
): Promise<void> => {
  try {
    if (notif.notificationKey) {
      // Kontrola, zda už notifikace se stejným klíčem neexistuje pro daného uživatele
      const q = query(
        collection(db, 'notifications'),
        where('userEmail', '==', notif.userEmail),
        where('notificationKey', '==', notif.notificationKey)
      );
      const existing = await getDocs(q);
      if (!existing.empty) {
        return; // Již bylo notifikováno
      }
    }

    const isCurrentRecipient = currentUserEmail && currentUserEmail.toLowerCase() === notif.userEmail.toLowerCase();

    const newDoc = {
      ...notif,
      read: false,
      pushed: isCurrentRecipient ? true : false,
      createdAt: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, 'notifications'), newDoc);

    // Pokud je příjemcem právě přihlášený uživatel (např. automatické připomenutí docházky generované na zařízení),
    // rovnou a bez zpoždění zobrazíme systémovou notifikaci
    if (isCurrentRecipient) {
      showBrowserNotification(notif.title, notif.message, '/favicon.ico', {
        eventId: notif.eventId,
        teamId: notif.teamId,
        tag: `sejdemese-${docRef.id}`,
        url: window.location.origin,
      });
    }
  } catch (err) {
    console.error('Chyba při ukládání notifikace:', err);
  }
};

/**
 * Odešle notifikaci o nové zprávě v chatu všem členům týmu kromě odesílatele
 */
export const sendChatNotifications = async (
  event: Event,
  team: Team,
  authorEmail: string,
  authorDisplayName: string,
  messageText: string,
  allUsers: UserProfile[]
) => {
  if (!team || !team.memberEmails) return;

  const otherMembers = team.memberEmails.filter((email) => email.toLowerCase() !== authorEmail.toLowerCase());
  const textSnippet = messageText.length > 60 ? `${messageText.slice(0, 57)}...` : messageText;

  for (const memberEmail of otherMembers) {
    const memberProfile = allUsers.find((u) => u.email.toLowerCase() === memberEmail.toLowerCase());
    const memberPrefs = memberProfile
      ? getUserTeamNotificationPreferences(memberProfile, team.id)
      : getDefaultTeamNotificationPreferences();

    // Zkontrolujeme, zda má uživatel povolené chat notifikace pro tento tým
    if (memberPrefs.chatNotificationsEnabled) {
      await createNotification({
        userEmail: memberEmail,
        teamId: team.id,
        teamName: team.name,
        eventId: event.id,
        eventTitle: event.title,
        type: 'CHAT_MESSAGE',
        title: `Nová zpráva: ${event.title}`,
        message: `${authorDisplayName} v týmu ${team.name}: "${textSnippet}"`,
        // Chat notifikace mají unikátní klíč per zprávu a příjemce
        notificationKey: `chat_${event.id}_${Date.now()}_${memberEmail}`,
      });
    }
  }
};

/**
 * Naformátuje datum a čas události pro srozumitelné textové zobrazení v notifikacích
 */
export const formatEventDateTimeForNotification = (dateStr: string, timeStr?: string): string => {
  try {
    const time = timeStr && timeStr.includes(':') ? timeStr : '00:00';
    const d = new Date(`${dateStr}T${time}:00`);
    if (isNaN(d.getTime())) {
      return `${dateStr} ${timeStr || ''}`.trim();
    }
    const dayNames = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
    const dayOfWeek = dayNames[d.getDay()];
    return `${dayOfWeek} ${d.getDate()}. ${d.getMonth() + 1}. v ${time}`;
  } catch {
    return `${dateStr} ${timeStr || ''}`.trim();
  }
};

/**
 * Odešle notifikaci o nově vytvořené události všem členům týmu kromě tvůrce
 */
export const sendEventCreatedNotifications = async (
  event: Event,
  team: Team,
  authorEmail: string,
  authorDisplayName: string,
  allUsers: UserProfile[]
) => {
  if (!team || !team.memberEmails) return;

  // Negenerovat notifikace pro události vytvořené v minulosti
  if (isEventPast(event)) return;

  const dateTimeFormatted = formatEventDateTimeForNotification(event.date, event.time);
  const locationText = event.location ? ` (${event.location})` : '';

  for (const memberEmail of team.memberEmails) {
    if (memberEmail.toLowerCase() === authorEmail.toLowerCase()) continue;

    const memberProfile = allUsers.find((u) => u.email.toLowerCase() === memberEmail.toLowerCase());
    const memberPrefs = memberProfile
      ? getUserTeamNotificationPreferences(memberProfile, team.id)
      : getDefaultTeamNotificationPreferences();

    if (memberPrefs.eventCreatedNotificationEnabled) {
      await createNotification({
        userEmail: memberEmail,
        teamId: team.id,
        teamName: team.name,
        eventId: event.id,
        eventTitle: event.title,
        type: 'EVENT_CREATED',
        title: `Nová událost: ${event.title}`,
        message: `${authorDisplayName} přidal(a) novou akci pro tým ${team.name} na ${dateTimeFormatted}${locationText}. Zadejte svou účast!`,
        notificationKey: `event_created_${event.id}_${memberEmail}`,
      });
    }
  }
};

/**
 * Odešle notifikaci o změně / úpravě události všem členům týmu kromě editora
 */
export const sendEventUpdatedNotifications = async (
  updatedEvent: Event,
  oldEvent: Event | undefined,
  team: Team,
  editorEmail: string,
  editorDisplayName: string,
  allUsers: UserProfile[]
) => {
  if (!team || !team.memberEmails) return;

  // Negenerovat notifikace pro změny uplynulých událostí
  if (isEventPast(updatedEvent)) {
    return;
  }
  if (oldEvent && isEventPast(oldEvent) && isEventPast(updatedEvent)) {
    return;
  }

  const dateTimeFormatted = formatEventDateTimeForNotification(updatedEvent.date, updatedEvent.time);
  const locationText = updatedEvent.location && updatedEvent.location.trim() !== '' ? ` (${updatedEvent.location.trim()})` : '';

  // Zjistíme, zda se změnil termín
  const dateOrTimeChanged = oldEvent && (oldEvent.date !== updatedEvent.date || oldEvent.time !== updatedEvent.time);
  const titleChanged = oldEvent && oldEvent.title !== updatedEvent.title;

  let updateSummary = `Termín: ${dateTimeFormatted}${locationText}`;
  if (dateOrTimeChanged) {
    updateSummary = `Nový termín: ${dateTimeFormatted}${locationText}`;
  }

  for (const memberEmail of team.memberEmails) {
    if (memberEmail.toLowerCase() === editorEmail.toLowerCase()) continue;

    const memberProfile = allUsers.find((u) => u.email.toLowerCase() === memberEmail.toLowerCase());
    const memberPrefs = memberProfile
      ? getUserTeamNotificationPreferences(memberProfile, team.id)
      : getDefaultTeamNotificationPreferences();

    if (memberPrefs.eventUpdatedNotificationEnabled) {
      await createNotification({
        userEmail: memberEmail,
        teamId: team.id,
        teamName: team.name,
        eventId: updatedEvent.id,
        eventTitle: updatedEvent.title,
        type: 'EVENT_UPDATED',
        title: `Změna události: ${updatedEvent.title}`,
        message: `${editorDisplayName} upravil(a) údaje události „${updatedEvent.title}“ v týmu ${team.name} (${updateSummary}). Zkontrolujte a aktualizujte svou účast!`,
        notificationKey: `event_updated_${updatedEvent.id}_${Date.now()}_${memberEmail}`,
      });
    }
  }
};

/**
 * Odešle notifikaci o zrušení / smazání události všem členům týmu kromě osoby, která akci smazala
 */
export const sendEventCancelledNotifications = async (
  event: Event,
  team: Team,
  cancelledByEmail: string,
  cancellerDisplayName: string,
  allUsers: UserProfile[]
) => {
  if (!team || !team.memberEmails) return;

  // Negenerovat notifikace pro smazání / zrušení uplynulých událostí
  if (isEventPast(event)) {
    return;
  }

  const dateTimeFormatted = formatEventDateTimeForNotification(event.date, event.time);

  for (const memberEmail of team.memberEmails) {
    if (memberEmail.toLowerCase() === cancelledByEmail.toLowerCase()) continue;

    const memberProfile = allUsers.find((u) => u.email.toLowerCase() === memberEmail.toLowerCase());
    const memberPrefs = memberProfile
      ? getUserTeamNotificationPreferences(memberProfile, team.id)
      : getDefaultTeamNotificationPreferences();

    if (memberPrefs.eventCancelledNotificationEnabled) {
      await createNotification({
        userEmail: memberEmail,
        teamId: team.id,
        teamName: team.name,
        eventId: event.id,
        eventTitle: event.title,
        type: 'EVENT_CANCELLED',
        title: `Zrušeno: ${event.title}`,
        message: `Událost „${event.title}“ (${dateTimeFormatted}) v týmu ${team.name} byla zrušena (${cancellerDisplayName}).`,
        notificationKey: `event_cancelled_${event.id}_${Date.now()}_${memberEmail}`,
      });
    }
  }
};

/**
 * Spočítá počet zbývajících hodin do začátku události
 */
export const getHoursUntilEvent = (eventDate: string, eventTime?: string): number => {
  const timeStr = eventTime && eventTime.includes(':') ? eventTime : '00:00';
  const eventDateTime = new Date(`${eventDate}T${timeStr}:00`);
  const now = new Date();
  const diffMs = eventDateTime.getTime() - now.getTime();
  return diffMs / (1000 * 60 * 60);
};

/**
 * Vyhodnotí a vygeneruje připomenutí nadcházejících událostí a výzvy k zadání docházky
 */
export const checkAndGenerateReminders = async (
  currentUser: UserProfile,
  teams: Team[],
  events: Event[],
  allUsers: UserProfile[]
) => {
  if (!currentUser || !currentUser.email) return;

  const now = new Date();

  for (const event of events) {
    const team = teams.find((t) => t.id === event.teamId);
    if (!team) continue;

    // Uživatel musí být členem týmu
    const isMember = team.memberEmails.some((e) => e.toLowerCase() === currentUser.email.toLowerCase());
    if (!isMember) continue;

    const hoursUntil = getHoursUntilEvent(event.date, event.time);

    // Ignorovat uplynulé události
    if (hoursUntil <= 0) continue;

    const userPrefs = getUserTeamNotificationPreferences(currentUser, team.id);

    // 1. KONTROLA VÝZVY K ZADÁNÍ DOCHÁZKY (Uživatelská notifikace)
    // Pokud má uživatel zapnuto a zbývá méně než nastavený předstih (výchozí 24h)
    if (userPrefs.attendanceReminderEnabled && hoursUntil <= (userPrefs.attendanceReminderHours || 24)) {
      // Zjistíme, zda už uživatel zadal účast
      const attKey = `att_rem_${event.id}_${currentUser.email}`;
      
      try {
        const attQuery = query(
          collection(db, 'events', event.id, 'attendance'),
          where('userEmail', '==', currentUser.email)
        );
        const attDocs = await getDocs(attQuery);
        
        let hasAnswered = false;
        if (!attDocs.empty) {
          const record = attDocs.docs[0].data() as AttendanceRecord;
          if (record && (record.status === 'YES' || record.status === 'MAYBE' || record.status === 'NO')) {
            hasAnswered = true;
          }
        }

        // Pokud ještě účast NEZADAL, vytvoříme notifikaci
        if (!hasAnswered) {
          const hoursFormatted = Math.round(hoursUntil);
          const timeText = hoursFormatted <= 1 ? 'méně než hodina' : `${hoursFormatted} hod.`;

          await createNotification({
            userEmail: currentUser.email,
            teamId: team.id,
            teamName: team.name,
            eventId: event.id,
            eventTitle: event.title,
            type: 'ATTENDANCE_REMINDER',
            title: `Zadejte účast: ${event.title}`,
            message: `Do začátku akce v týmu ${team.name} zbývá ${timeText}. Stále jste nezadali svou účast.`,
            notificationKey: attKey,
          }, currentUser.email);
        }
      } catch (e) {
        console.warn('Chyba při ověřování účasti pro notifikaci:', e);
      }
    }

    // 2. KONTROLA TÝMOVÝCH PŘIPOMENUTÍ ZADANÝCH TVŮRCEM UDÁLOSTI
    // (např. 24h, 2h předem)
    if (userPrefs.teamRemindersEnabled && event.reminders && event.reminders.length > 0) {
      for (const reminderHours of event.reminders) {
        // Pokud jsme v časovém okně tohoto připomenutí (např. <= 24h a > 0)
        if (hoursUntil <= reminderHours) {
          const teamRemKey = `team_rem_${event.id}_${reminderHours}_${currentUser.email}`;

          let label = `${reminderHours} hod.`;
          if (reminderHours >= 24) {
            const days = Math.round(reminderHours / 24);
            label = days === 1 ? '24 hodin' : `${days} dny`;
          } else if (reminderHours === 1) {
            label = '1 hodinu';
          } else if (reminderHours < 1) {
            label = `${Math.round(reminderHours * 60)} minut`;
          }

          await createNotification({
            userEmail: currentUser.email,
            teamId: team.id,
            teamName: team.name,
            eventId: event.id,
            eventTitle: event.title,
            type: 'TEAM_REMINDER',
            title: `Připomenutí akce: ${event.title}`,
            message: `Týmová událost v ${team.name} začíná za ${label} (${event.date} v ${event.time}).`,
            notificationKey: teamRemKey,
          }, currentUser.email);
        }
      }
    }
  }
};

/**
 * Označí notifikaci jako přečtenou
 */
export const markNotificationAsRead = async (notificationId: string) => {
  try {
    const docRef = doc(db, 'notifications', notificationId);
    await updateDoc(docRef, { read: true, pushed: true });
  } catch (err) {
    console.error('Chyba při označení notifikace jako přečtené:', err);
  }
};

/**
 * Označí všechny notifikace daného uživatele jako přečtené
 */
export const markAllNotificationsAsRead = async (userEmail: string, notificationIds?: string[]) => {
  try {
    if (notificationIds && notificationIds.length > 0) {
      const updatePromises = notificationIds.map((id) =>
        updateDoc(doc(db, 'notifications', id), { read: true, pushed: true })
      );
      await Promise.all(updatePromises);
      return;
    }

    const emailsToQuery = Array.from(new Set([userEmail, userEmail.toLowerCase()]));
    for (const email of emailsToQuery) {
      const q = query(
        collection(db, 'notifications'),
        where('userEmail', '==', email),
        where('read', '==', false)
      );
      const snapshot = await getDocs(q);
      const updatePromises = snapshot.docs.map((d) =>
        updateDoc(doc(db, 'notifications', d.id), { read: true, pushed: true })
      );
      await Promise.all(updatePromises);
    }
  } catch (err) {
    console.error('Chyba při hromadném označování notifikací:', err);
  }
};

/**
 * Smaže notifikaci
 */
export const deleteNotification = async (notificationId: string) => {
  try {
    await deleteDoc(doc(db, 'notifications', notificationId));
  } catch (err) {
    console.error('Chyba při mazání notifikace:', err);
  }
};

/**
 * Smaže všechna oznámení uživatele
 */
export const clearAllNotifications = async (userEmail: string, notificationIds?: string[]) => {
  try {
    if (notificationIds && notificationIds.length > 0) {
      const deletePromises = notificationIds.map((id) => deleteDoc(doc(db, 'notifications', id)));
      await Promise.all(deletePromises);
      return;
    }

    const emailsToQuery = Array.from(new Set([userEmail, userEmail.toLowerCase()]));
    for (const email of emailsToQuery) {
      const q = query(collection(db, 'notifications'), where('userEmail', '==', email));
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map((d) => deleteDoc(doc(db, 'notifications', d.id)));
      await Promise.all(deletePromises);
    }
  } catch (err) {
    console.error('Chyba při čištění notifikací:', err);
  }
};

/**
 * Stabilní hashovací funkce pro převod řetězce (klíče notifikace) na 32bitové celé číslo pro ID notifikace
 */
const hashStringTo32BitInt = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash) % 2147483647;
};

/**
 * Naplánuje dopředu budoucí nativní notifikace do operačního systému (Android / iOS).
 * Díky tomu se upozornění na blížící se událost nebo výzva k zadání docházky doručí
 * PŘESNĚ V DANÝ ČAS, i když je aplikace kompletně zavřená na pozadí nebo je telefon uspaný.
 */
export const syncUpcomingNativeReminders = async (
  currentUser: UserProfile,
  teams: Team[],
  events: Event[]
) => {
  if (!isNative || !currentUser?.email || events.length === 0) return;

  const nowMs = Date.now();

  for (const event of events) {
    const team = teams.find((t) => t.id === event.teamId);
    if (!team) continue;

    const isMember = team.memberEmails.some((e) => e.toLowerCase() === currentUser.email.toLowerCase());
    if (!isMember) continue;

    const timeStr = event.time && event.time.includes(':') ? event.time : '00:00';
    const eventTimeMs = new Date(`${event.date}T${timeStr}:00`).getTime();
    if (isNaN(eventTimeMs) || eventTimeMs <= nowMs) continue;

    const userPrefs = getUserTeamNotificationPreferences(currentUser, team.id);

    // 1. Týmová připomenutí (např. 24h, 2h, 1h před začátkem události)
    if (userPrefs.teamRemindersEnabled && event.reminders && event.reminders.length > 0) {
      for (const hoursBefore of event.reminders) {
        const fireTimeMs = eventTimeMs - hoursBefore * 60 * 60 * 1000;
        // Plánujeme pouze časy, které jsou v budoucnosti (alespoň 10 sekund od nynějška)
        if (fireTimeMs > nowMs + 10000) {
          let label = `${hoursBefore} hod.`;
          if (hoursBefore >= 24) {
            const days = Math.round(hoursBefore / 24);
            label = days === 1 ? '24 hodin' : `${days} dny`;
          } else if (hoursBefore === 1) {
            label = '1 hodinu';
          } else if (hoursBefore < 1) {
            label = `${Math.round(hoursBefore * 60)} minut`;
          }

          const notifKey = `native_rem_${event.id}_${hoursBefore}_${currentUser.email}`;
          const notifId = hashStringTo32BitInt(notifKey);

          await scheduleScheduledNativeNotification({
            id: notifId,
            title: `Připomenutí akce: ${event.title}`,
            body: `Týmová událost v ${team.name} začíná za ${label} (${event.date} v ${event.time}).`,
            scheduledAt: new Date(fireTimeMs),
            data: {
              eventId: event.id,
              teamId: team.id,
              type: 'TEAM_REMINDER',
            },
          });
        }
      }
    }

    // 2. Výzva k zadání docházky (např. 24h před začátkem události)
    if (userPrefs.attendanceReminderEnabled) {
      const hoursBefore = userPrefs.attendanceReminderHours || 24;
      const fireTimeMs = eventTimeMs - hoursBefore * 60 * 60 * 1000;
      if (fireTimeMs > nowMs + 10000) {
        const attKey = `native_att_${event.id}_${hoursBefore}_${currentUser.email}`;
        const notifId = hashStringTo32BitInt(attKey);

        await scheduleScheduledNativeNotification({
          id: notifId,
          title: `Zadejte účast: ${event.title}`,
          body: `Do začátku akce v týmu ${team.name} zbývá ${hoursBefore} hod. Stále jste nezadali svou účast.`,
          scheduledAt: new Date(fireTimeMs),
          data: {
            eventId: event.id,
            teamId: team.id,
            type: 'ATTENDANCE_REMINDER',
          },
        });
      }
    }
  }
};

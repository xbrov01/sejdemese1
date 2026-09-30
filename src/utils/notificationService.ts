import { db, collection, addDoc, doc, updateDoc, deleteDoc, getDoc, setDoc, getDocs, query, where } from '../lib/firebase';
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

// ============================================================================
// TRVALÁ EVIDENCE VYŘÍZENÝCH PŘIPOMENUTÍ (Zabraňuje opakovanému zobrazení po smazání či restartu)
// ============================================================================

const HANDLED_KEYS_STORAGE_PREFIX = 'sejdemese_handled_notif_keys_';
const memoryHandledKeys = new Set<string>();

const getHandledDocId = (userEmail: string, notificationKey: string): string => {
  return `${userEmail.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}___${notificationKey.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
};

const getStoredHandledKeys = (userEmail: string): Set<string> => {
  if (!userEmail) return new Set();
  const emailKey = userEmail.toLowerCase();
  try {
    const raw = localStorage.getItem(HANDLED_KEYS_STORAGE_PREFIX + emailKey);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed);
    }
  } catch (e) {
    console.warn('Chyba při čtení handled notification keys z localStorage:', e);
  }
  return new Set();
};

/**
 * Trvale zaznamená klíč notifikace jako vyřízený (v paměti, localStorage i Firestore).
 * Zajišťuje, že se připomenutí už NIKDY znovu nevygeneruje ani po smazání z inboxu či restartu aplikace.
 */
export const markNotificationKeyAsHandled = async (userEmail: string, notificationKey: string): Promise<void> => {
  if (!userEmail || !notificationKey) return;
  const emailKey = userEmail.toLowerCase();
  const cacheKey = `${emailKey}___${notificationKey}`;

  // 1. In-memory Set
  memoryHandledKeys.add(cacheKey);

  // 2. localStorage
  try {
    const set = getStoredHandledKeys(emailKey);
    set.add(notificationKey);
    const arr = Array.from(set).slice(-500);
    localStorage.setItem(HANDLED_KEYS_STORAGE_PREFIX + emailKey, JSON.stringify(arr));
  } catch (e) {
    console.warn('Chyba při zápisu handled notification keys do localStorage:', e);
  }

  // 3. Firestore (trvalé centrální úložiště)
  try {
    const docId = getHandledDocId(emailKey, notificationKey);
    await setDoc(doc(db, 'handled_reminders', docId), {
      userEmail: emailKey,
      notificationKey,
      handledAt: new Date().toISOString(),
    }, { merge: true });
  } catch (e) {
    console.warn('Chyba při zápisu do handled_reminders:', e);
  }
};

/**
 * Zkontroluje, zda již byl daný klíč připomenutí vyřízen, odeslán nebo uživatelem smazán.
 */
export const isNotificationKeyHandled = async (userEmail: string, notificationKey: string): Promise<boolean> => {
  if (!userEmail || !notificationKey) return false;
  const emailKey = userEmail.toLowerCase();
  const cacheKey = `${emailKey}___${notificationKey}`;

  // 1. Rychlá paměťová kontrola
  if (memoryHandledKeys.has(cacheKey)) return true;

  // 2. Lokální úložiště zařízení
  const localSet = getStoredHandledKeys(emailKey);
  if (localSet.has(notificationKey)) {
    memoryHandledKeys.add(cacheKey);
    return true;
  }

  // 3. Firestore handled_reminders (přetrvá i po smazání notifikace uživatelem z inboxu)
  try {
    const docId = getHandledDocId(emailKey, notificationKey);
    const snap = await getDoc(doc(db, 'handled_reminders', docId));
    if (snap.exists()) {
      memoryHandledKeys.add(cacheKey);
      localSet.add(notificationKey);
      localStorage.setItem(HANDLED_KEYS_STORAGE_PREFIX + emailKey, JSON.stringify(Array.from(localSet).slice(-500)));
      return true;
    }
  } catch (e) {
    console.warn('Chyba při čtení handled_reminders:', e);
  }

  // 4. Dotaz do existujících notifikací
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userEmail', '==', userEmail),
      where('notificationKey', '==', notificationKey)
    );
    const existing = await getDocs(q);
    if (!existing.empty) {
      memoryHandledKeys.add(cacheKey);
      return true;
    }
  } catch (e) {
    console.warn('Chyba při dotazu na notifications:', e);
  }

  return false;
};

/**
 * Vytvoří novou notifikaci v databázi (s trvalou kontrolou proti duplicitě podle notificationKey).
 */
export const createNotification = async (
  notif: Omit<NotificationItem, 'id' | 'read' | 'createdAt'> & { notificationKey?: string },
  currentUserEmail?: string,
  options?: { showImmediateBrowserPush?: boolean }
): Promise<void> => {
  try {
    if (notif.notificationKey) {
      const alreadyHandled = await isNotificationKeyHandled(notif.userEmail, notif.notificationKey);
      if (alreadyHandled) {
        return; // Již bylo notifikováno nebo vyřízeno/smazáno
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

    // Trvale zaregistrujeme klíč, aby se po smazání nebo restartu aplikace nikdy znovu nevytvořil
    if (notif.notificationKey) {
      await markNotificationKeyAsHandled(notif.userEmail, notif.notificationKey);
    }

    // Systémovou notifikaci zobrazíme pouze pokud je výslovně vyžádána pro reálný čas (ne při úvodní kontrole při startu)
    if (isCurrentRecipient && options?.showImmediateBrowserPush) {
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
 * Zformátuje skutečný zbývající čas do začátku události do přirozeného českého textu
 * Zabraňuje nesmyslným tvrzením typu "začíná za 24 hodin", když událost začíná za 3 hodiny.
 */
export const formatTimeUntilText = (hours: number): string => {
  if (hours <= 0) return 'právě teď';
  if (hours < 1) {
    const mins = Math.max(1, Math.round(hours * 60));
    return `za ${mins} min`;
  }
  const roundedHours = Math.round(hours);
  if (roundedHours === 1) return 'za 1 hodinu';
  if (roundedHours >= 2 && roundedHours <= 4) return `za ${roundedHours} hodiny`;
  if (roundedHours >= 5 && roundedHours < 24) return `za ${roundedHours} hodin`;
  const days = Math.round(roundedHours / 24);
  if (days === 1) return 'zítra (za 24 hodin)';
  return `za ${days} dny`;
};

/**
 * Zformátuje počet zbývajících hodin pro výzvy k docházce
 */
export const formatHoursRemainingText = (hours: number): string => {
  if (hours <= 0) return 'méně než 1 minuta';
  if (hours < 1) {
    const mins = Math.max(1, Math.round(hours * 60));
    return `${mins} minut`;
  }
  const roundedHours = Math.round(hours);
  if (roundedHours === 1) return '1 hodina';
  if (roundedHours >= 2 && roundedHours <= 4) return `${roundedHours} hodiny`;
  if (roundedHours >= 5 && roundedHours < 24) return `${roundedHours} hodin`;
  const days = Math.round(roundedHours / 24);
  return days === 1 ? '1 den (24 hodin)' : `${days} dny`;
};

/**
 * Vyhodnotí a vygeneruje připomenutí nadcházejících událostí a výzvy k zadání docházky.
 * Připomenutí jsou časově ohraničená, neodesílají se se zpožděním (např. 24h upozornění 3h před akcí)
 * a po smazání či vyřízení se už nikdy znovu nezobrazují.
 */
export const checkAndGenerateReminders = async (
  currentUser: UserProfile,
  teams: Team[],
  events: Event[],
  allUsers: UserProfile[]
) => {
  if (!currentUser || !currentUser.email) return;

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
    if (userPrefs.attendanceReminderEnabled) {
      const attHours = userPrefs.attendanceReminderHours || 24;

      // Výzva k docházce se aktivuje, pokud jsme v rámci nastaveného předstihu (např. <= 24h)
      // a událost ještě nezačala (alespoň 15 minut do začátku)
      if (hoursUntil <= attHours && hoursUntil > 0.25) {
        const attKey = `att_rem_${event.id}_${currentUser.email}`;

        // Zkontrolujeme, zda už tato výzva nebyla pro tuto událost odeslána nebo smazána uživatelem
        const alreadyHandled = await isNotificationKeyHandled(currentUser.email, attKey);
        if (!alreadyHandled) {
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

            if (hasAnswered) {
              // Uživatel již účast zadal – trvale označíme jako vyřízené, aby se neověřovalo opakovaně
              await markNotificationKeyAsHandled(currentUser.email, attKey);
            } else {
              // Uživatel dosud účast nezadal – vygenerujeme notifikaci s přesným aktuálním zbývajícím časem
              const timeRemainingText = formatHoursRemainingText(hoursUntil);

              await createNotification({
                userEmail: currentUser.email,
                teamId: team.id,
                teamName: team.name,
                eventId: event.id,
                eventTitle: event.title,
                type: 'ATTENDANCE_REMINDER',
                title: `Zadejte účast: ${event.title}`,
                message: `Do začátku akce v týmu ${team.name} zbývá ${timeRemainingText}. Stále jste nezadali svou účast.`,
                notificationKey: attKey,
              }, currentUser.email);
            }
          } catch (e) {
            console.warn('Chyba při ověřování účasti pro notifikaci:', e);
          }
        }
      }
    }

    // 2. KONTROLA TÝMOVÝCH PŘIPOMENUTÍ ZADANÝCH TVŮRCEM UDÁLOSTI
    // (např. 24h, 2h předem)
    if (userPrefs.teamRemindersEnabled && event.reminders && event.reminders.length > 0) {
      // Seřadit připomenutí sestupně (např. 48, 24, 12, 4, 2, 1)
      const sortedReminders = [...event.reminders].sort((a, b) => b - a);

      for (let i = 0; i < sortedReminders.length; i++) {
        const reminderHours = sortedReminders[i];
        const nextCloserReminder = sortedReminders[i + 1] || 0;

        // A) Čas tohoto připomenutí ještě nenastal
        if (hoursUntil > reminderHours) {
          continue;
        }

        // B) Čas tohoto připomenutí již byl překonán dalším bližším připomenutím
        // Pokud zbývá méně času, než je další bližší milník (např. zbývají 3h a další milník je 2h nebo začátek akce),
        // staré 24h připomenutí je již neplatné a nesmí se odesílat!
        if (hoursUntil <= nextCloserReminder) {
          continue;
        }

        // C) Časová tolerance (catch-up okno):
        // Zabráníme odeslání 24h připomenutí, pokud uživatel spustí aplikaci např. 3 hodiny před akcí.
        const hoursSinceScheduled = reminderHours - hoursUntil;
        const maxAllowedDelay = reminderHours >= 24 ? 3 : reminderHours >= 4 ? 1.5 : 0.5;
        if (hoursSinceScheduled > maxAllowedDelay) {
          continue; // Připomenutí je zastaralé (prošvihnuté)
        }

        const teamRemKey = `team_rem_${event.id}_${reminderHours}_${currentUser.email}`;

        // D) Kontrola, zda už nebylo toto připomenutí vygenerováno, doručeno nebo uživatelem smazáno
        const alreadyHandled = await isNotificationKeyHandled(currentUser.email, teamRemKey);
        if (alreadyHandled) {
          continue;
        }

        // E) Text se skutečným aktuálním časem (např. "za 2 hodiny", ne matoucí "za 24 hodin")
        const timeUntilText = formatTimeUntilText(hoursUntil);

        await createNotification({
          userEmail: currentUser.email,
          teamId: team.id,
          teamName: team.name,
          eventId: event.id,
          eventTitle: event.title,
          type: 'TEAM_REMINDER',
          title: `Připomenutí akce: ${event.title}`,
          message: `Týmová událost v ${team.name} začíná ${timeUntilText} (${event.date} v ${event.time}).`,
          notificationKey: teamRemKey,
        }, currentUser.email);
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
 * Smaže notifikaci z inboxu a trvale zajistí, že se už nikdy znovu nevygeneruje
 */
export const deleteNotification = async (
  notificationId: string,
  userEmail?: string,
  notificationKey?: string
) => {
  try {
    // 1. Zaznamenáme klíč notifikace do trvalé evidence vyřízených připomenutí
    if (userEmail && notificationKey) {
      await markNotificationKeyAsHandled(userEmail, notificationKey);
    } else {
      try {
        const snap = await getDoc(doc(db, 'notifications', notificationId));
        if (snap.exists()) {
          const data = snap.data();
          if (data?.userEmail && data?.notificationKey) {
            await markNotificationKeyAsHandled(data.userEmail, data.notificationKey);
          }
        }
      } catch (e) {
        console.warn('Chyba při zjišťování notificationKey před smazáním:', e);
      }
    }

    // 2. Smažeme dokument z kolekce notifikací uživatele
    await deleteDoc(doc(db, 'notifications', notificationId));
  } catch (err) {
    console.error('Chyba při mazání notifikace:', err);
  }
};

/**
 * Smaže všechna oznámení uživatele a zajistí, že žádná připomenutí se po restartu znovu neobjeví
 */
export const clearAllNotifications = async (
  userEmail: string,
  notificationItemsOrIds?: (NotificationItem | string)[]
) => {
  try {
    if (notificationItemsOrIds && notificationItemsOrIds.length > 0) {
      for (const item of notificationItemsOrIds) {
        if (typeof item === 'string') {
          await deleteNotification(item, userEmail);
        } else {
          await deleteNotification(item.id, item.userEmail || userEmail, item.notificationKey);
        }
      }
      return;
    }

    const emailsToQuery = Array.from(new Set([userEmail, userEmail.toLowerCase()]));
    for (const email of emailsToQuery) {
      const q = query(collection(db, 'notifications'), where('userEmail', '==', email));
      const snapshot = await getDocs(q);
      for (const d of snapshot.docs) {
        const data = d.data();
        if (data?.userEmail && data?.notificationKey) {
          await markNotificationKeyAsHandled(data.userEmail, data.notificationKey);
        }
        await deleteDoc(doc(db, 'notifications', d.id));
      }
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

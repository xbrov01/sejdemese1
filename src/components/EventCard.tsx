import React, { useState, useEffect, useRef } from 'react';
import { Event, UserProfile, AttendanceRecord, AttendanceStatus, EventMessage, Team } from '../types';
import { getMemberDisplayName } from '../utils/userUtils';
import { isEventPast } from '../utils/eventUtils';
import { sendChatNotifications } from '../utils/notificationService';
import {
  getGoogleCalendarUrl,
  getOutlookCalendarUrl,
  getYahooCalendarUrl,
  downloadIcsFile,
  calculateDefaultEndTime
} from '../utils/calendarUtils';
import { hexToRgba, getContrastingTextColor, getSolidLighterShade } from '../utils/themePresets';
import { isUserTeamAdmin } from '../utils/superUserUtils';
import {
  db,
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  deleteDoc
} from '../lib/firebase';
import {
  CheckCircle2,
  HelpCircle,
  XCircle,
  Calendar,
  CalendarPlus,
  Clock,
  MapPin,
  MessageSquare,
  Send,
  Trash2,
  Users,
  ChevronDown,
  ChevronUp,
  Lock,
  Bell,
  Plus,
  X,
  Download,
  ExternalLink,
  Smartphone,
  Check,
  Pencil
} from 'lucide-react';

interface EventCardProps {
  event: Event;
  currentUser: UserProfile;
  activeTeam?: Team | null;
  allUsers?: UserProfile[];
  onEditEvent?: (event: Event) => void;
  onDeleteEvent?: (eventId: string) => void;
  showTeamBadge?: boolean;
  isPast?: boolean;
}

export const EventCard: React.FC<EventCardProps> = ({
  event,
  currentUser,
  activeTeam,
  allUsers = [],
  onEditEvent,
  onDeleteEvent,
  showTeamBadge = false,
  isPast: isPastProp,
}) => {
  const isPast = isPastProp !== undefined ? isPastProp : isEventPast(event);
  const isCreatorOrAdmin =
    isUserTeamAdmin(currentUser, activeTeam) ||
    (Boolean(event.createdBy) && event.createdBy?.toLowerCase() === currentUser.email?.toLowerCase());

  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);
  const [messages, setMessages] = useState<EventMessage[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [hasUserToggledChat, setHasUserToggledChat] = useState(false);
  const [isCardExpanded, setIsCardExpanded] = useState(false);
  const [isRemindersPaneOpen, setIsRemindersPaneOpen] = useState(false);
  const [showCalendarMenu, setShowCalendarMenu] = useState(false);
  const [icsDownloaded, setIcsDownloaded] = useState(false);

  // Stavy rozbalení jednotlivých sekcí docházky (Zúčastní se je defaultně expandovaná, ostatní kolapsované)
  const [isYesExpanded, setIsYesExpanded] = useState(true);
  const [isMaybeExpanded, setIsMaybeExpanded] = useState(false);
  const [isNoExpanded, setIsNoExpanded] = useState(false);
  const [isUnrespondedExpanded, setIsUnrespondedExpanded] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const calendarMenuRef = useRef<HTMLDivElement | null>(null);

  // Zavření dropdownu kalendáře při kliknutí mimo
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (calendarMenuRef.current && !calendarMenuRef.current.contains(e.target as Node)) {
        setShowCalendarMenu(false);
      }
    };
    if (showCalendarMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCalendarMenu]);

  const handleDownloadIcs = () => {
    downloadIcsFile(event, activeTeam);
    setIcsDownloaded(true);
    setTimeout(() => {
      setIcsDownloaded(false);
      setShowCalendarMenu(false);
    }, 1500);
  };

  const eventReminders = event.reminders || [];

  // Vypočtené zobrazované jméno pro přihlášeného uživatele v tomto týmu
  const currentUserDisplayName = getMemberDisplayName(currentUser.email, activeTeam, currentUser);

  // Realtime poslech docházky pro tuto událost
  useEffect(() => {
    const attendanceRef = collection(db, 'events', event.id, 'attendance');
    const unsubscribe = onSnapshot(attendanceRef, (snapshot) => {
      const records: AttendanceRecord[] = [];
      snapshot.forEach((docSnap) => {
        records.push({
          id: docSnap.id,
          ...docSnap.data(),
        } as AttendanceRecord);
      });
      setAttendanceList(records);
    }, (err) => {
      console.error('Chyba při načítání docházky:', err);
    });

    return () => unsubscribe();
  }, [event.id]);

  // Realtime poslech chatu / diskuze k události
  useEffect(() => {
    const messagesRef = collection(db, 'events', event.id, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: EventMessage[] = [];
      snapshot.forEach((docSnap) => {
        msgs.push({
          id: docSnap.id,
          ...docSnap.data(),
        } as EventMessage);
      });
      setMessages(msgs);

      // Pokud uživatel ještě ručně nezměnil stav rozbalení diskuze, rozbalíme pouze pokud jsou přítomny zprávy
      setHasUserToggledChat((prevToggled) => {
        if (!prevToggled) {
          setIsChatExpanded(msgs.length > 0);
        }
        return prevToggled;
      });
    }, (err) => {
      console.error('Chyba při načítání správ chatu:', err);
    });

    return () => unsubscribe();
  }, [event.id]);

  // Auto-scroll do konce chatu při nové zprávě
  useEffect(() => {
    if (isChatExpanded) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatExpanded]);

  // Změna docházky přihlášeného uživatele pod jeho týmovou přezdívkou
  const handleSetAttendance = async (status: AttendanceStatus) => {
    if (isPast) return; // Uplynulé události nelze měnit
    try {
      const attDocRef = doc(db, 'events', event.id, 'attendance', currentUser.email);
      await setDoc(attDocRef, {
        userEmail: currentUser.email,
        userName: currentUserDisplayName,
        status,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Chyba při ukládání docházky:', err);
    }
  };

  // Správa týmových připomenutí (pro tvůrce události / admina)
  const handleToggleReminder = async (hours: number) => {
    if (isPast || !isCreatorOrAdmin) return;
    try {
      let updated: number[];
      if (eventReminders.includes(hours)) {
        updated = eventReminders.filter((h) => h !== hours);
      } else {
        updated = [...eventReminders, hours].sort((a, b) => b - a);
      }
      const eventRef = doc(db, 'events', event.id);
      await updateDoc(eventRef, { reminders: updated });
    } catch (err) {
      console.error('Chyba při aktualizaci připomenutí:', err);
    }
  };

  // Odeslání zprávy do diskuze pod týmovou přezdívkou
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPast) return; // Uplynulé události nelze komentovat
    const textToSend = newMessageText.trim();
    if (!textToSend) return;

    setSendingMsg(true);
    try {
      const messagesRef = collection(db, 'events', event.id, 'messages');
      await addDoc(messagesRef, {
        authorName: currentUserDisplayName,
        authorEmail: currentUser.email,
        text: textToSend,
        timestamp: serverTimestamp(),
      });
      setNewMessageText('');
      setIsChatExpanded(true);
      setHasUserToggledChat(true);

      // Rozeslání notifikací ostatním členům týmu o nové zprávě
      if (activeTeam) {
        await sendChatNotifications(
          event,
          activeTeam,
          currentUser.email,
          currentUserDisplayName,
          textToSend,
          allUsers
        );
      }
    } catch (err) {
      console.error('Chyba při odesílání zprávy:', err);
    } finally {
      setSendingMsg(false);
    }
  };

  // Seskupení docházky do tří kategorií
  const yesList = attendanceList.filter((a) => a.status === 'YES');
  const maybeList = attendanceList.filter((a) => a.status === 'MAYBE');
  const noList = attendanceList.filter((a) => a.status === 'NO');

  // Určení aktuální docházky přihlášeného uživatele
  const currentUserAttendance = attendanceList.find((a) => a.userEmail === currentUser.email)?.status;

  // Seznam všech členů týmu a vyhledání těch, kteří se ještě nevyjádřili
  const allMemberEmails: string[] = Array.from(
    new Set([
      ...(activeTeam?.memberEmails || []),
      ...(activeTeam?.createdBy ? [activeTeam.createdBy] : [])
    ])
  );

  const respondedEmailsSet = new Set(attendanceList.map((a) => a.userEmail.toLowerCase()));
  const unrespondedList = allMemberEmails
    .filter((email) => !respondedEmailsSet.has(email.toLowerCase()))
    .map((email) => {
      const userProfile = allUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
      const displayName = getMemberDisplayName(email, activeTeam, userProfile);
      return {
        email,
        displayName,
      };
    });

  // Formátování českého data (např. 26. 07. 2026)
  const formatCzechDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}. ${parts[1]}. ${parts[0]}`;
    }
    return dateStr;
  };

  // Formátování českého data včetně dne v týdnu (např. Sobota, 26. 07. 2026)
  const formatCzechDateWithDay = (dateStr: string) => {
    if (!dateStr) return { shortDay: '', fullDay: '', formattedDate: '', fullLabel: '', shortLabel: '' };
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month - 1, day);
      const czechDaysShort = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
      const czechDaysFull = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];
      const dayIndex = isNaN(d.getDay()) ? 0 : d.getDay();
      const shortDay = czechDaysShort[dayIndex] || '';
      const fullDay = czechDaysFull[dayIndex] || '';
      const formattedDate = `${parts[2]}. ${parts[1]}. ${parts[0]}`;
      return {
        shortDay,
        fullDay,
        formattedDate,
        fullLabel: `${fullDay}, ${formattedDate}`,
        shortLabel: `${shortDay} ${formattedDate}`,
      };
    }
    return {
      shortDay: '',
      fullDay: '',
      formattedDate: dateStr,
      fullLabel: dateStr,
      shortLabel: dateStr,
    };
  };

  // Formátování času zprávy
  const formatMessageTime = (timestamp: any) => {
    if (!timestamp) return '';
    let date: Date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp);
    }
    if (isNaN(date.getTime())) return '';
    
    return date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
  };

  const formatReminderLabel = (hours: number) => {
    if (hours >= 24) {
      const days = Math.round(hours / 24);
      return days === 1 ? '24h předem' : `${days * 24}h předem`;
    }
    return `${hours}h předem`;
  };

  const dateInfo = formatCzechDateWithDay(event.date);
  const teamColor = activeTeam?.cardBgColor || '#059669';
  const displayEndTime = event.endTime || calculateDefaultEndTime(event.time, 60);

  return (
    <div className={`bg-white rounded-2xl shadow-xs border border-slate-200/90 mb-5 transition relative overflow-hidden ${
      isPast ? 'opacity-85 grayscale-[15%]' : 'hover:shadow-sm hover:border-slate-300'
    }`}>
      
      {/* Event Header Card s integrovanými tlačítky pro zadání účasti - Clean Athletic světlý styl */}
      <div
        className={`p-4 sm:p-5 bg-white text-slate-900 flex flex-col gap-3.5 relative z-20 transition-all duration-300 ${
          isCardExpanded ? 'rounded-t-2xl border-b border-slate-150' : 'rounded-2xl'
        } border-l-4`}
        style={{
          borderLeftColor: isPast ? '#94a3b8' : teamColor,
          ...(activeTeam?.cardBgImage ? {
            backgroundImage: `linear-gradient(to right, rgba(255, 255, 255, 0.78) 0%, rgba(255, 255, 255, 0.52) 100%), url(${activeTeam.cardBgImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          } : {})
        }}
      >
        
        {/* HORNÍ ŘÁDEK: Datum (s dnem v týdnu), Název události, Počet potvrzených účastníků a Tlačítko rozbalení */}
        <div className="flex items-start justify-between gap-2.5">
          <div
            className="flex-1 min-w-0 cursor-pointer select-none group"
            onClick={() => setIsCardExpanded(!isCardExpanded)}
            title={isCardExpanded ? 'Kliknutím sbalíte kartu události' : 'Kliknutím rozbalíte všechny podrobnosti'}
          >
            {/* Datum s dnem v týdnu a časem začátku - podbarvené plně neprůhledným (solid) světlým odstínem barvy týmu (nebo šedé pro uplynulé) */}
            <div
              className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg mb-1 border shadow-2xs ${
                isPast
                  ? 'bg-slate-100 text-slate-700 border-slate-200'
                  : ''
              }`}
              style={
                isPast
                  ? undefined
                  : {
                      backgroundColor: getSolidLighterShade(teamColor, 0.14),
                      borderColor: getSolidLighterShade(teamColor, 0.32),
                      color: getContrastingTextColor(teamColor),
                    }
              }
            >
              <Calendar
                className={`w-3.5 h-3.5 shrink-0 ${isPast ? 'text-slate-500' : ''}`}
                style={isPast ? undefined : { color: teamColor }}
              />
              <span>
                <span className="sm:hidden">{dateInfo.shortLabel}</span>
                <span className="hidden sm:inline">{dateInfo.fullLabel}</span>
              </span>
              {event.time && (
                <>
                  <span className="opacity-40 font-normal">|</span>
                  <span className="inline-flex items-center gap-1 font-bold">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{event.time}</span>
                  </span>
                </>
              )}
            </div>

            {/* Indikace proběhlo přesunutá pod datum (plně neprůhledná) */}
            {isPast && (
              <div className="mb-1">
                <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-2xs">
                  Proběhlo
                </span>
              </div>
            )}

            {/* Název události */}
            <h2 className="text-base sm:text-lg md:text-xl font-black text-slate-950 tracking-tight leading-snug group-hover:text-emerald-700 transition-colors drop-shadow-2xs">
              {event.title}
            </h2>

            {/* Popis události (pokud je zadán, zobrazí se přímo na kartě na hlavní obrazovce) */}
            {event.description && event.description.trim() !== '' && (
              <p className={`mt-1 text-xs sm:text-sm text-slate-600 font-medium leading-relaxed ${
                isCardExpanded ? '' : 'line-clamp-2'
              }`}>
                {event.description.trim()}
              </p>
            )}
          </div>

          {/* Pravá část: Počet potvrzených účastníků a tlačítko rozbalení / sbalení */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Počet potvrzených účastníků - plně neprůhledné bílé pozadí */}
            <div className="bg-white rounded-xl px-2.5 sm:px-3 py-1.5 text-right shadow-2xs shrink-0 border border-slate-200">
              <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Potvrzeno</div>
              <div className={`text-xs sm:text-sm font-black flex items-center justify-end ${
                isPast ? 'text-slate-500' : 'text-emerald-700'
              }`}>
                <Users className="w-3.5 h-3.5 mr-1" />
                <span>{yesList.length}</span>
              </div>
            </div>

            {/* Tlačítko rozbalení / sbalení celé karty - plně neprůhledné bílé pozadí */}
            <button
              type="button"
              onClick={() => setIsCardExpanded(!isCardExpanded)}
              className="p-2 sm:p-2.5 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 hover:text-slate-950 rounded-xl transition cursor-pointer flex items-center gap-1 shrink-0 border border-slate-200 shadow-2xs"
              title={isCardExpanded ? 'Sbalit kartu události' : 'Rozbalit všechny podrobnosti'}
              aria-label={isCardExpanded ? 'Sbalit kartu události' : 'Rozbalit kartu události'}
            >
              {isCardExpanded ? (
                <>
                  <ChevronUp className="w-4 h-4 text-emerald-600" />
                  <span className="hidden sm:inline text-xs font-bold text-slate-700">Sbalit</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 text-emerald-600" />
                  <span className="hidden sm:inline text-xs font-bold text-slate-700">Více</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ROZŠÍŘENÉ PODROBNOSTI KARTY: Čas, Místo, Kód týmu, Kalendář, Úpravy, Týmová připomenutí */}
        {isCardExpanded && (
          <div className="space-y-3 pt-2.5 border-t border-slate-150 animate-in fade-in duration-150">
            {/* Druhý řádek: Čas, Kód týmu, Místo a Akční tlačítka kalendáře/editace/smazání */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {/* Čas události - plně neprůhledná pilulka se začátkem i koncem v rozbaleném detailu */}
                <div
                  className="flex items-center space-x-1.5 font-bold text-slate-800 bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs"
                  title={`Čas konání: ${event.time} – ${displayEndTime}`}
                >
                  <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{event.time} – {displayEndTime}</span>
                </div>
                
                {/* Tým kód */}
                {activeTeam && (
                  <span className="bg-white text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono shadow-2xs">
                    #{activeTeam.code} {activeTeam.name}
                  </span>
                )}

                {/* Uplynulá událost štítek */}
                {isPast && (
                  <span className="bg-white text-slate-600 border border-slate-200 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center space-x-1 shadow-2xs">
                    <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>Uplynulá událost</span>
                  </span>
                )}

                {/* Místo konání - plně neprůhledná pilulka */}
                {event.location && event.location.trim() !== '' && (
                  <div className="flex items-center space-x-1.5 text-xs text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>{event.location.trim()}</span>
                  </div>
                )}
              </div>

              {/* Action Controls: Do kalendáře button, Edit, Delete */}
              <div className="flex items-center space-x-2 shrink-0 relative">
                {/* Přidat do kalendáře button & dropdown (solid button, non-transparent) */}
                <div className="relative z-30" ref={calendarMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowCalendarMenu(!showCalendarMenu)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer shadow-2xs border ${
                      showCalendarMenu
                        ? 'bg-emerald-600 text-white border-emerald-600 font-black'
                        : 'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 border-slate-200'
                    }`}
                    title="Přidat událost do osobního kalendáře (Google, Apple, Outlook...)"
                  >
                    <CalendarPlus className={`w-3.5 h-3.5 ${showCalendarMenu ? 'text-white' : 'text-emerald-600'}`} />
                    <span className="hidden xs:inline sm:inline">Do kalendáře</span>
                    <span className="xs:hidden sm:hidden">Kalendář</span>
                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showCalendarMenu ? 'rotate-180 text-white' : 'text-slate-500'}`} />
                  </button>

                  {/* Mobile overlay to close on outside touch */}
                  {showCalendarMenu && (
                    <div
                      className="fixed inset-0 z-40 bg-black/40 sm:hidden backdrop-blur-xs"
                      onClick={() => setShowCalendarMenu(false)}
                    />
                  )}

                  {/* Dropdown Menu - positioned left-0 on mobile, right-0 on desktop */}
                  {showCalendarMenu && (
                    <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-72 sm:w-80 max-w-[calc(100vw-2.5rem)] bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-2 text-slate-900 animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-3 py-2 border-b border-slate-100 mb-1">
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <CalendarPlus className="w-4 h-4 text-emerald-600" />
                          <span>Přidat do osobního kalendáře</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {event.title} • {event.time} – {displayEndTime} ({formatCzechDate(event.date)})
                        </p>
                      </div>

                      <div className="space-y-1">
                        {/* Apple Calendar / .ics file for Mobile iOS, macOS, Outlook */}
                        <button
                          type="button"
                          onClick={handleDownloadIcs}
                          className="w-full text-left p-2.5 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition flex items-start space-x-3 cursor-pointer group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                            {icsDownloaded ? (
                              <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                            ) : (
                              <Smartphone className="w-4 h-4" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                              <span>{icsDownloaded ? 'Uloženo do zařízení!' : 'Mobil / Apple / Outlook (.ics)'}</span>
                              <Download className={`w-3.5 h-3.5 ${icsDownloaded ? 'text-emerald-600' : 'text-slate-400 group-hover:text-emerald-600'}`} />
                            </div>
                            <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                              {icsDownloaded ? 'Soubor byl úspěšně stažen' : 'Pro iPhone, iPad, Mac a Outlook s 2h připomenutím'}
                            </p>
                          </div>
                        </button>

                        {/* Google Calendar */}
                        <a
                          href={getGoogleCalendarUrl(event, activeTeam)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setShowCalendarMenu(false)}
                          className="w-full text-left p-2.5 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition flex items-start space-x-3 cursor-pointer group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                            <Calendar className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                              <span>Google Kalendář</span>
                              <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
                            </div>
                            <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                              Otevřít a uložit přímo v Google Kalendáři
                            </p>
                          </div>
                        </a>

                        {/* Outlook.com / Microsoft 365 */}
                        <a
                          href={getOutlookCalendarUrl(event, activeTeam)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setShowCalendarMenu(false)}
                          className="w-full text-left p-2.5 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition flex items-start space-x-3 cursor-pointer group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 border border-sky-200 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                            <Clock className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                              <span>Outlook.com / Microsoft 365</span>
                              <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-600" />
                            </div>
                            <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                              Uložit do webového kalendáře Microsoft
                            </p>
                          </div>
                        </a>

                        {/* Yahoo Calendar */}
                        <a
                          href={getYahooCalendarUrl(event, activeTeam)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setShowCalendarMenu(false)}
                          className="w-full text-left p-2.5 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition flex items-start space-x-3 cursor-pointer group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                            <CalendarPlus className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                              <span>Yahoo Kalendář</span>
                              <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-600" />
                            </div>
                            <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                              Uložit do kalendáře Yahoo
                            </p>
                          </div>
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* Edit button (solid non-transparent button) */}
                {isCreatorOrAdmin && onEditEvent && !isPast && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditEvent(event);
                    }}
                    className="p-2 text-slate-700 hover:text-emerald-700 bg-white hover:bg-slate-50 active:bg-slate-100 rounded-xl transition cursor-pointer border border-slate-200 shadow-2xs"
                    title="Upravit událost"
                    aria-label="Upravit událost"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}

                {/* Delete button (solid non-transparent button) */}
                {isCreatorOrAdmin && onDeleteEvent && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteEvent(event.id);
                    }}
                    className="p-2 text-slate-600 hover:text-rose-600 bg-white hover:bg-rose-50 active:bg-rose-100 rounded-xl transition cursor-pointer border border-slate-200 shadow-2xs"
                    title="Zrušit a smazat událost"
                    aria-label="Zrušit a smazat událost"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* TÝMOVÁ PŘIPOMENUTÍ: V kolapsovaném panelu, plně neprůhledné pozadí */}
            {!isPast && (
              <div className="bg-white rounded-xl p-2.5 text-xs border border-slate-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setIsRemindersPaneOpen(!isRemindersPaneOpen)}
                  className="w-full flex items-center justify-between text-left cursor-pointer group py-0.5"
                >
                  <div className="flex items-center space-x-2 text-slate-800 font-bold">
                    <Bell className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="hidden sm:inline">Týmová připomenutí</span>
                    <span className="sm:hidden">Připomenutí</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shadow-2xs ${
                      eventReminders.length > 0
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}>
                      {eventReminders.length}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1.5 text-[11px] text-slate-500 group-hover:text-emerald-700 transition font-semibold">
                    <span>{isRemindersPaneOpen ? 'Skrýt nastavení' : 'Zobrazit nastavení'}</span>
                    {isRemindersPaneOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </div>
                </button>

                {isRemindersPaneOpen && (
                  <div className="mt-2.5 pt-2.5 border-t border-slate-200 space-y-2.5 animate-in fade-in">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {eventReminders.length > 0 ? (
                        eventReminders.map((h) => (
                          <span
                            key={h}
                            className="bg-emerald-50 text-emerald-900 border border-emerald-200 px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 shadow-2xs"
                          >
                            <span>{formatReminderLabel(h)}</span>
                            {isCreatorOrAdmin && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleReminder(h);
                                }}
                                className="hover:text-rose-600 cursor-pointer p-0.5 rounded"
                                title="Odebrat toto připomenutí"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-500 italic text-[11px]">Žádné týmové připomenutí není nastaveno.</span>
                      )}
                    </div>

                    {/* Quick add chips for creator/admin (solid buttons, non-transparent) */}
                    {isCreatorOrAdmin && (
                      <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] text-slate-500 uppercase font-bold mr-1">Rychlá volba:</span>
                        {[
                          { hours: 48, label: '48h předem' },
                          { hours: 24, label: '24h předem' },
                          { hours: 12, label: '12h předem' },
                          { hours: 4, label: '4h předem' },
                          { hours: 2, label: '2h předem' },
                          { hours: 1, label: '1h předem' },
                        ].map((opt) => {
                          const isActive = eventReminders.includes(opt.hours);
                          return (
                            <button
                              key={opt.hours}
                              type="button"
                              onClick={() => handleToggleReminder(opt.hours)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer border shadow-2xs ${
                                isActive
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {isActive ? '✓ ' : '+ '}
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* FIRST CLASS CITIZENS: Velká taktilní tlačítka docházky (JDU / MOŽNÁ / NEJDU) ve světlém Clean Athletic stylu - 100% neprůhledná */}
        <div className="pt-3 border-t border-slate-150">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {/* JDU Button */}
            <button
              onClick={() => handleSetAttendance('YES')}
              disabled={isPast}
              title={isPast ? 'Událost již proběhla – účast nelze měnit' : 'Zúčastním se této události'}
              className={`min-h-[52px] sm:min-h-[56px] py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl font-black text-xs sm:text-sm flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 transition cursor-pointer select-none border shadow-2xs ${
                isPast ? 'cursor-not-allowed opacity-60' : ''
              } ${
                currentUserAttendance === 'YES'
                  ? isPast
                    ? 'bg-emerald-800 text-white border-emerald-800'
                    : 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white border-emerald-600 shadow-md shadow-emerald-600/30 scale-[1.02]'
                  : isPast
                    ? 'bg-slate-100 text-slate-400 border-slate-200'
                    : 'bg-white hover:bg-emerald-50 active:bg-emerald-100 text-emerald-800 border-emerald-300'
              }`}
            >
              <CheckCircle2 className="w-5 h-5 shrink-0 stroke-[2.5]" />
              <span className="tracking-wide">JDU</span>
              <span className={`text-[10px] sm:text-xs font-mono font-bold px-1.5 py-0.5 rounded-md ${
                currentUserAttendance === 'YES' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              }`}>
                {yesList.length}
              </span>
            </button>

            {/* MOŽNÁ Button */}
            <button
              onClick={() => handleSetAttendance('MAYBE')}
              disabled={isPast}
              title={isPast ? 'Událost již proběhla – účast nelze měnit' : 'Možná se zúčastním'}
              className={`min-h-[52px] sm:min-h-[56px] py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl font-black text-xs sm:text-sm flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 transition cursor-pointer select-none border shadow-2xs ${
                isPast ? 'cursor-not-allowed opacity-60' : ''
              } ${
                currentUserAttendance === 'MAYBE'
                  ? isPast
                    ? 'bg-amber-600 text-slate-950 border-amber-600'
                    : 'bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-400/30 scale-[1.02]'
                  : isPast
                    ? 'bg-slate-100 text-slate-400 border-slate-200'
                    : 'bg-white hover:bg-amber-50 active:bg-amber-100 text-amber-900 border-amber-300'
              }`}
            >
              <HelpCircle className="w-5 h-5 shrink-0 stroke-[2.5]" />
              <span className="tracking-wide">MOŽNÁ</span>
              <span className={`text-[10px] sm:text-xs font-mono font-bold px-1.5 py-0.5 rounded-md ${
                currentUserAttendance === 'MAYBE' ? 'bg-amber-500 text-slate-950' : 'bg-amber-50 text-amber-900 border border-amber-200'
              }`}>
                {maybeList.length}
              </span>
            </button>

            {/* NEJDU Button */}
            <button
              onClick={() => handleSetAttendance('NO')}
              disabled={isPast}
              title={isPast ? 'Událost již proběhla – účast nelze měnit' : 'Nezúčastním se této události'}
              className={`min-h-[52px] sm:min-h-[56px] py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl font-black text-xs sm:text-sm flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 transition cursor-pointer select-none border shadow-2xs ${
                isPast ? 'cursor-not-allowed opacity-60' : ''
              } ${
                currentUserAttendance === 'NO'
                  ? isPast
                    ? 'bg-rose-800 text-white border-rose-800'
                    : 'bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white border-rose-600 shadow-md shadow-rose-600/30 scale-[1.02]'
                  : isPast
                    ? 'bg-slate-100 text-slate-400 border-slate-200'
                    : 'bg-white hover:bg-rose-50 active:bg-rose-100 text-rose-900 border-rose-300'
              }`}
            >
              <XCircle className="w-5 h-5 shrink-0 stroke-[2.5]" />
              <span className="tracking-wide">NEJDU</span>
              <span className={`text-[10px] sm:text-xs font-mono font-bold px-1.5 py-0.5 rounded-md ${
                currentUserAttendance === 'NO' ? 'bg-rose-700 text-white' : 'bg-rose-50 text-rose-900 border border-rose-200'
              }`}>
                {noList.length}
              </span>
            </button>
          </div>
        </div>

      </div>

      {/* Účast a diskuze: zobrazeno pouze v rozbaleném stavu */}
      {isCardExpanded && (
        <>
          <div className="p-3.5 sm:p-4 space-y-2 bg-slate-50 border-t border-slate-200 animate-in fade-in duration-150">
        
        {/* Sekce 1: Zúčastní se (Zelená) */}
        <div className="rounded-xl overflow-hidden bg-white border border-slate-200/90 shadow-2xs">
          <button
            type="button"
            onClick={() => setIsYesExpanded(!isYesExpanded)}
            className="w-full px-3.5 py-2.5 flex items-center justify-between text-left bg-white hover:bg-slate-50 transition cursor-pointer"
          >
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-slate-900">
                <span className="hidden sm:inline">Zúčastní se</span>
                <span className="sm:hidden">Jdou</span>
              </span>
              <span className="bg-emerald-500 text-slate-950 text-[11px] font-black px-2 py-0.5 rounded-full">
                {yesList.length}
              </span>
            </div>
            <div className="flex items-center text-xs font-semibold text-emerald-700">
              <span className="mr-1">{isYesExpanded ? 'Skrýt' : 'Zobrazit'}</span>
              {isYesExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {isYesExpanded && (
            <div className="px-3.5 pb-3 pt-2 bg-slate-50/70 border-t border-slate-150">
              {yesList.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-1">Zatím nikdo nenahlásil účast.</p>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {yesList.map((item) => {
                    const displayName = getMemberDisplayName(item.userEmail, activeTeam, null, item.userName);
                    return (
                      <div
                        key={item.id}
                        className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 text-white shadow-xs"
                        title={item.userEmail}
                      >
                        <span className="truncate max-w-[180px]">{displayName}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sekce 2: Možná (Oranžová/žlutá) */}
        <div className="rounded-xl overflow-hidden bg-white border border-slate-200/90 shadow-2xs">
          <button
            type="button"
            onClick={() => setIsMaybeExpanded(!isMaybeExpanded)}
            className="w-full px-3.5 py-2.5 flex items-center justify-between text-left bg-white hover:bg-slate-50 transition cursor-pointer"
          >
            <div className="flex items-center space-x-2">
              <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-slate-900">
                <span className="hidden sm:inline">Možná se zúčastní</span>
                <span className="sm:hidden">Možná</span>
              </span>
              <span className="bg-amber-400 text-slate-950 text-[11px] font-black px-2 py-0.5 rounded-full">
                {maybeList.length}
              </span>
            </div>
            <div className="flex items-center text-xs font-semibold text-amber-700">
              <span className="mr-1">{isMaybeExpanded ? 'Skrýt' : 'Zobrazit'}</span>
              {isMaybeExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {isMaybeExpanded && (
            <div className="px-3.5 pb-3 pt-2 bg-slate-50/70 border-t border-slate-150">
              {maybeList.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-1">Zatím nikdo.</p>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {maybeList.map((item) => {
                    const displayName = getMemberDisplayName(item.userEmail, activeTeam, null, item.userName);
                    return (
                      <div
                        key={item.id}
                        className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 shadow-xs"
                        title={item.userEmail}
                      >
                        <span className="truncate max-w-[180px]">{displayName}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sekce 3: Nezúčastní se (Červená) */}
        <div className="rounded-xl overflow-hidden bg-white border border-slate-200/90 shadow-2xs">
          <button
            type="button"
            onClick={() => setIsNoExpanded(!isNoExpanded)}
            className="w-full px-3.5 py-2.5 flex items-center justify-between text-left bg-white hover:bg-slate-50 transition cursor-pointer"
          >
            <div className="flex items-center space-x-2">
              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-slate-900">
                <span className="hidden sm:inline">Nezúčastní se</span>
                <span className="sm:hidden">Nejdou</span>
              </span>
              <span className="bg-rose-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full">
                {noList.length}
              </span>
            </div>
            <div className="flex items-center text-xs font-semibold text-rose-700">
              <span className="mr-1">{isNoExpanded ? 'Skrýt' : 'Zobrazit'}</span>
              {isNoExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {isNoExpanded && (
            <div className="px-3.5 pb-3 pt-2 bg-slate-50/70 border-t border-slate-150">
              {noList.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-1">Zatím nikdo.</p>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {noList.map((item) => {
                    const displayName = getMemberDisplayName(item.userEmail, activeTeam, null, item.userName);
                    return (
                      <div
                        key={item.id}
                        className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-600 text-white shadow-xs"
                        title={item.userEmail}
                      >
                        <span className="truncate max-w-[180px]">{displayName}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sekce 4: Nevyjádřili se (Šedá) */}
        <div className="rounded-xl overflow-hidden bg-white border border-slate-200/90 shadow-2xs">
          <button
            type="button"
            onClick={() => setIsUnrespondedExpanded(!isUnrespondedExpanded)}
            className="w-full px-3.5 py-2.5 flex items-center justify-between text-left bg-white hover:bg-slate-50 transition cursor-pointer"
          >
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-slate-700">
                Nevyjádřili se
              </span>
              <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold px-2 py-0.5 rounded-full">
                {unrespondedList.length}
              </span>
            </div>
            <div className="flex items-center text-xs font-semibold text-slate-600">
              <span className="mr-1">{isUnrespondedExpanded ? 'Skrýt' : 'Zobrazit'}</span>
              {isUnrespondedExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {isUnrespondedExpanded && (
            <div className="px-3.5 pb-3 pt-2 bg-slate-50/70 border-t border-slate-150">
              {unrespondedList.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-1">Všichni členové týmu se již vyjádřili.</p>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {unrespondedList.map((item) => (
                    <div
                      key={item.email}
                      className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs"
                      title={item.email}
                    >
                      <span className="truncate max-w-[180px]">{item.displayName}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Realtime Event Chat / Diskuze k události v Clean Athletic stylu */}
      <div className="p-4 sm:p-5 bg-white border-t border-slate-200">
        <button
          onClick={() => {
            setHasUserToggledChat(true);
            setIsChatExpanded(!isChatExpanded);
          }}
          className="w-full flex items-center justify-between text-left focus:outline-none group mb-2 cursor-pointer p-2 rounded-xl bg-slate-50 hover:bg-slate-100 transition border border-slate-200/80"
        >
          <div className="flex items-center space-x-2">
            <MessageSquare className={`w-4 h-4 ${messages.length > 0 ? 'text-emerald-600' : 'text-slate-500'}`} />
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
              <span className="hidden sm:inline">Diskuze k události</span>
              <span className="sm:hidden">Diskuze</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                messages.length > 0 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-200 text-slate-600'
              }`}>
                {messages.length}
              </span>
            </h3>
          </div>
          <div className="text-xs text-slate-500 flex items-center group-hover:text-slate-900 transition">
            <span className="hidden sm:inline">{isChatExpanded ? 'Skrýt diskuzi' : messages.length === 0 ? 'Otevřít diskuzi' : 'Zobrazit diskuzi'}</span>
            <span className="sm:hidden">{isChatExpanded ? 'Skrýt' : 'Zobrazit'}</span>
            {isChatExpanded ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
          </div>
        </button>

        {isChatExpanded && (
          <div className="mt-3 space-y-3">
            
            {/* Messages box */}
            <div className="bg-slate-50 rounded-xl p-3 sm:p-4 max-h-64 overflow-y-auto space-y-3 border border-slate-200 shadow-2xs">
              {messages.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs italic">
                  Zatím žádné zprávy v diskuzi. Buďte první a napište zprávu týmu!
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.authorEmail === currentUser.email;
                  const displayName = getMemberDisplayName(msg.authorEmail, activeTeam, null, msg.authorName);
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center space-x-1.5 text-[10px] text-slate-500 mb-0.5 px-1">
                        <span className="font-bold text-slate-700">{displayName}</span>
                        <span>•</span>
                        <span>{formatMessageTime(msg.timestamp)}</span>
                      </div>
                      <div
                        className={`px-3.5 py-2 rounded-2xl text-xs max-w-[85%] leading-relaxed ${
                          isMine
                            ? 'bg-emerald-600 text-white rounded-br-none shadow-xs font-medium'
                            : 'bg-white text-slate-850 rounded-bl-none border border-slate-200 shadow-2xs font-normal'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form or Locked Message */}
            {isPast ? (
              <div className="p-3 bg-slate-100 rounded-xl text-xs text-slate-500 text-center flex items-center justify-center space-x-2 border border-slate-200">
                <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Diskuze k této události je uzavřena, protože událost již proběhla.</span>
              </div>
            ) : (
              <form onSubmit={handleSendMessage} className="flex items-center gap-2 w-full min-w-0 max-w-full">
                <input
                  type="text"
                  placeholder="Napište zprávu k události..."
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  className="flex-1 min-w-0 px-3 sm:px-3.5 py-2 sm:py-2.5 bg-slate-50 text-slate-900 placeholder-slate-400 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 border border-slate-200 outline-none"
                />
                <button
                  type="submit"
                  disabled={sendingMsg || !newMessageText.trim()}
                  className="px-3 sm:px-4 py-2 sm:py-2.5 shrink-0 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-bold rounded-xl shadow-xs text-xs flex items-center justify-center gap-1 transition disabled:opacity-50 cursor-pointer"
                >
                  <span>Odeslat</span>
                  <Send className="w-3.5 h-3.5 shrink-0" />
                </button>
              </form>
            )}

          </div>
        )}
      </div>
        </>
      )}

    </div>
  );
};

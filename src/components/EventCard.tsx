import React, { useState, useEffect, useRef } from 'react';
import { Event, UserProfile, AttendanceRecord, AttendanceStatus, EventMessage, Team } from '../types';
import { getMemberDisplayName } from '../utils/userUtils';
import { isEventPast } from '../utils/eventUtils';
import { sendChatNotifications } from '../utils/notificationService';
import {
  getGoogleCalendarUrl,
  getOutlookCalendarUrl,
  getYahooCalendarUrl,
  downloadIcsFile
} from '../utils/calendarUtils';
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
    currentUser.role === 'admin' ||
    (Boolean(event.createdBy) && event.createdBy?.toLowerCase() === currentUser.email?.toLowerCase());

  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);
  const [messages, setMessages] = useState<EventMessage[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [hasUserToggledChat, setHasUserToggledChat] = useState(false);
  const [isRemindersEditorOpen, setIsRemindersEditorOpen] = useState(false);
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

  return (
    <div className={`bg-white rounded-2xl shadow-md border mb-6 transition relative ${
      isPast ? 'border-slate-300 opacity-90 grayscale-[20%]' : 'border-slate-200/80 hover:shadow-lg'
    }`}>
      
      {/* Event Header Card s integrovanými tlačítky pro zadání účasti a volitelným pozadím týmu */}
      <div
        className="p-4 sm:p-5 text-white flex flex-col gap-3.5 relative rounded-t-2xl z-20 transition-all duration-300"
        style={{
          backgroundColor: activeTeam?.cardBgColor || '#0f172a',
          backgroundImage: activeTeam?.cardBgImage
            ? `linear-gradient(to right, rgba(15, 23, 42, 0.88), rgba(15, 23, 42, 0.72)), url(${activeTeam.cardBgImage})`
            : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        
        {/* Horní řádek: Datum, Čas, Tým a Počet účastníků */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs mb-1">
              <div className={`flex items-center space-x-1.5 font-semibold uppercase tracking-wider ${
                isPast ? 'text-slate-300' : 'text-emerald-400'
              }`}>
                <Calendar className="w-3.5 h-3.5" />
                <span>{formatCzechDate(event.date)}</span>
                <span className="text-slate-500">•</span>
                <Clock className="w-3.5 h-3.5" />
                <span>{event.time}</span>
              </div>
              
              {activeTeam && (
                <span className="bg-slate-700/80 text-slate-300 px-2 py-0.5 rounded-md text-[10px] font-bold border border-slate-600/60 font-mono">
                  #{activeTeam.code} {activeTeam.name}
                </span>
              )}

              {isPast && (
                <span className="bg-slate-800/90 text-slate-300 px-2 py-0.5 rounded-md text-[10px] font-bold border border-slate-600/80 flex items-center space-x-1">
                  <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>Uplynulá událost</span>
                </span>
              )}
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              {event.title}
            </h2>

            {event.location && event.location.trim() !== '' && (
              <div className="flex items-center space-x-1.5 text-xs text-slate-300 mt-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{event.location.trim()}</span>
              </div>
            )}
          </div>

          {/* Action Controls: Calendar Button, Attendance Summary, Admin delete */}
          <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end shrink-0 relative">
            
            {/* Přidat do kalendáře button & dropdown */}
            <div className="relative z-30" ref={calendarMenuRef}>
              <button
                type="button"
                onClick={() => setShowCalendarMenu(!showCalendarMenu)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 border transition cursor-pointer shadow-sm ${
                  showCalendarMenu
                    ? 'bg-emerald-600 text-white border-emerald-500 ring-2 ring-emerald-400/40'
                    : 'bg-slate-800/90 hover:bg-slate-700/90 active:bg-slate-600 text-slate-200 hover:text-white border-slate-700/80'
                }`}
                title="Přidat událost do osobního kalendáře (Google, Apple, Outlook...)"
              >
                <CalendarPlus className={`w-3.5 h-3.5 ${showCalendarMenu ? 'text-white' : 'text-emerald-400'}`} />
                <span className="hidden xs:inline sm:inline">Do kalendáře</span>
                <span className="xs:hidden sm:hidden">Kalendář</span>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${showCalendarMenu ? 'rotate-180 text-white' : ''}`} />
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
                <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-72 sm:w-80 max-w-[calc(100vw-2.5rem)] bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl z-50 p-2 text-white animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md">
                  <div className="px-3 py-2 border-b border-slate-800 mb-1">
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <CalendarPlus className="w-4 h-4 text-emerald-400" />
                      <span>Přidat do osobního kalendáře</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {event.title} • {event.time} ({formatCzechDate(event.date)})
                    </p>
                  </div>

                  <div className="space-y-1">
                    {/* Apple Calendar / .ics file for Mobile iOS, macOS, Outlook */}
                    <button
                      type="button"
                      onClick={handleDownloadIcs}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-slate-800/90 active:bg-slate-700 transition flex items-start space-x-3 cursor-pointer group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                        {icsDownloaded ? (
                          <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
                        ) : (
                          <Smartphone className="w-4 h-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white flex items-center justify-between">
                          <span>{icsDownloaded ? 'Uloženo do zařízení!' : 'Mobil / Apple / Outlook (.ics)'}</span>
                          <Download className={`w-3.5 h-3.5 ${icsDownloaded ? 'text-emerald-400' : 'text-slate-400 group-hover:text-emerald-400'}`} />
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
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
                      className="w-full text-left p-2.5 rounded-xl hover:bg-slate-800/90 active:bg-slate-700 transition flex items-start space-x-3 cursor-pointer group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white flex items-center justify-between">
                          <span>Google Kalendář</span>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-400" />
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
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
                      className="w-full text-left p-2.5 rounded-xl hover:bg-slate-800/90 active:bg-slate-700 transition flex items-start space-x-3 cursor-pointer group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white flex items-center justify-between">
                          <span>Outlook.com / Microsoft 365</span>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-400" />
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
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
                      className="w-full text-left p-2.5 rounded-xl hover:bg-slate-800/90 active:bg-slate-700 transition flex items-start space-x-3 cursor-pointer group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                        <CalendarPlus className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white flex items-center justify-between">
                          <span>Yahoo Kalendář</span>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-400" />
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                          Uložit do kalendáře Yahoo
                        </p>
                      </div>
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Attendance counter box */}
            <div className="bg-slate-800/90 border border-slate-700/70 rounded-xl px-3 py-1.5 text-right shadow-inner">
              <div className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Potvrzeno</div>
              <div className={`text-xs sm:text-sm font-extrabold flex items-center justify-end ${
                isPast ? 'text-slate-300' : 'text-emerald-400'
              }`}>
                <Users className="w-3.5 h-3.5 mr-1" />
                <span>{yesList.length} hráčů</span>
              </div>
            </div>

            {/* Edit button */}
            {isCreatorOrAdmin && onEditEvent && !isPast && (
              <button
                type="button"
                onClick={() => onEditEvent(event)}
                className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800/80 rounded-xl transition cursor-pointer"
                title="Upravit událost"
                aria-label="Upravit událost"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}

            {/* Delete button */}
            {isCreatorOrAdmin && onDeleteEvent && (
              <button
                type="button"
                onClick={() => onDeleteEvent(event.id)}
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800/80 rounded-xl transition cursor-pointer"
                title="Zrušit a smazat událost"
                aria-label="Zrušit a smazat událost"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Týmová připomenutí (rozesílání členům týmu) */}
        {!isPast && (
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-2.5 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-slate-300 font-medium">
                <Bell className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Týmové připomenutí:</span>
                {eventReminders.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5 ml-1">
                    {eventReminders.map((h) => (
                      <span
                        key={h}
                        className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-md text-[11px] font-semibold flex items-center gap-1"
                      >
                        <span>{formatReminderLabel(h)}</span>
                        {isCreatorOrAdmin && (
                          <button
                            type="button"
                            onClick={() => handleToggleReminder(h)}
                            className="hover:text-red-300 cursor-pointer ml-0.5"
                            title="Odebrat toto připomenutí"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-400 italic">Žádné připomenutí není nastaveno</span>
                )}
              </div>

              {isCreatorOrAdmin && (
                <button
                  type="button"
                  onClick={() => setIsRemindersEditorOpen(!isRemindersEditorOpen)}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center space-x-1 hover:underline cursor-pointer ml-2 shrink-0"
                >
                  <Plus className="w-3 h-3" />
                  <span>{isRemindersEditorOpen ? 'Zavřít výběr' : 'Upravit připomenutí'}</span>
                </button>
              )}
            </div>

            {/* Quick add chips for creator/admin */}
            {isCreatorOrAdmin && isRemindersEditorOpen && (
              <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex flex-wrap items-center gap-1.5 animate-in fade-in">
                <span className="text-[10px] text-slate-400 uppercase font-semibold mr-1">Rychlá volba:</span>
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
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                        isActive
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-700/80 text-slate-300 hover:bg-slate-700 border border-slate-600/70'
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

        {/* Integrovaná lišta pro rychlé zadání účasti přímo v hlavním panelu */}
        <div className="pt-2.5 border-t border-slate-700/60 flex items-center gap-2">
          {/* JDU Button */}
          <button
            onClick={() => handleSetAttendance('YES')}
            disabled={isPast}
            title={isPast ? 'Událost již proběhla – účast nelze měnit' : undefined}
            className={`flex-1 py-1.5 sm:py-2 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center space-x-1.5 transition ${
              isPast ? 'cursor-not-allowed' : 'cursor-pointer'
            } ${
              currentUserAttendance === 'YES'
                ? isPast
                  ? 'bg-emerald-700 text-slate-100 ring-1 ring-emerald-500/50'
                  : 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30 ring-2 ring-emerald-400/60'
                : isPast
                  ? 'bg-slate-800/50 text-slate-500 border border-slate-700/50 opacity-60'
                  : 'bg-slate-800/90 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>JDU</span>
          </button>

          {/* MOŽNÁ Button */}
          <button
            onClick={() => handleSetAttendance('MAYBE')}
            disabled={isPast}
            title={isPast ? 'Událost již proběhla – účast nelze měnit' : undefined}
            className={`flex-1 py-1.5 sm:py-2 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center space-x-1.5 transition ${
              isPast ? 'cursor-not-allowed' : 'cursor-pointer'
            } ${
              currentUserAttendance === 'MAYBE'
                ? isPast
                  ? 'bg-amber-700 text-slate-100 ring-1 ring-amber-500/50'
                  : 'bg-amber-500 text-white shadow-md shadow-amber-500/30 ring-2 ring-amber-400/60'
                : isPast
                  ? 'bg-slate-800/50 text-slate-500 border border-slate-700/50 opacity-60'
                  : 'bg-slate-800/90 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20'
            }`}
          >
            <HelpCircle className="w-4 h-4 shrink-0" />
            <span>MOŽNÁ</span>
          </button>

          {/* NEJDU Button */}
          <button
            onClick={() => handleSetAttendance('NO')}
            disabled={isPast}
            title={isPast ? 'Událost již proběhla – účast nelze měnit' : undefined}
            className={`flex-1 py-1.5 sm:py-2 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center space-x-1.5 transition ${
              isPast ? 'cursor-not-allowed' : 'cursor-pointer'
            } ${
              currentUserAttendance === 'NO'
                ? isPast
                  ? 'bg-rose-800 text-slate-100 ring-1 ring-rose-500/50'
                  : 'bg-rose-600 text-white shadow-md shadow-rose-600/30 ring-2 ring-rose-400/60'
                : isPast
                  ? 'bg-slate-800/50 text-slate-500 border border-slate-700/50 opacity-60'
                  : 'bg-slate-800/90 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20'
            }`}
          >
            <XCircle className="w-4 h-4 shrink-0" />
            <span>NEJDU</span>
          </button>
        </div>

      </div>

      {/* Účast zobrazená přímo v panelu události jako jednořádkový seznam účastníků v barevných boxech */}
      <div className="p-3.5 sm:p-4 space-y-2 border-b border-slate-200 bg-white">
        
        {/* Sekce 1: Zúčastní se (Zelené pozadí - výchozí expandovaná) */}
        <div className="border border-emerald-200/90 rounded-xl overflow-hidden bg-emerald-50/40 shadow-xs">
          <button
            type="button"
            onClick={() => setIsYesExpanded(!isYesExpanded)}
            className="w-full px-3.5 py-2 flex items-center justify-between text-left hover:bg-emerald-100/50 transition cursor-pointer"
          >
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-emerald-950">
                Zúčastní se
              </span>
              <span className="bg-emerald-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                {yesList.length}
              </span>
            </div>
            <div className="flex items-center text-xs font-semibold text-emerald-700">
              <span className="mr-1">{isYesExpanded ? 'Skrýt' : 'Zobrazit'}</span>
              {isYesExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {isYesExpanded && (
            <div className="px-3.5 pb-2.5 pt-1 border-t border-emerald-100/80 bg-white/70">
              {yesList.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-1">Zatím nikdo nenahlásil účast.</p>
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

        {/* Sekce 2: Možná (Oranžové/žluté pozadí - výchozí kolapsovaná) */}
        <div className="border border-amber-200/90 rounded-xl overflow-hidden bg-amber-50/40 shadow-xs">
          <button
            type="button"
            onClick={() => setIsMaybeExpanded(!isMaybeExpanded)}
            className="w-full px-3.5 py-2 flex items-center justify-between text-left hover:bg-amber-100/50 transition cursor-pointer"
          >
            <div className="flex items-center space-x-2">
              <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-amber-950">
                Možná se zúčastní
              </span>
              <span className="bg-amber-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                {maybeList.length}
              </span>
            </div>
            <div className="flex items-center text-xs font-semibold text-amber-700">
              <span className="mr-1">{isMaybeExpanded ? 'Skrýt' : 'Zobrazit'}</span>
              {isMaybeExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {isMaybeExpanded && (
            <div className="px-3.5 pb-2.5 pt-1 border-t border-amber-100/80 bg-white/70">
              {maybeList.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-1">Zatím nikdo.</p>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {maybeList.map((item) => {
                    const displayName = getMemberDisplayName(item.userEmail, activeTeam, null, item.userName);
                    return (
                      <div
                        key={item.id}
                        className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500 text-white shadow-xs"
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

        {/* Sekce 3: Nezúčastní se (Červené pozadí - výchozí kolapsovaná) */}
        <div className="border border-rose-200/90 rounded-xl overflow-hidden bg-rose-50/40 shadow-xs">
          <button
            type="button"
            onClick={() => setIsNoExpanded(!isNoExpanded)}
            className="w-full px-3.5 py-2 flex items-center justify-between text-left hover:bg-rose-100/50 transition cursor-pointer"
          >
            <div className="flex items-center space-x-2">
              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-rose-950">
                Nezúčastní se
              </span>
              <span className="bg-rose-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                {noList.length}
              </span>
            </div>
            <div className="flex items-center text-xs font-semibold text-rose-700">
              <span className="mr-1">{isNoExpanded ? 'Skrýt' : 'Zobrazit'}</span>
              {isNoExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {isNoExpanded && (
            <div className="px-3.5 pb-2.5 pt-1 border-t border-rose-100/80 bg-white/70">
              {noList.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-1">Zatím nikdo.</p>
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

        {/* Sekce 4: Nevyjádřili se (Šedé pozadí - výchozí kolapsovaná) */}
        <div className="border border-slate-200/90 rounded-xl overflow-hidden bg-slate-50/60 shadow-xs">
          <button
            type="button"
            onClick={() => setIsUnrespondedExpanded(!isUnrespondedExpanded)}
            className="w-full px-3.5 py-2 flex items-center justify-between text-left hover:bg-slate-100/60 transition cursor-pointer"
          >
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-slate-800">
                Nevyjádřili se
              </span>
              <span className="bg-slate-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                {unrespondedList.length}
              </span>
            </div>
            <div className="flex items-center text-xs font-semibold text-slate-600">
              <span className="mr-1">{isUnrespondedExpanded ? 'Skrýt' : 'Zobrazit'}</span>
              {isUnrespondedExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {isUnrespondedExpanded && (
            <div className="px-3.5 pb-2.5 pt-1 border-t border-slate-200/80 bg-white/70">
              {unrespondedList.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-1">Všichni členové týmu se již vyjádřili.</p>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {unrespondedList.map((item) => (
                    <div
                      key={item.email}
                      className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-200 text-slate-700 shadow-xs border border-slate-300/60"
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

      {/* Realtime Event Chat / Diskuze k události */}
      <div className="p-4 sm:p-6 bg-slate-50/50">
        <button
          onClick={() => {
            setHasUserToggledChat(true);
            setIsChatExpanded(!isChatExpanded);
          }}
          className="w-full flex items-center justify-between text-left focus:outline-none group mb-2 cursor-pointer"
        >
          <div className="flex items-center space-x-2">
            <MessageSquare className={`w-4 h-4 ${messages.length > 0 ? 'text-emerald-600' : 'text-slate-400'}`} />
            <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
              <span>Diskuze k události</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                messages.length > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
              }`}>
                {messages.length}
              </span>
            </h3>
          </div>
          <div className="text-xs text-slate-500 flex items-center group-hover:text-slate-800">
            <span>{isChatExpanded ? 'Skrýt diskuzi' : messages.length === 0 ? 'Otevřít diskuzi' : 'Zobrazit diskuzi'}</span>
            {isChatExpanded ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
          </div>
        </button>

        {isChatExpanded && (
          <div className="mt-3 space-y-3">
            
            {/* Messages box */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 max-h-64 overflow-y-auto space-y-3 shadow-inner">
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
                            ? 'bg-emerald-600 text-white rounded-br-none shadow-sm'
                            : 'bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200/60'
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
              <div className="p-3 bg-slate-100/90 border border-slate-200 rounded-xl text-xs text-slate-500 text-center flex items-center justify-center space-x-2">
                <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Diskuze k této události je uzavřena, protože událost již proběhla.</span>
              </div>
            ) : (
              <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Napište zprávu k události..."
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm"
                />
                <button
                  type="submit"
                  disabled={sendingMsg || !newMessageText.trim()}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md text-xs font-semibold flex items-center space-x-1 transition disabled:opacity-50 cursor-pointer"
                >
                  <span>Odeslat</span>
                  <Send className="w-3.5 h-3.5 ml-1" />
                </button>
              </form>
            )}

          </div>
        )}
      </div>

    </div>
  );
};

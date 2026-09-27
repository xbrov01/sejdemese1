import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, Team, Event, NotificationItem } from './types';
import {
  db,
  collection,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  deleteDoc,
  addDoc
} from './lib/firebase';
import { Header } from './components/Header';
import { AuthModal } from './components/AuthModal';
import { TeamManagerModal } from './components/TeamManagerModal';
import { CreateEventModal } from './components/CreateEventModal';
import { PasswordResetModal } from './components/PasswordResetModal';
import { UserProfileModal } from './components/UserProfileModal';
import { NotificationModal } from './components/NotificationModal';
import { NativeAppModal } from './components/NativeAppModal';
import { EventCard } from './components/EventCard';
import { isEventPast } from './utils/eventUtils';
import { checkAndGenerateReminders, showBrowserNotification, sendEventCancelledNotifications } from './utils/notificationService';
import { getMemberDisplayName } from './utils/userUtils';
import { applyAppFontSize, getInitialFontSize } from './utils/fontSizeUtils';
import { setupNativeStatusBar, initPushNotifications, setupAndroidBackButton } from './lib/capacitor';
import { Calendar, Plus, RefreshCw, ShieldAlert, Sparkles, Users, Key, Palette, History, ChevronDown, ChevronUp, LayoutDashboard, Bell } from 'lucide-react';

const LOCAL_STORAGE_USER_KEY = 'sejdemese_active_user_email';
const PUSHED_NOTIFICATIONS_STORAGE_KEY = 'sejdemese_pushed_notif_ids';

const getStoredPushedNotificationIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem(PUSHED_NOTIFICATIONS_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
};

const markNotificationAsPushed = (id: string) => {
  try {
    const current = getStoredPushedNotificationIds();
    current.add(id);
    const arr = Array.from(current).slice(-200);
    localStorage.setItem(PUSHED_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(arr));
  } catch {
    // ignore
  }
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isPastEventsExpanded, setIsPastEventsExpanded] = useState(false);

  // Modals state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showNativeAppModal, setShowNativeAppModal] = useState(false);
  const [teamModalMode, setTeamModalMode] = useState<'create' | 'join' | 'members' | 'settings' | null>(null);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  const [loading, setLoading] = useState(true);

  // 0a. Inicializace nativního vzhledu StatusBaru pro Capacitor (Android & iOS)
  useEffect(() => {
    setupNativeStatusBar();
  }, []);

  // 0b. Inicializace Push notifikací při přihlášení uživatele
  useEffect(() => {
    if (currentUser?.email) {
      initPushNotifications(currentUser.email);
    }
  }, [currentUser?.email]);

  // 0c. Obsluha nativního tlačítka "Zpět" na Androidu (zavření aktivních oken)
  useEffect(() => {
    const cleanup = setupAndroidBackButton(() => {
      if (showNativeAppModal) {
        setShowNativeAppModal(false);
        return true;
      }
      if (showUserProfileModal) {
        setShowUserProfileModal(false);
        return true;
      }
      if (showNotificationModal) {
        setShowNotificationModal(false);
        return true;
      }
      if (teamModalMode) {
        setTeamModalMode(null);
        return true;
      }
      if (showCreateEventModal || editingEvent) {
        setShowCreateEventModal(false);
        setEditingEvent(null);
        return true;
      }
      return false;
    });

    return () => cleanup();
  }, [showNativeAppModal, showUserProfileModal, showNotificationModal, teamModalMode, showCreateEventModal, editingEvent]);

  // 0d. Inicializace a živá aplikace zvolené velikosti písma
  useEffect(() => {
    applyAppFontSize(getInitialFontSize(currentUser?.fontSize));
  }, [currentUser?.fontSize]);

  // 1. Poslech všech registrovaných uživatelů
  useEffect(() => {
    const usersRef = collection(db, 'users');
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      const uList: UserProfile[] = [];
      snapshot.forEach((docSnap) => {
        uList.push({ id: docSnap.id, ...docSnap.data() } as UserProfile);
      });
      setAllUsers(uList);
    }, (err) => {
      console.error('Chyba při načítání uživatelů:', err);
    });

    return () => unsubscribe();
  }, []);

  // 2. Obnovení uživatele z localStorage při prvním načtení
  useEffect(() => {
    const savedEmail = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
    if (savedEmail) {
      const userRef = doc(db, 'users', savedEmail);
      getDoc(userRef).then((snap) => {
        if (snap.exists()) {
          setCurrentUser({ id: snap.id, ...snap.data() } as UserProfile);
        } else {
          setShowAuthModal(true);
        }
        setLoading(false);
      }).catch(() => {
        setShowAuthModal(true);
        setLoading(false);
      });
    } else {
      setShowAuthModal(true);
      setLoading(false);
    }
  }, []);

  // 2b. Živý poslech změn profilu aktivního uživatele
  useEffect(() => {
    if (!currentUser?.email) return;
    const userRef = doc(db, 'users', currentUser.email);
    const unsubscribe = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        setCurrentUser({ id: snap.id, ...snap.data() } as UserProfile);
      }
    });
    return () => unsubscribe();
  }, [currentUser?.email]);

  // 3. Poslech týmů v reálném čase (filtrováno pro aktuálního uživatele)
  useEffect(() => {
    if (!currentUser) {
      setTeams([]);
      return;
    }

    const teamsRef = collection(db, 'teams');
    const unsubscribe = onSnapshot(teamsRef, (snapshot) => {
      const tList: Team[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Team;
        // Zobrazujeme týmy, kde je uživatel v členové NEBO které vytvořil
        if (data.memberEmails?.includes(currentUser.email) || data.createdBy === currentUser.email) {
          tList.push({ id: docSnap.id, ...data });
        }
      });
      setTeams(tList);

      // Pokud ještě nemáme zvolený tým ani 'ALL', nastavíme 'ALL' (Dashboard)
      if (tList.length > 0) {
        if (!activeTeamId) {
          setActiveTeamId('ALL');
        } else if (activeTeamId !== 'ALL' && !tList.some((t) => t.id === activeTeamId)) {
          setActiveTeamId('ALL');
        }
      } else {
        setActiveTeamId(null);
      }
    }, (err) => {
      console.error('Chyba při načítání týmů:', err);
    });

    return () => unsubscribe();
  }, [currentUser, activeTeamId]);

  // 4. Poslech událostí v reálném čase (pro aktivní tým nebo pro 'ALL' - všechny týmy)
  useEffect(() => {
    if (!currentUser || teams.length === 0 || !activeTeamId) {
      setEvents([]);
      setAllEvents([]);
      return;
    }

    const eventsRef = collection(db, 'events');
    const userTeamIds = new Set(teams.map((t) => t.id));

    const unsubscribe = onSnapshot(eventsRef, (snapshot) => {
      const allList: Event[] = [];
      const activeList: Event[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Event;
        if (userTeamIds.has(data.teamId)) {
          allList.push({ id: docSnap.id, ...data });
        }
        if (activeTeamId === 'ALL') {
          if (userTeamIds.has(data.teamId)) {
            activeList.push({ id: docSnap.id, ...data });
          }
        } else if (data.teamId === activeTeamId) {
          activeList.push({ id: docSnap.id, ...data });
        }
      });

      // Seřadit podle data a času vzestupně
      activeList.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
      allList.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

      setEvents(activeList);
      setAllEvents(allList);
    }, (err) => {
      console.error('Chyba při načítání událostí:', err);
    });

    return () => unsubscribe();
  }, [currentUser, activeTeamId, teams]);

  // 5. Poslech notifikací pro přihlášeného uživatele a spolehlivé zobrazení systémových push notifikací v reálném čase
  const isInitialNotificationLoad = useRef(true);
  const prevNotificationIdsRef = useRef<Set<string>>(new Set());
  const sessionMountTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!currentUser?.email) {
      setNotifications([]);
      isInitialNotificationLoad.current = true;
      prevNotificationIdsRef.current.clear();
      return;
    }

    const currentEmailLower = currentUser.email.toLowerCase();
    const notificationsRef = collection(db, 'notifications');
    const unsubscribe = onSnapshot(notificationsRef, (snapshot) => {
      const list: NotificationItem[] = [];
      const newIncomingToNotify: NotificationItem[] = [];
      const storedPushedIds = getStoredPushedNotificationIds();

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as NotificationItem;
        if (data.userEmail && data.userEmail.toLowerCase() === currentEmailLower) {
          const item = { id: docSnap.id, ...data };
          list.push(item);

          // Pokud se nejedná o úvodní načtení (znovunačtení stránky) a notifikace je nová, nepřečtená a dosud nezobrazená
          if (!isInitialNotificationLoad.current) {
            const isKnown = prevNotificationIdsRef.current.has(docSnap.id) || storedPushedIds.has(docSnap.id);
            const createdAtTime = data.createdAt ? new Date(data.createdAt).getTime() : 0;
            const isFresh = createdAtTime >= sessionMountTimeRef.current - 15000;

            if (!isKnown && !data.read && isFresh) {
              newIncomingToNotify.push(item);
            }
          }
        }
      });

      // Pokud se jedná o úvodní načtení historie po otevření/znovunačtení aplikace,
      // uložíme všechny stávající notifikace do známých, aby se nespouštěla systémová upozornění
      if (isInitialNotificationLoad.current) {
        list.forEach((item) => {
          markNotificationAsPushed(item.id);
        });
      }

      // Aktualizujeme paměťovou sadu ID notifikací
      prevNotificationIdsRef.current = new Set(list.map((n) => n.id));

      // Pokud dorazila nová notifikace za běhu aplikace v reálném čase, zobrazíme systémovou notifikaci
      if (!isInitialNotificationLoad.current && newIncomingToNotify.length > 0) {
        newIncomingToNotify.forEach((newItem) => {
          markNotificationAsPushed(newItem.id);
          showBrowserNotification(newItem.title, newItem.message, '/favicon.ico', {
            eventId: newItem.eventId,
            teamId: newItem.teamId,
            tag: `sejdemese-${newItem.id}`,
            url: window.location.origin,
          });
        });
      }

      isInitialNotificationLoad.current = false;

      // Seřadit nejnovější nahoře
      list.sort((a, b) => {
        const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tB - tA;
      });

      setNotifications(list);
    }, (err) => {
      console.error('Chyba při načítání notifikací:', err);
    });

    return () => unsubscribe();
  }, [currentUser?.email]);

  // 6. Pravidelná kontrola a generování notifikací (připomenutí a účast)
  useEffect(() => {
    if (!currentUser || teams.length === 0 || allEvents.length === 0) return;

    const runCheck = () => {
      checkAndGenerateReminders(currentUser, teams, allEvents, allUsers);
    };

    runCheck();
    const interval = setInterval(runCheck, 60000); // každou minutu

    return () => clearInterval(interval);
  }, [currentUser, teams, allEvents, allUsers]);

  // Přihlášení / výběr uživatele
  const handleLoginSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    localStorage.setItem(LOCAL_STORAGE_USER_KEY, user.email);
    setShowAuthModal(false);
  };

  const handleSignOut = () => {
    localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
    setCurrentUser(null);
    setShowAuthModal(true);
  };

  // Mazání / zrušení události (Správce)
  const handleDeleteEvent = async (eventId: string) => {
    if (!window.confirm('Opravdu chcete tuto událost zrušit a smazat?')) return;
    try {
      const eventToDelete = allEvents.find((e) => e.id === eventId) || events.find((e) => e.id === eventId);
      if (eventToDelete && currentUser && !isEventPast(eventToDelete)) {
        const team = teams.find((t) => t.id === eventToDelete.teamId);
        if (team) {
          const cancellerDisplayName = getMemberDisplayName(currentUser.email, team, currentUser);
          await sendEventCancelledNotifications(
            eventToDelete,
            team,
            currentUser.email,
            cancellerDisplayName,
            allUsers
          );
        }
      }
      await deleteDoc(doc(db, 'events', eventId));
    } catch (err) {
      console.error('Chyba při mazání události:', err);
    }
  };

  // Aktivní tým objekt (null pokud je vybráno 'ALL')
  const activeTeam = activeTeamId === 'ALL' ? null : (teams.find((t) => t.id === activeTeamId) || null);
  const isAllTeamsSelected = activeTeamId === 'ALL';
  const unreadNotificationCount = notifications.filter((n) => !n.read).length;

  // Filtrování událostí na nadcházející a uplynulé
  const upcomingEvents = events.filter((e) => !isEventPast(e));
  const pastEvents = events
    .filter((e) => isEventPast(e))
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));

  // Ukázková data (Seed) pro rychlý start při prvním spuštění
  const seedDemoData = async () => {
    if (!currentUser) return;
    try {
      // 1. Vytvoření ukázkového týmu
      const demoTeamCode = 'FUTSAL-888';
      const teamRef = await addDoc(collection(db, 'teams'), {
        name: 'Středeční Futsal Club',
        code: demoTeamCode,
        createdBy: currentUser.email,
        cardBgColor: '#064e3b',
        cardBgImage: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80',
        memberEmails: [
          currentUser.email,
          'petr.svoboda@email.cz',
          'lucie.kucerova@email.cz',
          'martin.dvorak@email.cz'
        ],
        createdAt: new Date().toISOString(),
      });

      // 2. Vytvoření dvou ukázkových událostí
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 3);

      const event1Ref = await addDoc(collection(db, 'events'), {
        teamId: teamRef.id,
        title: 'Ligový zápas vs. TJ Sokol Krč',
        date: nextWeek.toISOString().split('T')[0],
        time: '18:30',
        location: 'Sportovní hala ZŠ Na Planině, Praha 4',
        createdBy: currentUser.email,
        createdAt: new Date().toISOString(),
        reminders: [24, 2],
      });

      // 3. Vytvoření vzorové docházky
      await setDoc(doc(db, 'events', event1Ref.id, 'attendance', currentUser.email), {
        userEmail: currentUser.email,
        userName: currentUser.name,
        status: 'YES',
        updatedAt: new Date().toISOString(),
      });

      await setDoc(doc(db, 'events', event1Ref.id, 'attendance', 'petr.svoboda@email.cz'), {
        userEmail: 'petr.svoboda@email.cz',
        userName: 'Petr Svoboda',
        status: 'YES',
        updatedAt: new Date().toISOString(),
      });

      await setDoc(doc(db, 'events', event1Ref.id, 'attendance', 'lucie.kucerova@email.cz'), {
        userEmail: 'lucie.kucerova@email.cz',
        userName: 'Lucie Kučerová',
        status: 'MAYBE',
        updatedAt: new Date().toISOString(),
      });

      await setDoc(doc(db, 'events', event1Ref.id, 'attendance', 'martin.dvorak@email.cz'), {
        userEmail: 'martin.dvorak@email.cz',
        userName: 'Martin Dvořák',
        status: 'NO',
        updatedAt: new Date().toISOString(),
      });

      // 4. Vzorková zpráva v chatu
      await addDoc(collection(db, 'events', event1Ref.id, 'messages'), {
        authorName: 'Petr Svoboda',
        authorEmail: 'petr.svoboda@email.cz',
        text: 'Ahoj všichni! Beru dnes červené dresy. Sraz v šatně v 18:15!',
        timestamp: new Date(),
      });

      setActiveTeamId(teamRef.id);
    } catch (err) {
      console.error('Chyba při zakládání ukázkových dat:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex items-center space-x-3">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
          <span className="font-semibold text-sm">Načítání aplikace Sejdeme se...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950 pb-20 sm:pb-8">
      
      {/* Header */}
      {currentUser && (
        <Header
          currentUser={currentUser}
          teams={teams}
          activeTeam={activeTeam}
          isAllTeamsSelected={isAllTeamsSelected}
          unreadNotificationCount={unreadNotificationCount}
          onOpenNotifications={() => setShowNotificationModal(true)}
          onSelectTeam={(t) => setActiveTeamId(t.id)}
          onSelectAllTeams={() => setActiveTeamId('ALL')}
          onOpenCreateTeam={() => setTeamModalMode('create')}
          onOpenJoinTeam={() => setTeamModalMode('join')}
          onOpenManageMembers={() => setTeamModalMode('members')}
          onOpenTeamSettings={() => setTeamModalMode('settings')}
          onOpenCreateEvent={() => setShowCreateEventModal(true)}
          onOpenProfile={() => setShowUserProfileModal(true)}
          onSignOut={handleSignOut}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentUser ? (
          <>
            {teams.length === 0 ? (
              <div className="bg-slate-900 rounded-2xl p-8 text-center max-w-lg mx-auto shadow-2xl my-6">
                <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white">Vyberte nebo se připojte k týmu</h3>
                <p className="text-xs text-slate-400 mt-1 mb-5">
                  Pro zobrazení docházky a plánovaných událostí se připojte k týmu pomocí kódu nebo vytvořte nový tým.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    onClick={() => setTeamModalMode('join')}
                    className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md transition cursor-pointer"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>Připojit se k týmu</span>
                  </button>
                  {currentUser.role === 'admin' && (
                    <button
                      onClick={() => setTeamModalMode('create')}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Vytvořit nový tým</span>
                    </button>
                  )}
                </div>
              </div>
            ) : isAllTeamsSelected ? (
              /* ================== PŘEHLED / DASHBOARD: VŠECHNY TÝMY ================== */
              <div className="space-y-6">
                <div className="bg-slate-900 p-5 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      Úvodní přehled • Všechny mé týmy ({teams.length})
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2 mt-0.5">
                      Nadcházející události
                      <span className="text-xs font-black text-slate-950 bg-emerald-400 px-2.5 py-0.5 rounded-full">
                        {upcomingEvents.length}
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Kompletní přehled tréninků a zápasů napříč všemi vašimi týmy.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Rychlý přepínač týmu (filtry pro dotyk i myš - solid buttons, no outline) */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
                      <span className="text-[11px] font-semibold text-slate-400 mr-1 hidden sm:inline">
                        Přejít na tým:
                      </span>
                      {teams.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setActiveTeamId(t.id)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-slate-200 text-xs rounded-xl font-bold transition shrink-0 cursor-pointer shadow-xs"
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>

                    {events.length === 0 && (
                      <button
                        type="button"
                        onClick={seedDemoData}
                        className="px-3.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold rounded-xl flex items-center space-x-1.5 transition cursor-pointer shadow-xs"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Vložit ukázková data (Demo)</span>
                      </button>
                    )}
                  </div>
                </div>

                {upcomingEvents.length === 0 ? (
                  <div className="bg-slate-900 rounded-2xl p-12 text-center shadow-lg">
                    <div className="w-12 h-12 bg-slate-800 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <Calendar className="w-6 h-6" />
                    </div>
                    <h4 className="text-base font-bold text-white">
                      Žádné nadcházející události
                    </h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                      V žádném z vašich týmů zatím nejsou naplánovány žádné nadcházející tréninky ani zápasy.
                    </p>

                    {currentUser.role === 'admin' ? (
                      <button
                        onClick={() => setShowCreateEventModal(true)}
                        className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-black rounded-xl text-xs inline-flex items-center space-x-2 shadow-md transition cursor-pointer"
                      >
                        <Plus className="w-4 h-4 stroke-[3]" />
                        <span>Vytvořit novou událost</span>
                      </button>
                    ) : (
                      <p className="text-xs text-slate-400 italic">
                        Nové události může vytvářet pouze Správce týmu.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {upcomingEvents.map((event) => {
                      const eventTeam = teams.find((t) => t.id === event.teamId) || null;
                      return (
                        <EventCard
                          key={event.id}
                          event={event}
                          currentUser={currentUser}
                          activeTeam={eventTeam}
                          allUsers={allUsers}
                          showTeamBadge={true}
                          onEditEvent={(ev) => setEditingEvent(ev)}
                          onDeleteEvent={handleDeleteEvent}
                          isPast={false}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            ) : activeTeam ? (
              /* ================== JEDNOTLIVÝ TÝM ================== */
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-4 sm:p-5 rounded-2xl shadow-xl">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                      Aktivní tým #{activeTeam.code}
                    </div>
                    <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2 mt-0.5">
                      <Users className="w-5 h-5 text-emerald-400" />
                      {activeTeam.name}
                      <span className="text-xs font-normal text-slate-400">
                        ({activeTeam.memberEmails?.length || 1} členů)
                      </span>
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTeamId('ALL')}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition cursor-pointer shadow-xs flex items-center gap-1"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5 text-emerald-400" />
                      <span>← Zpět na Vše</span>
                    </button>
                    {currentUser.role === 'admin' && (
                      <button
                        type="button"
                        onClick={() => setTeamModalMode('settings')}
                        className="px-3 py-1.5 bg-purple-900/70 hover:bg-purple-800 active:bg-purple-700 text-purple-200 text-xs font-bold rounded-xl flex items-center space-x-1.5 transition cursor-pointer shadow-xs"
                        title="Změnit výchozí barvu a obrázek pozadí karty události"
                      >
                        <Palette className="w-3.5 h-3.5 text-purple-300" />
                        <span>Vzhled karet</span>
                      </button>
                    )}
                    {events.length === 0 && (
                      <button
                        type="button"
                        onClick={seedDemoData}
                        className="px-3.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold rounded-xl flex items-center space-x-1.5 transition cursor-pointer shadow-xs"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Vložit ukázková data (Demo)</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-8">
                  {/* Nadcházející události */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-emerald-400" />
                        <span>Nadcházející události</span>
                        <span className="text-xs font-black text-slate-950 bg-emerald-400 px-2.5 py-0.5 rounded-full">
                          {upcomingEvents.length}
                        </span>
                      </h3>
                    </div>

                    {upcomingEvents.length === 0 ? (
                      <div className="bg-slate-900 rounded-2xl p-10 text-center shadow-lg">
                        <div className="w-12 h-12 bg-slate-800 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                          <Calendar className="w-6 h-6" />
                        </div>
                        <h4 className="text-base font-bold text-white">
                          Žádné nadcházející události
                        </h4>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                          V tomto týmu zatím nejsou naplánovány žádné nadcházející tréninky ani zápasy.
                        </p>

                        {currentUser.role === 'admin' && (
                          <button
                            onClick={() => setShowCreateEventModal(true)}
                            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-black rounded-xl text-xs inline-flex items-center space-x-2 shadow-md transition cursor-pointer"
                          >
                            <Plus className="w-4 h-4 stroke-[3]" />
                            <span>Vytvořit novou událost</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {upcomingEvents.map((event) => (
                          <EventCard
                            key={event.id}
                            event={event}
                            currentUser={currentUser}
                            activeTeam={activeTeam}
                            allUsers={allUsers}
                            onEditEvent={(ev) => setEditingEvent(ev)}
                            onDeleteEvent={handleDeleteEvent}
                            isPast={false}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Samostatný kolapsovaný panel pro uplynulé události na spodní části stránky */}
                  <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-xl">
                    <button
                      type="button"
                      onClick={() => setIsPastEventsExpanded(!isPastEventsExpanded)}
                      className="w-full p-4 sm:p-5 flex items-center justify-between text-left bg-slate-850 hover:bg-slate-800 transition cursor-pointer"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 shrink-0">
                          <History className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="text-sm sm:text-base font-bold text-white">
                              Uplynulé události
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300">
                              {pastEvents.length}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Archiv proběhlých událostí (docházka a diskuze jsou uzavřeny)
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-300 bg-slate-800 px-3 py-1.5 rounded-xl shadow-xs">
                        <span>{isPastEventsExpanded ? 'Skrýt uplynulé' : 'Zobrazit uplynulé'}</span>
                        {isPastEventsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>

                    {isPastEventsExpanded && (
                      <div className="p-4 sm:p-5 pt-2 border-t border-slate-800 space-y-6 bg-slate-950/60">
                        {pastEvents.length === 0 ? (
                          <div className="text-center py-8 text-xs text-slate-400 italic">
                            V tomto týmu zatím nejsou žádné uplynulé události.
                          </div>
                        ) : (
                          pastEvents.map((event) => (
                            <EventCard
                              key={event.id}
                              event={event}
                              currentUser={currentUser}
                              activeTeam={activeTeam}
                              allUsers={allUsers}
                              onDeleteEvent={handleDeleteEvent}
                              isPast={true}
                            />
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold text-white">Přihlášení do aplikace</h2>
            <p className="text-sm text-slate-400 mt-1">Zadejte své údaje v zobrazeném okně.</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-850 py-6 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="font-semibold text-slate-300">
            Sejdeme se — Týmová docházka & Realtime chat
          </div>
          <div className="text-slate-500">
            Všechna data jsou ukládána do cloudové databáze Firebase Firestore
          </div>
        </div>
      </footer>

      {/* Ergonomic Mobile Bottom Navigation Bar */}
      {currentUser && (
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 px-3 py-2 flex items-center justify-around shadow-2xl">
          <button
            type="button"
            onClick={() => setActiveTeamId('ALL')}
            className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition cursor-pointer ${
              isAllTeamsSelected ? 'bg-slate-800 text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[10px]">Přehled</span>
          </button>

          {teams.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (isAllTeamsSelected && teams[0]) {
                  setActiveTeamId(teams[0].id);
                } else {
                  setTeamModalMode('members');
                }
              }}
              className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition cursor-pointer ${
                !isAllTeamsSelected ? 'bg-slate-800 text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-5 h-5" />
              <span className="text-[10px]">Tým</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowNotificationModal(true)}
            className="flex flex-col items-center gap-1 py-1 px-4 rounded-xl text-slate-400 hover:text-emerald-400 transition cursor-pointer relative"
          >
            <div className="relative">
              <Bell className="w-5 h-5" />
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center shadow-xs animate-pulse">
                  {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                </span>
              )}
            </div>
            <span className="text-[10px]">Zprávy</span>
          </button>
        </nav>
      )}

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          onLoginSuccess={handleLoginSuccess}
          existingUsers={allUsers}
        />
      )}

      {/* Team Manager Modal */}
      {teamModalMode && currentUser && (
        <TeamManagerModal
          mode={teamModalMode}
          currentUser={currentUser}
          activeTeam={activeTeam}
          allUsers={allUsers}
          onClose={() => setTeamModalMode(null)}
          onTeamCreated={(newTeam) => {
            setActiveTeamId(newTeam.id);
          }}
          onTeamJoined={(teamId) => {
            setActiveTeamId(teamId);
          }}
          onTeamUpdated={(updatedTeam) => {
            setTeams((prev) => prev.map((t) => (t.id === updatedTeam.id ? updatedTeam : t)));
          }}
        />
      )}

      {/* Create / Edit Event Modal */}
      {(showCreateEventModal || editingEvent) && currentUser && (
        <CreateEventModal
          currentUser={currentUser}
          activeTeam={activeTeam}
          teams={teams}
          allUsers={allUsers}
          eventToEdit={editingEvent}
          onClose={() => {
            setShowCreateEventModal(false);
            setEditingEvent(null);
          }}
          onEventCreated={() => {
            // events update automatically via onSnapshot
          }}
          onEventUpdated={() => {
            // events update automatically via onSnapshot
          }}
        />
      )}

      {/* Notifications Modal */}
      {showNotificationModal && currentUser && (
        <NotificationModal
          currentUser={currentUser}
          notifications={notifications}
          onClose={() => setShowNotificationModal(false)}
          onOpenNativeAppModal={() => setShowNativeAppModal(true)}
          onSelectEvent={(eventId, teamId) => {
            if (teamId) {
              setActiveTeamId(teamId);
            }
            setShowNotificationModal(false);
          }}
        />
      )}

      {/* Mandatory Password Reset Modal */}
      {currentUser && currentUser.requirePasswordReset && (
        <PasswordResetModal
          currentUser={currentUser}
          onPasswordChanged={(updatedUser) => {
            setCurrentUser(updatedUser);
          }}
        />
      )}

      {/* User Profile & Team Nickname Modal */}
      {showUserProfileModal && currentUser && (
        <UserProfileModal
          currentUser={currentUser}
          activeTeam={activeTeam}
          teams={teams}
          onClose={() => setShowUserProfileModal(false)}
          onOpenNativeAppModal={() => setShowNativeAppModal(true)}
          onSignOut={handleSignOut}
          onUpdateUser={(updatedUser) => {
            setCurrentUser(updatedUser);
          }}
          onUpdateTeamNickname={(teamId, nickname) => {
            setTeams((prevTeams) =>
              prevTeams.map((t) => {
                if (t.id === teamId) {
                  const updatedNicknames = { ...(t.nicknames || {}) };
                  if (nickname) {
                    updatedNicknames[currentUser.email] = nickname;
                  } else {
                    delete updatedNicknames[currentUser.email];
                  }
                  return { ...t, nicknames: updatedNicknames };
                }
                return t;
              })
            );
          }}
        />
      )}

      {/* Native Mobile App (Capacitor) Modal & Guide */}
      {showNativeAppModal && currentUser && (
        <NativeAppModal
          currentUser={currentUser}
          onClose={() => setShowNativeAppModal(false)}
        />
      )}

    </div>
  );
}

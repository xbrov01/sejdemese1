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
  addDoc,
  updateDoc,
  auth,
  fbSignOut
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
import { BottomToolbar } from './components/BottomToolbar';
import { isEventPast } from './utils/eventUtils';
import { checkAndGenerateReminders, showBrowserNotification, sendEventCancelledNotifications, syncUpcomingNativeReminders } from './utils/notificationService';
import { getMemberDisplayName } from './utils/userUtils';
import { applyAppFontSize, getInitialFontSize } from './utils/fontSizeUtils';
import { setupNativeStatusBar, initPushNotifications, setupAndroidBackButton, setupAppStateListener } from './lib/capacitor';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { isUserSuperAdmin, isUserTeamAdmin } from './utils/superUserUtils';
import { Calendar, Plus, RefreshCw, ShieldAlert, Sparkles, Users, Key, Palette, History, ChevronDown, ChevronUp, LayoutDashboard, Bell, Settings, Trash2 } from 'lucide-react';

const LOCAL_STORAGE_USER_KEY = 'sejdemese_active_user_email';
const PUSHED_NOTIFICATIONS_STORAGE_PREFIX = 'sejdemese_pushed_notif_ids_';

const getStoredPushedNotificationIds = (userEmail: string): Set<string> => {
  try {
    const raw = localStorage.getItem(`${PUSHED_NOTIFICATIONS_STORAGE_PREFIX}${userEmail.toLowerCase()}`);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
};

const markNotificationAsPushed = (userEmail: string, id: string) => {
  try {
    const current = getStoredPushedNotificationIds(userEmail);
    current.add(id);
    const arr = Array.from(current).slice(-500);
    localStorage.setItem(`${PUSHED_NOTIFICATIONS_STORAGE_PREFIX}${userEmail.toLowerCase()}`, JSON.stringify(arr));
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
  const [eventToDeleteConfirm, setEventToDeleteConfirm] = useState<Event | null>(null);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);

  // Modals state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showNativeAppModal, setShowNativeAppModal] = useState(false);
  const [teamModalMode, setTeamModalMode] = useState<'create' | 'join' | 'members' | 'settings' | null>(null);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  const [loading, setLoading] = useState(true);

  // 0a. Inicializace nativního vzhledu StatusBaru a nativních notifikací pro Capacitor (Android & iOS)
  useEffect(() => {
    setupNativeStatusBar();
    initPushNotifications();
  }, []);

  // 0b. Inicializace Push notifikací při přihlášení uživatele (přiřazení tokenu k uživateli)
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
      if (eventToDeleteConfirm) {
        setEventToDeleteConfirm(null);
        return true;
      }
      return false;
    });

    return () => cleanup();
  }, [showNativeAppModal, showUserProfileModal, showNotificationModal, teamModalMode, showCreateEventModal, editingEvent, eventToDeleteConfirm]);

  // 0c1. Zámek posouvání hlavní obrazovky při otevřeném jakémkoliv modálním okně
  // Zabraňuje rolování stránky na pozadí a eliminuje duplicitní posuvníky
  const isAnyModalOpen = Boolean(
    showNativeAppModal ||
    showUserProfileModal ||
    showNotificationModal ||
    teamModalMode ||
    showCreateEventModal ||
    editingEvent ||
    eventToDeleteConfirm ||
    !currentUser ||
    currentUser?.requirePasswordReset
  );

  useEffect(() => {
    if (isAnyModalOpen) {
      const originalBodyOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
      };
    }
  }, [isAnyModalOpen]);

  // 0c2. Reakce na přechod aplikace do pozadí / popředí:
  // Při přechodu do pozadí ihned aktualizujeme systémový rozvrh budoucích oznámení
  useEffect(() => {
    const cleanup = setupAppStateListener((isActive) => {
      if (!isActive && currentUser && teams.length > 0 && allEvents.length > 0) {
        syncUpcomingNativeReminders(currentUser, teams, allEvents);
      }
    });
    return () => cleanup();
  }, [currentUser, teams, allEvents]);

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
    }, (err) => {
      console.warn('Upozornění: Dočasně nedostupný profil uživatele (offline mód):', err);
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
      const isSuper = isUserSuperAdmin(currentUser);
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Team;
        // Zobrazujeme týmy, kde je uživatel členem, případně VŠECHNY týmy pro superadmina
        if (isSuper || data.memberEmails?.includes(currentUser.email)) {
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
      const storedPushedIds = getStoredPushedNotificationIds(currentUser.email);

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as NotificationItem;
        if (data.userEmail && data.userEmail.toLowerCase() === currentEmailLower) {
          const item = { id: docSnap.id, ...data };
          list.push(item);

          // Zda je notifikace již známa nebo označena jako doručená/přečtená
          const isKnown = prevNotificationIdsRef.current.has(docSnap.id) || storedPushedIds.has(docSnap.id) || !!data.pushed;
          const createdAtTime = data.createdAt ? new Date(data.createdAt).getTime() : 0;
          // Notifikace vytvořená až po startu této session
          const isCreatedDuringSession = createdAtTime >= sessionMountTimeRef.current - 5000;

          // Push notifikaci vyvoláme pouze pokud:
          // 1. Nejedná se o první načtení při spuštění aplikace
          // 2. Notifikace dosud nebyla zobrazena (není known ani v paměti, ani v localStorage, ani v DB s pushed=true)
          // 3. Notifikace je nepřečtená
          // 4. Vznikla v reálném čase za běhu aktuální relace
          if (!isInitialNotificationLoad.current && !isKnown && !data.read && isCreatedDuringSession) {
            newIncomingToNotify.push(item);
          }
        }
      });

      // Při úvodním načtení označíme všechny existující notifikace jako doručené v paměti i v localStorage,
      // aby se při jakémkoliv dalším snapshotu nebo po restartu neopakovaly
      if (isInitialNotificationLoad.current) {
        list.forEach((item) => {
          markNotificationAsPushed(currentUser.email, item.id);
        });
      }

      // Aktualizujeme paměťovou sadu ID notifikací
      prevNotificationIdsRef.current = new Set(list.map((n) => n.id));

      // Pokud dorazila nová notifikace za běhu aplikace v reálném čase, zobrazíme systémovou notifikaci
      if (!isInitialNotificationLoad.current && newIncomingToNotify.length > 0) {
        newIncomingToNotify.forEach((newItem) => {
          markNotificationAsPushed(currentUser.email, newItem.id);

          // Také označíme pushed: true přímo v databázi, aby se neopakovala na žádném dalším zařízení ani po restartu
          try {
            updateDoc(doc(db, 'notifications', newItem.id), { pushed: true }).catch(() => {});
          } catch {}

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
      // Naplánovat budoucí notifikace do operačního systému pro bezproblémové doručení i na pozadí / při uspané aplikaci
      syncUpcomingNativeReminders(currentUser, teams, allEvents);
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
    fbSignOut(auth).catch(() => {});
    if (Capacitor.isNativePlatform()) {
      FirebaseAuthentication.signOut().catch(() => {});
    }
    setCurrentUser(null);
    setShowAuthModal(true);
  };

  // Mazání / zrušení události (Správce) - otevírá potvrzovací modální dialog (spolehlivě funguje na webu, v iframe i na mobilu)
  const handleDeleteEvent = (eventId: string) => {
    const eventToDelete = allEvents.find((e) => e.id === eventId) || events.find((e) => e.id === eventId);
    if (eventToDelete) {
      setEventToDeleteConfirm(eventToDelete);
    } else {
      // Případ, kdy událost nebyla nalezena v paměti: smazat přímo
      deleteDoc(doc(db, 'events', eventId)).catch(console.error);
    }
  };

  const confirmDeleteEvent = async (eventToDelete: Event) => {
    setIsDeletingEvent(true);
    try {
      if (currentUser && !isEventPast(eventToDelete)) {
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
      await deleteDoc(doc(db, 'events', eventToDelete.id));
      setEventToDeleteConfirm(null);
    } catch (err) {
      console.error('Chyba při mazání události:', err);
    } finally {
      setIsDeletingEvent(false);
    }
  };

  // Zpracování smazání týmu správcem
  const handleTeamDeleted = (deletedTeamId: string) => {
    if (activeTeamId === deletedTeamId) {
      setActiveTeamId('ALL');
    }
    setTeamModalMode(null);
    setTeams((prev) => prev.filter((t) => t.id !== deletedTeamId));
    setEvents((prev) => prev.filter((e) => e.teamId !== deletedTeamId));
    setAllEvents((prev) => prev.filter((e) => e.teamId !== deletedTeamId));
  };

  // Zpracování opuštění týmu uživatelem
  const handleLeaveTeam = (teamId: string) => {
    if (activeTeamId === teamId) {
      setActiveTeamId('ALL');
    }
    setTeams((prev) =>
      prev
        .map((t) => {
          if (t.id === teamId) {
            return {
              ...t,
              memberEmails: (t.memberEmails || []).filter(
                (e) => e.toLowerCase() !== currentUser?.email?.toLowerCase()
              ),
            };
          }
          return t;
        })
        .filter((t) => isUserSuperAdmin(currentUser) || (t.memberEmails || []).includes(currentUser?.email || ''))
    );
  };

  // Aktivní tým objekt (null pokud je vybráno 'ALL')
  const activeTeam = activeTeamId === 'ALL' ? null : (teams.find((t) => t.id === activeTeamId) || null);
  const isAllTeamsSelected = activeTeamId === 'ALL';
  const isCurrentTeamAdmin = isUserTeamAdmin(currentUser, activeTeam);
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-800">
        <div className="flex items-center space-x-3 bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-xs">
          <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
          <span className="font-semibold text-sm">Načítání aplikace Sejdeme se...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950 pb-20 sm:pb-8">
      
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
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center max-w-lg mx-auto shadow-xs my-6">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-emerald-100">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Vyberte nebo se připojte k týmu</h3>
                <p className="text-xs text-slate-500 mt-1 mb-5">
                  Pro zobrazení docházky a plánovaných událostí se připojte k týmu pomocí kódu nebo vytvořte nový tým.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    onClick={() => setTeamModalMode('join')}
                    className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>Připojit se k týmu</span>
                  </button>
                  <button
                    onClick={() => setTeamModalMode('create')}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer border border-slate-200"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Vytvořit nový tým</span>
                  </button>
                </div>
              </div>
            ) : isAllTeamsSelected ? (
              /* ================== PŘEHLED / DASHBOARD: VŠECHNY TÝMY ================== */
              <div className="space-y-6">
                <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Úvodní přehled • Všechny mé týmy ({teams.length})
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-950 flex items-center gap-2 mt-0.5">
                      Nadcházející události
                      <span className="text-xs font-black text-slate-950 bg-emerald-400 px-2.5 py-0.5 rounded-full">
                        {upcomingEvents.length}
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Kompletní přehled tréninků a zápasů napříč všemi vašimi týmy.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Rychlý přepínač týmu - spojitý flow bez scrollbaru */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-slate-500 mr-1 hidden sm:inline">
                        Přejít na tým:
                      </span>
                      {teams.map((t) => {
                        const upcomingCount = allEvents.filter((e) => e.teamId === t.id && !isEventPast(e)).length;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setActiveTeamId(t.id)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 text-xs rounded-xl font-bold transition cursor-pointer shadow-2xs border border-slate-200 flex items-center gap-1.5"
                          >
                            <span>{t.name}</span>
                            {upcomingCount > 0 && (
                              <span className="text-[10px] font-black text-slate-950 bg-emerald-400 px-1.5 py-0.2 rounded-full min-w-4 text-center leading-tight">
                                {upcomingCount}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {events.length === 0 && (
                      <button
                        type="button"
                        onClick={seedDemoData}
                        className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl flex items-center space-x-1.5 transition cursor-pointer border border-emerald-200 shadow-2xs"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Vložit ukázková data (Demo)</span>
                      </button>
                    )}
                  </div>
                </div>

                {upcomingEvents.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
                    <div className="w-12 h-12 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <Calendar className="w-6 h-6" />
                    </div>
                    <h4 className="text-base font-bold text-slate-900">
                      Žádné nadcházející události
                    </h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                      V žádném z vašich týmů zatím nejsou naplánovány žádné nadcházející tréninky ani zápasy.
                    </p>

                    {isCurrentTeamAdmin && (
                      <p className="text-xs text-slate-500 italic">
                        Pro přidání nové události otevřete kartu konkrétního týmu.
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
                <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200/90 p-4 sm:p-5 rounded-2xl shadow-xs">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">
                      Aktivní tým #{activeTeam.code}
                    </div>
                    <h2 className="text-lg sm:text-xl font-black text-slate-950 flex items-center gap-2 mt-0.5">
                      <Users className="w-5 h-5 text-emerald-600" />
                      {activeTeam.name}
                      <span className="text-xs font-normal text-slate-500">
                        (Počet členů: {activeTeam.memberEmails?.length || 1})
                      </span>
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTeamId('ALL')}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition cursor-pointer border border-slate-200 shadow-2xs flex items-center gap-1"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="hidden sm:inline">← Zpět na Vše</span>
                      <span className="sm:hidden">← Vše</span>
                    </button>
                    {isCurrentTeamAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() => setTeamModalMode('settings')}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl flex items-center space-x-1.5 transition cursor-pointer border border-slate-200 shadow-2xs"
                          title="Nastavení týmu, změna kódu a vzhledu událostí"
                        >
                          <Settings className="w-3.5 h-3.5 text-slate-600" />
                          <span className="hidden sm:inline">Nastavení týmu</span>
                          <span className="sm:hidden">Nastavení</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCreateEventModal(true)}
                          className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 text-xs font-black rounded-xl flex items-center space-x-1.5 transition cursor-pointer shadow-xs"
                          title="Vytvořit novou událost pro tento tým"
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[3]" />
                          <span className="hidden sm:inline">Nová událost</span>
                          <span className="sm:hidden">Nová</span>
                        </button>
                      </>
                    )}
                    {events.length === 0 && (
                      <button
                        type="button"
                        onClick={seedDemoData}
                        className="px-3.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl flex items-center space-x-1.5 transition cursor-pointer border border-emerald-200 shadow-2xs"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="hidden sm:inline">Vložit ukázková data (Demo)</span>
                        <span className="sm:hidden">Demo data</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-8">
                  {/* Nadcházející události */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-emerald-600" />
                        <span className="hidden sm:inline">Nadcházející události</span>
                        <span className="sm:hidden">Nadcházející</span>
                        <span className="text-xs font-black text-slate-950 bg-emerald-400 px-2.5 py-0.5 rounded-full">
                          {upcomingEvents.length}
                        </span>
                      </h3>
                    </div>

                    {upcomingEvents.length === 0 ? (
                      <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-xs">
                        <div className="w-12 h-12 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
                          <Calendar className="w-6 h-6" />
                        </div>
                        <h4 className="text-base font-bold text-slate-900">
                          Žádné nadcházející události
                        </h4>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                          V tomto týmu zatím nejsou naplánovány žádné nadcházející tréninky ani zápasy.
                        </p>
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
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                    <button
                      type="button"
                      onClick={() => setIsPastEventsExpanded(!isPastEventsExpanded)}
                      className="w-full px-4 py-3.5 flex items-center justify-between text-left bg-slate-50/80 hover:bg-slate-100 transition cursor-pointer"
                    >
                      <div className="flex items-center space-x-2.5">
                        <History className="w-4 h-4 text-slate-500" />
                        <h3 className="text-sm font-bold text-slate-900">
                          <span className="hidden sm:inline">Uplynulé události</span>
                          <span className="sm:hidden">Uplynulé</span>
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-700">
                          {pastEvents.length}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs">
                        <span>{isPastEventsExpanded ? 'Skrýt' : 'Zobrazit'}</span>
                        {isPastEventsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>

                    {isPastEventsExpanded && (
                      <div className="p-4 sm:p-5 pt-3 border-t border-slate-200 space-y-6 bg-slate-50/60">
                        {pastEvents.length === 0 ? (
                          <div className="text-center py-6 text-xs text-slate-400">
                            Žádné uplynulé události
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
            <h2 className="text-2xl font-bold text-slate-900">Přihlášení do aplikace</h2>
            <p className="text-sm text-slate-500 mt-1">Zadejte své údaje v zobrazeném okně.</p>
          </div>
        )}
      </main>

      {/* Ergonomic Mobile Bottom Navigation Bar with Team Selector */}
      {currentUser && (
        <BottomToolbar
          currentUser={currentUser}
          teams={teams}
          activeTeam={activeTeam}
          isAllTeamsSelected={isAllTeamsSelected}
          unreadNotificationCount={unreadNotificationCount}
          onSelectAllTeams={() => setActiveTeamId('ALL')}
          onSelectTeam={(team) => setActiveTeamId(team.id)}
          onOpenNotifications={() => setShowNotificationModal(true)}
        />
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
          onTeamDeleted={handleTeamDeleted}
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
          allUsers={allUsers}
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
          onLeaveTeam={handleLeaveTeam}
        />
      )}

      {/* Native Mobile App (Capacitor) Modal & Guide */}
      {showNativeAppModal && currentUser && (
        <NativeAppModal
          currentUser={currentUser}
          onClose={() => setShowNativeAppModal(false)}
        />
      )}

      {/* Modální okno pro bezpečné potvrzení smazání události (nahrazuje nespolehlivý browser confirm) */}
      {eventToDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-hidden overscroll-contain animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-5 sm:p-6 text-center space-y-4 animate-in fade-in zoom-in-95 duration-150 text-slate-900">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-200 shadow-2xs">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-slate-950">
                Smazat událost?
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Opravdu si přejete zrušit a trvale smazat událost <strong className="text-slate-900">„{eventToDeleteConfirm.title}“</strong>? Tuto akci nelze vrátit.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEventToDeleteConfirm(null)}
                disabled={isDeletingEvent}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer border border-slate-200 shadow-2xs disabled:opacity-50"
              >
                Ponechat
              </button>
              <button
                type="button"
                onClick={() => confirmDeleteEvent(eventToDeleteConfirm)}
                disabled={isDeletingEvent}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-black rounded-xl text-xs transition cursor-pointer shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingEvent ? 'Mazání...' : 'Smazat událost'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

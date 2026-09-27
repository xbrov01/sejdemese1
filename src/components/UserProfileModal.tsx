import React, { useState } from 'react';
import { UserProfile, Team, TeamNotificationPreferences, AppFontSize } from '../types';
import { db, doc, updateDoc } from '../lib/firebase';
import { getMemberDisplayName } from '../utils/userUtils';
import { getUserTeamNotificationPreferences, sendTestBrowserNotification } from '../utils/notificationService';
import { FONT_SIZE_OPTIONS, applyAppFontSize, getInitialFontSize, saveFontSizePreference } from '../utils/fontSizeUtils';
import { User, Tag, Check, X, Mail, Trash2, Sparkles, Building2, Bell, AlertCircle, MessageSquare, ChevronDown, ChevronUp, Smartphone, CalendarPlus, CalendarX, Pencil, Type, LogOut } from 'lucide-react';

interface UserProfileModalProps {
  currentUser: UserProfile;
  activeTeam: Team | null;
  teams: Team[];
  onClose: () => void;
  onUpdateUser: (updatedUser: UserProfile) => void;
  onUpdateTeamNickname?: (teamId: string, nickname: string) => void;
  onOpenNativeAppModal?: () => void;
  onSignOut?: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  currentUser,
  activeTeam,
  teams,
  onClose,
  onUpdateUser,
  onUpdateTeamNickname,
  onOpenNativeAppModal,
  onSignOut,
}) => {
  const [fullName, setFullName] = useState(currentUser.name || '');
  
  // Mapa přezdívek pro všechny týmy: [teamId]: nickname
  const [teamNicknames, setTeamNicknames] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = { ...(currentUser.teamNicknames || {}) };
    teams.forEach((t) => {
      if (t.nicknames?.[currentUser.email]) {
        map[t.id] = t.nicknames[currentUser.email];
      }
    });
    return map;
  });

  // Mapa notifikačních předvoleb pro všechny týmy: [teamId]: TeamNotificationPreferences
  const [notificationPreferences, setNotificationPreferences] = useState<Record<string, TeamNotificationPreferences>>(() => {
    const map: Record<string, TeamNotificationPreferences> = {};
    teams.forEach((t) => {
      map[t.id] = getUserTeamNotificationPreferences(currentUser, t.id);
    });
    return map;
  });

  const [expandedTeamNotifications, setExpandedTeamNotifications] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    if (activeTeam) {
      map[activeTeam.id] = true;
    }
    return map;
  });

  const [selectedFontSize, setSelectedFontSize] = useState<AppFontSize>(() =>
    getInitialFontSize(currentUser.fontSize)
  );

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [testNotificationStatus, setTestNotificationStatus] = useState<string | null>(null);

  const handleFontSizeSelect = (size: AppFontSize) => {
    setSelectedFontSize(size);
    applyAppFontSize(size); // Okamžitý živý náhled velikosti písma
  };

  const handleCancelModal = () => {
    // Pokud uživatel formulář zruší, vrátíme původně nastavenou velikost
    applyAppFontSize(getInitialFontSize(currentUser.fontSize));
    onClose();
  };

  const handleTestSystemNotification = async () => {
    setTestNotificationStatus('Odesílám testovací notifikaci...');
    const ok = await sendTestBrowserNotification();
    if (ok) {
      setTestNotificationStatus('Testovací notifikace byla úspěšně odeslána do vašeho zařízení!');
    } else {
      setTestNotificationStatus('Notifikaci se nepodařilo doručit. Ověřte povolení v nastavení prohlížeče/Androidu.');
    }
    setTimeout(() => setTestNotificationStatus(null), 5000);
  };

  const handleNicknameChange = (teamId: string, value: string) => {
    setTeamNicknames((prev) => ({
      ...prev,
      [teamId]: value,
    }));
  };

  const handleClearNickname = (teamId: string) => {
    setTeamNicknames((prev) => {
      const copy = { ...prev };
      delete copy[teamId];
      return copy;
    });
  };

  const handlePrefChange = (teamId: string, field: keyof TeamNotificationPreferences, value: any) => {
    setNotificationPreferences((prev) => {
      const current = prev[teamId] || getUserTeamNotificationPreferences(currentUser, teamId);
      return {
        ...prev,
        [teamId]: {
          ...current,
          [field]: value,
        },
      };
    });
  };

  const toggleTeamNotificationSection = (teamId: string) => {
    setExpandedTeamNotifications((prev) => ({
      ...prev,
      [teamId]: !prev[teamId],
    }));
  };

  // Uložení jména, přezdívek a předvoleb notifikací
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      setErrorMsg('Jméno a příjmení nesmí být prázdné.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const cleanName = fullName.trim();
      
      // Vyčistit mapu přezdívek od prázdných řetězců
      const cleanedTeamNicknames: Record<string, string> = {};
      Object.entries(teamNicknames).forEach(([tId, nick]) => {
        const strNick = typeof nick === 'string' ? nick.trim() : '';
        if (strNick) {
          cleanedTeamNicknames[tId] = strNick;
        }
      });

      // 1. Aktualizace profilu uživatele ve Firestore včetně notificationPreferences a fontSize
      const userRef = doc(db, 'users', currentUser.email);
      await updateDoc(userRef, {
        name: cleanName,
        teamNicknames: cleanedTeamNicknames,
        notificationPreferences: notificationPreferences,
        fontSize: selectedFontSize,
      });

      // Uložit do localStorage a zajistit aplikování
      saveFontSizePreference(selectedFontSize);

      // 2. Aktualizace ve všech týmech v kolekci teams ve Firestore
      for (const team of teams) {
        const teamRef = doc(db, 'teams', team.id);
        const newNick = cleanedTeamNicknames[team.id] || '';
        const currentNick = team.nicknames?.[currentUser.email] || '';

        if (newNick !== currentNick) {
          const updatedNicknames = { ...(team.nicknames || {}) };
          if (newNick) {
            updatedNicknames[currentUser.email] = newNick;
          } else {
            delete updatedNicknames[currentUser.email];
          }

          await updateDoc(teamRef, {
            nicknames: updatedNicknames,
          });

          if (onUpdateTeamNickname) {
            onUpdateTeamNickname(team.id, newNick);
          }
        }
      }

      // Aktualizovaný lokální stav uživatele
      const updatedUser: UserProfile = {
        ...currentUser,
        name: cleanName,
        teamNicknames: cleanedTeamNicknames,
        notificationPreferences: notificationPreferences,
        fontSize: selectedFontSize,
      };

      onUpdateUser(updatedUser);
      setSuccessMsg('Profil a nastavení notifikací byly úspěšně uloženy.');
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Chyba při ukládání profilu:', err);
      setErrorMsg('Nepodařilo se uložit změny.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full text-slate-100 flex flex-col max-h-[90vh] my-auto overflow-hidden">
        
        {/* Header - Fixed at Top */}
        <div className="bg-slate-950 p-4 sm:p-5 text-white shrink-0 relative flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-black text-lg sm:text-xl text-slate-950 shadow-lg shadow-emerald-500/20 shrink-0">
              {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight">Můj profil & Notifikace</h2>
              <div className="flex items-center space-x-2 mt-0.5">
                <span className="text-[11px] sm:text-xs text-slate-400 flex items-center truncate max-w-[180px] sm:max-w-none">
                  <Mail className="w-3 h-3 mr-1 text-slate-400 shrink-0" />
                  <span className="truncate">{currentUser.email}</span>
                </span>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 shrink-0">
                  {currentUser.role === 'admin' ? 'Správce' : 'Člen'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleCancelModal}
            className="p-2 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form id="user-profile-form" onSubmit={handleSave} className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1 bg-slate-900">
          {errorMsg && (
            <div className="p-3 bg-rose-950/80 text-rose-300 text-xs rounded-xl font-medium">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-950/80 text-emerald-300 text-xs rounded-xl flex items-center font-medium">
              <Check className="w-4 h-4 text-emerald-400 mr-2 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Section 1: E-mail (Uživatelské jméno) */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Uživatelské jméno (E-mail)
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                disabled
                value={currentUser.email}
                className="w-full pl-10 pr-4 py-2 bg-slate-950 rounded-xl text-slate-400 text-xs sm:text-sm font-mono cursor-not-allowed outline-none"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">E-mail slouží jako trvalý unikátní identifikátor účtu.</p>
          </div>

          {/* Section 2: Jméno a Příjmení */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Jméno a Příjmení <span className="text-emerald-400">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                placeholder="Např. Petr Novák"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800 rounded-xl text-white text-sm focus:ring-2 focus:ring-emerald-400 outline-none"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Vaše výchozí jméno v aplikaci (použije se v týmech, kde nemáte nastavenou specifickou přezdívku).
            </p>
          </div>



          {/* Section 2: Týmy - Přezdívky & Nastavení notifikací (přímo pod sekcí jména) */}
          {teams.length > 0 && (
            <div className="border-t border-slate-800 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
                    <Tag className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Přezdívky & Notifikace v týmech</span>
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Nastavte si pro každý tým přezdívku a zvolte, jaká upozornění a připomenutí chcete dostávat.
                  </p>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 bg-slate-800 text-emerald-400 rounded-lg shrink-0">
                  {teams.length} {teams.length === 1 ? 'tým' : teams.length < 5 ? 'týmy' : 'týmů'}
                </span>
              </div>

              <div className="space-y-4">
                {teams.map((team) => {
                  const currentNick = teamNicknames[team.id] || '';
                  const isActive = activeTeam?.id === team.id;
                  const prefs = notificationPreferences[team.id] || getUserTeamNotificationPreferences(currentUser, team.id);
                  const isExpanded = expandedTeamNotifications[team.id] ?? isActive;
                  
                  // Výpočet zobrazeného jména pro tento tým
                  const teamDisplayName = getMemberDisplayName(
                    currentUser.email,
                    { ...team, nicknames: { ...(team.nicknames || {}), [currentUser.email]: currentNick } },
                    { ...currentUser, name: fullName }
                  );

                  return (
                    <div
                      key={team.id}
                      className={`p-3.5 sm:p-4 rounded-xl transition ${
                        isActive ? 'bg-slate-850' : 'bg-slate-950/80'
                      }`}
                    >
                      {/* Team Header */}
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center space-x-2 truncate">
                          <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="text-xs sm:text-sm font-bold text-white truncate">
                            {team.name}
                          </span>
                          {isActive && (
                            <span className="text-[10px] bg-emerald-500 text-slate-950 font-black px-1.5 py-0.2 rounded shrink-0">
                              Aktivní tým
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">
                          #{team.code}
                        </span>
                      </div>

                      {/* Nickname input */}
                      <div className="mb-3">
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Přezdívka v tomto týmu:
                        </label>
                        <div className="relative">
                          <Tag className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Zadejte přezdívku (nebo ponechte prázdné)..."
                            value={currentNick}
                            onChange={(e) => handleNicknameChange(team.id, e.target.value)}
                            className="w-full pl-9 pr-20 py-2 bg-slate-800 rounded-xl text-white text-xs sm:text-sm focus:ring-2 focus:ring-emerald-400 outline-none"
                          />
                          {currentNick && (
                            <button
                              type="button"
                              onClick={() => handleClearNickname(team.id)}
                              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-1 bg-rose-950/80 hover:bg-rose-900 text-rose-300 text-[10px] font-bold rounded-lg transition flex items-center cursor-pointer"
                              title="Vymazat přezdívku"
                            >
                              <Trash2 className="w-3 h-3 mr-0.5" />
                              Smazat
                            </button>
                          )}
                        </div>
                        <div className="mt-1 text-[11px] flex items-center justify-between text-slate-400">
                          <span>Zobrazeno jako:</span>
                          <span className="font-bold text-emerald-400 flex items-center">
                            <Sparkles className="w-3 h-3 text-emerald-400 mr-1 shrink-0" />
                            „{teamDisplayName}“
                          </span>
                        </div>
                      </div>

                      {/* Notification Preferences accordion/box for this team */}
                      <div className="bg-slate-900 rounded-xl overflow-hidden shadow-xs">
                        <button
                          type="button"
                          onClick={() => toggleTeamNotificationSection(team.id)}
                          className="w-full p-2.5 px-3 bg-slate-800/80 hover:bg-slate-800 text-left flex items-center justify-between transition cursor-pointer"
                        >
                          <div className="flex items-center space-x-2">
                            <Bell className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="text-xs font-bold text-slate-200">
                              Nastavení notifikací pro {team.name}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1 text-slate-400 text-xs font-bold">
                            <span>{isExpanded ? 'Sbalit' : 'Upravit'}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="p-3 space-y-3 bg-slate-900/90 border-t border-slate-800">
                            
                            {/* 1. Týmová připomenutí nadcházející akce */}
                            <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-800">
                              <div className="pr-2">
                                <label className="text-xs font-bold text-white flex items-center space-x-1.5">
                                  <Bell className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Týmová připomenutí událostí</span>
                                </label>
                                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                                  Dostávat hromadná připomenutí (např. 24h a 2h předem) nastavená tvůrcem události.
                                </p>
                              </div>
                              <input
                                type="checkbox"
                                checked={prefs.teamRemindersEnabled ?? true}
                                onChange={(e) => handlePrefChange(team.id, 'teamRemindersEnabled', e.target.checked)}
                                className="w-4 h-4 text-emerald-500 rounded focus:ring-emerald-400 cursor-pointer mt-0.5 bg-slate-800 border-none"
                              />
                            </div>

                            {/* 2. Uživatelská notifikace o nutnosti zadat účast */}
                            <div className="pb-2.5 border-b border-slate-800 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="pr-2">
                                  <label className="text-xs font-bold text-white flex items-center space-x-1.5">
                                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                                    <span>Výzva k zadání docházky</span>
                                  </label>
                                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                                    Upozornit mě, pokud jsem ještě nezadal(a) svou účast na nejbližší akci. Pokud už jste účast zadali, notifikace se nevytvoří.
                                  </p>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={prefs.attendanceReminderEnabled ?? true}
                                  onChange={(e) => handlePrefChange(team.id, 'attendanceReminderEnabled', e.target.checked)}
                                  className="w-4 h-4 text-emerald-500 rounded focus:ring-emerald-400 cursor-pointer mt-0.5 bg-slate-800 border-none"
                                />
                              </div>

                              {prefs.attendanceReminderEnabled && (
                                <div className="pl-5 pt-1">
                                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                                    Předstih upozornění na docházku:
                                  </label>
                                  <select
                                    value={prefs.attendanceReminderHours ?? 24}
                                    onChange={(e) => handlePrefChange(team.id, 'attendanceReminderHours', Number(e.target.value))}
                                    className="w-full text-xs py-1.5 px-2.5 bg-slate-800 rounded-lg text-white font-bold outline-none"
                                  >
                                    <option value={48}>48 hodin předem (2 dny)</option>
                                    <option value={24}>24 hodin předem (výchozí)</option>
                                    <option value={12}>12 hodin předem</option>
                                    <option value={6}>6 hodin předem</option>
                                    <option value={3}>3 hodiny předem</option>
                                    <option value={2}>2 hodiny předem</option>
                                    <option value={1}>1 hodina předem</option>
                                  </select>
                                </div>
                              )}
                            </div>

                            {/* 3. Notifikace o chatu události */}
                            <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-800">
                              <div className="pr-2">
                                <label className="text-xs font-bold text-white flex items-center space-x-1.5">
                                  <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                                  <span>Zprávy v chatu událostí</span>
                                </label>
                                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                                  Upozornit na nové zprávy a komentáře v diskuzích u zápasů a tréninků tohoto týmu.
                                </p>
                              </div>
                              <input
                                type="checkbox"
                                checked={prefs.chatNotificationsEnabled ?? true}
                                onChange={(e) => handlePrefChange(team.id, 'chatNotificationsEnabled', e.target.checked)}
                                className="w-4 h-4 text-emerald-500 rounded focus:ring-emerald-400 cursor-pointer mt-0.5 bg-slate-800 border-none"
                              />
                            </div>

                            {/* 4. Vytvoření nové události v týmu */}
                            <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-800">
                              <div className="pr-2">
                                <label className="text-xs font-bold text-white flex items-center space-x-1.5">
                                  <CalendarPlus className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Vytvoření nové události</span>
                                </label>
                                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                                  Upozornit mě, když někdo v tomto týmu vytvoří novou událost, zápas nebo trénink.
                                </p>
                              </div>
                              <input
                                type="checkbox"
                                checked={prefs.eventCreatedNotificationEnabled ?? true}
                                onChange={(e) => handlePrefChange(team.id, 'eventCreatedNotificationEnabled', e.target.checked)}
                                className="w-4 h-4 text-emerald-500 rounded focus:ring-emerald-400 cursor-pointer mt-0.5 bg-slate-800 border-none"
                              />
                            </div>

                            {/* 5. Změna / úprava údajů události v týmu */}
                            <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-800">
                              <div className="pr-2">
                                <label className="text-xs font-bold text-white flex items-center space-x-1.5">
                                  <Pencil className="w-3.5 h-3.5 text-sky-400" />
                                  <span>Změna a úprava události</span>
                                </label>
                                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                                  Upozornit mě, když dojde ke změně termínu, času nebo místa konání akce.
                                </p>
                              </div>
                              <input
                                type="checkbox"
                                checked={prefs.eventUpdatedNotificationEnabled ?? true}
                                onChange={(e) => handlePrefChange(team.id, 'eventUpdatedNotificationEnabled', e.target.checked)}
                                className="w-4 h-4 text-emerald-500 rounded focus:ring-emerald-400 cursor-pointer mt-0.5 bg-slate-800 border-none"
                              />
                            </div>

                            {/* 6. Zrušení / smazání události v týmu */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="pr-2">
                                <label className="text-xs font-bold text-white flex items-center space-x-1.5">
                                  <CalendarX className="w-3.5 h-3.5 text-rose-400" />
                                  <span>Zrušení události</span>
                                </label>
                                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                                  Upozornit mě, pokud správce zruší nebo smaže některou z plánovaných akcí tohoto týmu.
                                </p>
                              </div>
                              <input
                                type="checkbox"
                                checked={prefs.eventCancelledNotificationEnabled ?? true}
                                onChange={(e) => handlePrefChange(team.id, 'eventCancelledNotificationEnabled', e.target.checked)}
                                className="w-4 h-4 text-emerald-500 rounded focus:ring-emerald-400 cursor-pointer mt-0.5 bg-slate-800 border-none"
                              />
                            </div>

                          </div>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 3: Velikost písma v aplikaci (pod sekcí týmů) */}
          <div className="border-t border-slate-800 pt-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
                  <Type className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Velikost písma v aplikaci</span>
                </label>
                <p className="text-[11px] text-slate-400">
                  Přizpůsobte si velikost textu pro pohodlnější čtení na mobilu i počítači.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-2.5 mt-2.5">
              {FONT_SIZE_OPTIONS.map((opt) => {
                const isSelected = selectedFontSize === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleFontSizeSelect(opt.id)}
                    className={`p-2 sm:p-2.5 rounded-xl text-center transition flex flex-col items-center justify-between min-w-0 overflow-hidden cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500 text-slate-950 font-black shadow-md ring-2 ring-emerald-400'
                        : 'bg-slate-800 hover:bg-slate-750 text-slate-300'
                    }`}
                  >
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded truncate max-w-full block mb-1 ${
                      isSelected ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-900 text-slate-400'
                    }`}>
                      {opt.badge}
                    </span>
                    <div className="w-full min-w-0 my-0.5">
                      <div className="font-bold text-xs truncate">
                        {opt.label}
                      </div>
                      <div className={`text-[10px] font-semibold ${
                        isSelected ? 'text-slate-950/80' : 'text-emerald-400'
                      }`}>
                        {opt.sizeMultiplier}
                      </div>
                    </div>
                    {isSelected ? (
                      <div className="mt-1 w-4 h-4 rounded-full bg-slate-950 text-emerald-400 flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="mt-1 w-4 h-4 rounded-full bg-slate-700/60 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 bg-slate-950 px-2.5 py-1.5 rounded-lg">
              <span>Živý náhled:</span>
              <span className="font-semibold text-emerald-400">
                {selectedFontSize === 'xlarge' ? 'Největší (+28 %)' : selectedFontSize === 'large' ? 'Větší (+12,5 %)' : 'Standardní (100 %)'}
              </span>
            </div>
          </div>

          {/* Section 4: Testování notifikací (tlačítko umístěné dole) */}
          <div className="border-t border-slate-800 pt-4">
            <div className="bg-slate-950/80 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Test systémových notifikací</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                  Vyzkoušejte, zda vaše zařízení správně přijímá a zobrazuje push notifikace.
                </p>
              </div>
              <button
                type="button"
                onClick={handleTestSystemNotification}
                className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold rounded-xl text-xs shrink-0 transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Otestovat notifikace</span>
              </button>
            </div>

            {testNotificationStatus && (
              <div className="mt-2.5 p-2.5 bg-emerald-950/80 text-emerald-300 text-xs rounded-xl flex items-center animate-in fade-in font-medium">
                <Check className="w-3.5 h-3.5 mr-1.5 shrink-0 text-emerald-400" />
                <span>{testNotificationStatus}</span>
              </div>
            )}
          </div>
          {/* Section 5: Účet a odhlášení */}
          {onSignOut && (
            <div className="border-t border-slate-800 pt-4">
              <div className="bg-slate-950/80 rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white">Přihlášený účet</div>
                  <div className="text-[11px] text-slate-400 truncate">{currentUser.email}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSignOut();
                  }}
                  className="px-3.5 py-2 bg-rose-500/15 hover:bg-rose-500/25 active:bg-rose-500/30 text-rose-400 font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Odhlásit se</span>
                </button>
              </div>
            </div>
          )}
        </form>

        {/* Fixed Footer Buttons */}
        <div className="p-3.5 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center gap-2 sm:gap-3 shrink-0">
          {onSignOut && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onSignOut();
              }}
              className="py-2.5 px-3 bg-rose-500/15 hover:bg-rose-500/25 active:bg-rose-500/30 text-rose-400 font-bold rounded-xl transition text-xs sm:text-sm flex items-center justify-center space-x-1.5 cursor-pointer shrink-0"
              title="Odhlásit se z účtu"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Odhlásit</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleCancelModal}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold rounded-xl transition text-xs sm:text-sm cursor-pointer"
          >
            Zrušit
          </button>
          <button
            type="submit"
            form="user-profile-form"
            disabled={loading}
            className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-black rounded-xl shadow-md transition disabled:opacity-50 text-xs sm:text-sm flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>{loading ? 'Ukládání...' : 'Uložit'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};

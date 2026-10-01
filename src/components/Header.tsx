import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, Team } from '../types';
import { Users, Plus, Shield, LogOut, ChevronDown, UserCheck, Key, Settings, LayoutDashboard, Palette, Bell, Check, Crown } from 'lucide-react';
import { isUserTeamAdmin, isUserSuperAdmin } from '../utils/superUserUtils';

interface HeaderProps {
  currentUser: UserProfile;
  teams: Team[];
  activeTeam: Team | null;
  isAllTeamsSelected?: boolean;
  unreadNotificationCount?: number;
  onOpenNotifications: () => void;
  onSelectTeam: (team: Team) => void;
  onSelectAllTeams: () => void;
  onOpenCreateTeam: () => void;
  onOpenJoinTeam: () => void;
  onOpenManageMembers: () => void;
  onOpenTeamSettings?: () => void;
  onOpenCreateEvent: () => void;
  onOpenProfile: () => void;
  onSignOut: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  teams,
  activeTeam,
  isAllTeamsSelected = false,
  unreadNotificationCount = 0,
  onOpenNotifications,
  onSelectTeam,
  onSelectAllTeams,
  onOpenCreateTeam,
  onOpenJoinTeam,
  onOpenManageMembers,
  onOpenTeamSettings,
  onOpenCreateEvent,
  onOpenProfile,
  onSignOut,
}) => {
  const [isTeamMenuOpen, setIsTeamMenuOpen] = useState(false);
  const teamMenuRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = isUserTeamAdmin(currentUser, activeTeam);
  const isSuper = isUserSuperAdmin(currentUser);
  const currentTeamNickname = activeTeam?.nicknames?.[currentUser.email] || currentUser.teamNicknames?.[activeTeam?.id || ''];

  // Zavření dropdownu při kliknutí/dotyku mimo menu nebo při stisku Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (teamMenuRef.current && !teamMenuRef.current.contains(event.target as Node)) {
        setIsTeamMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsTeamMenuOpen(false);
      }
    };

    if (isTeamMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isTeamMenuOpen]);

  const handleSelectTeamAndClose = (team: Team) => {
    onSelectTeam(team);
    setIsTeamMenuOpen(false);
  };

  const handleSelectAllAndClose = () => {
    onSelectAllTeams();
    setIsTeamMenuOpen(false);
  };

  const handleActionAndClose = (action: () => void) => {
    action();
    setIsTeamMenuOpen(false);
  };

  return (
    <header className="bg-white/95 backdrop-blur-md text-slate-900 sticky top-0 z-40 shadow-xs border-b border-slate-200/90">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-2">
        <div className="flex items-center justify-between gap-1 sm:gap-2 md:gap-3 min-w-0">
          
          {/* LEVÁ ČÁST: Ikona aplikace & Výběr týmu / Dashboardu (v jedné řadě) */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 shrink">
            
            {/* Ikona aplikace (klikací pro rychlý reset na Dashboard) */}
            <button
              type="button"
              onClick={handleSelectAllAndClose}
              className="shrink-0 p-0.5 rounded-xl hover:scale-105 active:scale-95 transition cursor-pointer"
              title="Sejdeme se - souhrnný přehled"
            >
              <img
                src="/icon.svg"
                alt="Sejdeme se"
                referrerPolicy="no-referrer"
                className="w-7 h-7 min-[380px]:w-8 min-[380px]:h-8 sm:w-9 sm:h-9 rounded-xl shadow-xs shrink-0 object-cover"
              />
            </button>

            {/* Přepínač aktivního týmu / Dashboardu (solid button, no outline) */}
            {teams.length > 0 ? (
              <div className="relative min-w-0" ref={teamMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsTeamMenuOpen(!isTeamMenuOpen)}
                  aria-expanded={isTeamMenuOpen}
                  className={`flex items-center rounded-xl px-2.5 py-1.5 transition cursor-pointer select-none text-left max-w-full border ${
                    isTeamMenuOpen
                      ? 'bg-slate-100 text-slate-950 border-slate-300 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border-slate-200 text-slate-800'
                  }`}
                  title="Přepnout aktivní tým nebo přehled"
                >
                  {isAllTeamsSelected ? (
                    <>
                      <LayoutDashboard className="w-3.5 h-3.5 text-emerald-600 mr-1 sm:mr-1.5 shrink-0" />
                      <span className="text-[11px] sm:text-xs font-bold text-slate-900 truncate">
                        Vše
                      </span>
                    </>
                  ) : (
                    <>
                      <Users className="w-3.5 h-3.5 text-emerald-600 mr-1 sm:mr-1.5 shrink-0" />
                      <span className="text-[11px] sm:text-xs font-bold text-slate-900 max-w-[68px] min-[360px]:max-w-[90px] min-[400px]:max-w-[125px] sm:max-w-[170px] md:max-w-[210px] truncate">
                        {activeTeam?.name || 'Vyberte tým'}
                      </span>
                    </>
                  )}
                  <ChevronDown className={`w-3.5 h-3.5 ml-1 text-slate-500 shrink-0 transition-transform duration-200 ${
                    isTeamMenuOpen ? 'rotate-180 text-emerald-600' : ''
                  }`} />
                </button>

                {/* Překryvná clona pro zavření kliknutím mimo */}
                {isTeamMenuOpen && (
                  <div
                    className="fixed inset-0 z-40 bg-black/20 backdrop-blur-2xs"
                    onClick={() => setIsTeamMenuOpen(false)}
                  />
                )}

                {/* Dropdown menu pro přepínání týmu - plovoucí vrstva nad toolbarem */}
                {isTeamMenuOpen && (
                  <div className="absolute left-0 top-full mt-2 w-72 sm:w-80 max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3.5 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 flex items-center justify-between">
                      <span>Výběr týmu / přehled</span>
                      <span className="text-[9px] bg-slate-100 text-emerald-700 px-1.5 py-0.5 rounded font-mono font-bold">
                        {teams.length} {teams.length === 1 ? 'tým' : 'týmy'}
                      </span>
                    </div>

                    {/* Možnost "Všechny mé týmy" pro souhrnný přehled */}
                    <div className="p-1 border-b border-slate-100">
                      <button
                        type="button"
                        onClick={handleSelectAllAndClose}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                          isAllTeamsSelected
                            ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 active:bg-slate-150'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <LayoutDashboard className={`w-4 h-4 shrink-0 ${isAllTeamsSelected ? 'text-slate-950' : 'text-emerald-600'}`} />
                          <div>
                            <div className="font-bold leading-tight">Všechny mé týmy</div>
                            <div className={`text-[10px] ${isAllTeamsSelected ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>
                              Souhrnný přehled událostí
                            </div>
                          </div>
                        </div>
                        {isAllTeamsSelected && <Check className="w-4 h-4 text-slate-950 shrink-0 stroke-[3]" />}
                      </button>
                    </div>

                    {/* Seznam týmů */}
                    <div className="max-h-64 overflow-y-auto p-1 space-y-1">
                      {teams.map((team) => {
                        const isSelected = !isAllTeamsSelected && activeTeam?.id === team.id;
                        return (
                          <button
                            key={team.id}
                            type="button"
                            onClick={() => handleSelectTeamAndClose(team)}
                            className={`w-full text-left px-3 py-2.5 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-50 text-emerald-900 font-bold border border-emerald-200'
                                : 'bg-white hover:bg-slate-50 text-slate-700 active:bg-slate-100'
                            }`}
                          >
                            <div className="truncate pr-2">
                              <div className="font-semibold text-slate-900 truncate">{team.name}</div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                #{team.code} • {team.memberEmails?.length || 1} členů
                              </div>
                            </div>
                            {isSelected ? (
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0" />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>

                    {/* Spodní akce týmu (solid buttons, no outline) */}
                    <div className="border-t border-slate-100 p-1.5 mt-1 space-y-1 bg-slate-50/80 rounded-b-xl">
                      <button
                        type="button"
                        onClick={() => handleActionAndClose(onOpenJoinTeam)}
                        className="w-full text-left px-3 py-2 text-xs font-semibold text-emerald-700 bg-white hover:bg-emerald-50 border border-slate-200 active:bg-emerald-100 rounded-xl flex items-center transition cursor-pointer"
                      >
                        <Key className="w-3.5 h-3.5 mr-2 shrink-0 text-emerald-600" />
                        <span>Připojit k týmu pomocí kódu</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleActionAndClose(onOpenCreateTeam)}
                        className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 active:bg-slate-200 rounded-xl flex items-center transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 mr-2 shrink-0 text-emerald-600" />
                        <span>Vytvořit nový tým</span>
                      </button>

                      {isAdmin && activeTeam && onOpenTeamSettings && (
                        <button
                          type="button"
                          onClick={() => handleActionAndClose(onOpenTeamSettings)}
                          className="w-full text-left px-3 py-2 text-xs font-semibold text-purple-700 bg-white hover:bg-purple-50 border border-slate-200 active:bg-purple-100 rounded-xl flex items-center transition cursor-pointer"
                        >
                          <Palette className="w-3.5 h-3.5 mr-2 shrink-0 text-purple-600" />
                          <span>Vzhled & styl aktivního týmu</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={onOpenJoinTeam}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-semibold rounded-xl flex items-center transition cursor-pointer"
                >
                  <Key className="w-3.5 h-3.5 sm:mr-1 text-emerald-600" />
                  <span className="hidden sm:inline">Připojit</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenCreateTeam}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 text-xs font-bold rounded-xl flex items-center transition shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">Vytvořit</span>
                </button>
              </div>
            )}
          </div>

          {/* PRAVÁ ČÁST: Všechny akční a uživatelské prvky v jedné řadě */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
            
            {/* Tlačítko pro připojení k týmu pomocí kódu - na mobilu pouze ikona, na desktopu plný text */}
            <button
              type="button"
              onClick={onOpenJoinTeam}
              className="p-2 sm:px-3 sm:py-2 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-white hover:bg-emerald-50 active:bg-emerald-100 border border-slate-200 rounded-xl flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
              title="Připojit k týmu pomocí kódu"
              aria-label="Připojit k týmu pomocí kódu"
            >
              <Key className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0 text-emerald-600" />
              <span className="hidden sm:inline">Připojit k týmu pomocí kódu</span>
            </button>

            {/* Notifikační zvonek */}
            <button
              type="button"
              onClick={onOpenNotifications}
              className="relative p-2 sm:p-2.5 text-slate-700 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl transition cursor-pointer flex items-center justify-center border border-slate-200"
              title="Notifikace a připomenutí"
            >
              <Bell className="w-4 h-4 text-slate-700" />
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-emerald-500 text-slate-950 text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                  {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                </span>
              )}
            </button>

            {/* Profil uživatele: zobrazuje pouze iniciálu jména */}
            <button
              type="button"
              onClick={onOpenProfile}
              className="p-1.5 sm:p-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 transition flex items-center justify-center cursor-pointer relative border border-slate-200"
              title={`Můj profil: ${currentUser.name} (${currentUser.email})`}
              aria-label={`Můj profil: ${currentUser.name}`}
            >
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-xs sm:text-sm shrink-0">
                {currentUser.name ? currentUser.name.trim().charAt(0).toUpperCase() : currentUser.email.charAt(0).toUpperCase()}
              </div>
              {isSuper ? (
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-amber-600 absolute -top-0.5 -right-0.5 shadow-xs" title="Systémový superadmin" />
              ) : isAdmin ? (
                <span className="w-2 h-2 rounded-full bg-purple-500 absolute top-1 right-1" title="Správce" />
              ) : null}
            </button>

          </div>

        </div>
      </div>
    </header>
  );
};

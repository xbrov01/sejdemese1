import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, Team } from '../types';
import { Users, Plus, Shield, LogOut, ChevronDown, UserCheck, Key, Settings, LayoutDashboard, Palette, Bell, Check } from 'lucide-react';

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

  const isAdmin = currentUser.role === 'admin';
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
    <header className="bg-slate-950 text-white sticky top-0 z-40 shadow-xl border-b border-slate-800">
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
                className="w-7 h-7 min-[380px]:w-8 min-[380px]:h-8 sm:w-9 sm:h-9 rounded-xl shadow-md shadow-emerald-500/20 shrink-0 object-cover"
              />
            </button>

            {/* Přepínač aktivního týmu / Dashboardu (solid button, no outline) */}
            {teams.length > 0 ? (
              <div className="relative min-w-0" ref={teamMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsTeamMenuOpen(!isTeamMenuOpen)}
                  aria-expanded={isTeamMenuOpen}
                  className={`flex items-center rounded-xl px-2.5 py-1.5 transition cursor-pointer select-none text-left max-w-full shadow-xs ${
                    isTeamMenuOpen
                      ? 'bg-slate-800 text-white shadow-md'
                      : 'bg-slate-850 hover:bg-slate-800 active:bg-slate-700 text-slate-200'
                  }`}
                  title="Přepnout aktivní tým nebo přehled"
                >
                  {isAllTeamsSelected ? (
                    <LayoutDashboard className="w-3.5 h-3.5 text-emerald-400 mr-1 sm:mr-1.5 shrink-0" />
                  ) : (
                    <Users className="w-3.5 h-3.5 text-emerald-400 mr-1 sm:mr-1.5 shrink-0" />
                  )}
                  <span className="text-[11px] sm:text-xs font-semibold text-white max-w-[68px] min-[360px]:max-w-[90px] min-[400px]:max-w-[125px] sm:max-w-[170px] md:max-w-[210px] truncate">
                    {isAllTeamsSelected ? 'Všechny týmy' : (activeTeam?.name || 'Vyberte tým')}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 ml-0.5 sm:ml-1 text-slate-400 shrink-0 transition-transform duration-200 ${
                    isTeamMenuOpen ? 'rotate-180 text-emerald-400' : ''
                  }`} />
                </button>

                {/* Mobilní překryvná clona pro bezpečné zavření kliknutím mimo */}
                {isTeamMenuOpen && (
                  <div
                    className="fixed inset-0 z-40 bg-black/50 sm:hidden backdrop-blur-xs"
                    onClick={() => setIsTeamMenuOpen(false)}
                  />
                )}

                {/* Dropdown menu pro přepínání týmu */}
                {isTeamMenuOpen && (
                  <div className="fixed inset-x-3 top-14 max-w-sm mx-auto sm:static sm:max-w-none sm:mx-0 sm:absolute sm:inset-x-auto sm:top-full sm:left-0 sm:mt-2 sm:w-72 bg-slate-900 rounded-2xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3.5 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 flex items-center justify-between">
                      <span>Výběr týmu / přehled</span>
                      <span className="text-[9px] bg-slate-800 text-emerald-400 px-1.5 py-0.5 rounded font-mono">
                        {teams.length} {teams.length === 1 ? 'tým' : 'týmy'}
                      </span>
                    </div>

                    {/* Možnost "Všechny mé týmy" pro souhrnný přehled */}
                    <div className="p-1 border-b border-slate-800">
                      <button
                        type="button"
                        onClick={handleSelectAllAndClose}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                          isAllTeamsSelected
                            ? 'bg-emerald-500 text-slate-950 font-black shadow-sm'
                            : 'bg-slate-800/80 hover:bg-slate-750 text-slate-200 active:bg-slate-700'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <LayoutDashboard className={`w-4 h-4 shrink-0 ${isAllTeamsSelected ? 'text-slate-950' : 'text-emerald-400'}`} />
                          <div>
                            <div className="font-semibold leading-tight">Všechny mé týmy</div>
                            <div className={`text-[10px] ${isAllTeamsSelected ? 'text-slate-900' : 'text-slate-400'}`}>
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
                                ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                                : 'bg-slate-850 hover:bg-slate-800 text-slate-300 active:bg-slate-750'
                            }`}
                          >
                            <div className="truncate pr-2">
                              <div className="font-semibold text-slate-100 truncate">{team.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                #{team.code} • {team.memberEmails?.length || 1} členů
                              </div>
                            </div>
                            {isSelected ? (
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>

                    {/* Spodní akce týmu (solid buttons, no outline) */}
                    <div className="border-t border-slate-800 p-1.5 mt-1 space-y-1 bg-slate-950/40 rounded-b-xl">
                      <button
                        type="button"
                        onClick={() => handleActionAndClose(onOpenJoinTeam)}
                        className="w-full text-left px-3 py-2 text-xs font-semibold text-emerald-300 bg-slate-800 hover:bg-slate-750 active:bg-slate-700 rounded-xl flex items-center transition cursor-pointer"
                      >
                        <Key className="w-3.5 h-3.5 mr-2 shrink-0 text-emerald-400" />
                        <span>Připojit k týmu pomocí kódu</span>
                      </button>

                      {isAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleActionAndClose(onOpenCreateTeam)}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-teal-300 bg-slate-800 hover:bg-slate-750 active:bg-slate-700 rounded-xl flex items-center transition cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5 mr-2 shrink-0 text-teal-400" />
                            <span>Vytvořit nový tým</span>
                          </button>
                          {activeTeam && onOpenTeamSettings && (
                            <button
                              type="button"
                              onClick={() => handleActionAndClose(onOpenTeamSettings)}
                              className="w-full text-left px-3 py-2 text-xs font-semibold text-purple-300 bg-slate-800 hover:bg-slate-750 active:bg-slate-700 rounded-xl flex items-center transition cursor-pointer"
                            >
                              <Palette className="w-3.5 h-3.5 mr-2 shrink-0 text-purple-400" />
                              <span>Vzhled & styl aktivního týmu</span>
                            </button>
                          )}
                        </>
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
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center transition cursor-pointer"
                >
                  <Key className="w-3.5 h-3.5 sm:mr-1 text-emerald-400" />
                  <span className="hidden sm:inline">Připojit</span>
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={onOpenCreateTeam}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 text-xs font-black rounded-xl flex items-center transition shadow-sm cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 sm:mr-1" />
                    <span className="hidden sm:inline">Vytvořit</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* PRAVÁ ČÁST: Všechny akční a uživatelské prvky v jedné řadě (solid buttons, no outlines) */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
            
            {/* Akce administrátora pro události a tým */}
            {isAdmin && (activeTeam || (isAllTeamsSelected && teams.length > 0)) && (
              <>
                {/* Tlačítko Vytvořit událost (solid neon green, no outline) */}
                <button
                  type="button"
                  onClick={onOpenCreateEvent}
                  className="px-3 py-1.5 sm:px-3.5 sm:py-2 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 text-xs font-black rounded-xl flex items-center transition shadow-md shadow-emerald-950/40 cursor-pointer"
                  title="Vytvořit novou událost"
                >
                  <Plus className="w-4 h-4 sm:mr-1 stroke-[3]" />
                  <span className="hidden sm:inline">Nová událost</span>
                  <span className="sm:hidden font-bold">Nová</span>
                </button>

                {activeTeam && (
                  <>
                    {/* Tlačítko Vzhled karty */}
                    <button
                      type="button"
                      onClick={onOpenTeamSettings || onOpenManageMembers}
                      className="p-2 sm:px-2.5 sm:py-1.5 bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-purple-300 text-xs font-semibold rounded-xl flex items-center transition cursor-pointer"
                      title="Změnit vzhled, barvu nebo pozadí karty události"
                    >
                      <Palette className="w-3.5 h-3.5 sm:mr-1 text-purple-400" />
                      <span className="hidden lg:inline">Vzhled</span>
                    </button>

                    {/* Tlačítko Správa členů */}
                    <button
                      type="button"
                      onClick={onOpenManageMembers}
                      className="p-2 sm:px-2.5 sm:py-1.5 bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center transition cursor-pointer"
                      title="Správa členů týmu"
                    >
                      <Settings className="w-3.5 h-3.5 sm:mr-1 text-slate-400" />
                      <span className="hidden lg:inline">Členové</span>
                    </button>
                  </>
                )}
              </>
            )}

            {/* Notifikační zvonek (solid button, no outline) */}
            <button
              type="button"
              onClick={onOpenNotifications}
              className="relative p-2 text-emerald-400 hover:text-white bg-slate-800 hover:bg-slate-750 active:bg-slate-700 rounded-xl transition cursor-pointer"
              title="Notifikace a připomenutí"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-xs animate-pulse">
                  {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                </span>
              )}
            </button>

            {/* Profil uživatele (solid button, no outline) */}
            <button
              type="button"
              onClick={onOpenProfile}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 active:bg-slate-700 transition text-left cursor-pointer"
              title="Upravit můj profil & nastavení notifikací a písma"
            >
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-[11px] sm:text-xs shrink-0">
                {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <span className="text-[11px] sm:text-xs font-semibold text-slate-200 max-w-[55px] min-[400px]:max-w-[75px] min-[520px]:max-w-[110px] sm:max-w-[140px] truncate hidden min-[360px]:inline-block">
                {currentTeamNickname || currentUser.name}
              </span>
              {isAdmin ? (
                <Shield className="w-3 h-3 text-purple-400 shrink-0 hidden min-[440px]:inline-block" title="Správce" />
              ) : (
                <UserCheck className="w-3 h-3 text-blue-400 shrink-0 hidden min-[440px]:inline-block" title="Běžný člen" />
              )}
            </button>

            {/* Tlačítko odhlášení (solid button, no outline) */}
            <button
              type="button"
              onClick={onSignOut}
              className="p-2 text-slate-400 hover:text-rose-400 bg-slate-800 hover:bg-slate-750 active:bg-slate-700 rounded-xl transition cursor-pointer"
              title="Odhlásit se"
            >
              <LogOut className="w-4 h-4" />
            </button>

          </div>

        </div>
      </div>
    </header>
  );
};

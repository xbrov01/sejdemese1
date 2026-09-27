import React, { useState } from 'react';
import { UserProfile, Team } from '../types';
import { LayoutDashboard, Users, Bell, X, Check } from 'lucide-react';

interface BottomToolbarProps {
  currentUser: UserProfile;
  teams: Team[];
  activeTeam: Team | null;
  isAllTeamsSelected: boolean;
  unreadNotificationCount: number;
  onSelectAllTeams: () => void;
  onSelectTeam: (team: Team) => void;
  onOpenNotifications: () => void;
}

export const BottomToolbar: React.FC<BottomToolbarProps> = ({
  teams,
  activeTeam,
  isAllTeamsSelected,
  unreadNotificationCount,
  onSelectAllTeams,
  onSelectTeam,
  onOpenNotifications,
}) => {
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  return (
    <>
      {/* Ergonomic Mobile Bottom Navigation Bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 px-3 py-2 flex items-center justify-around shadow-2xl">
        {/* Přehled button */}
        <button
          type="button"
          onClick={() => {
            setIsSelectorOpen(false);
            onSelectAllTeams();
          }}
          className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition cursor-pointer ${
            isAllTeamsSelected && !isSelectorOpen
              ? 'bg-slate-800 text-emerald-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px]">Přehled</span>
        </button>

        {/* Tým button -> displays selector of teams */}
        {teams.length > 0 && (
          <button
            type="button"
            onClick={() => setIsSelectorOpen(!isSelectorOpen)}
            className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition cursor-pointer ${
              !isAllTeamsSelected || isSelectorOpen
                ? 'bg-slate-800 text-emerald-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="text-[10px] max-w-[80px] truncate">
              {activeTeam ? activeTeam.name : 'Tým'}
            </span>
          </button>
        )}

        {/* Zprávy button */}
        <button
          type="button"
          onClick={() => {
            setIsSelectorOpen(false);
            onOpenNotifications();
          }}
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

      {/* Team Selector Bottom Sheet / Popup */}
      {isSelectorOpen && (
        <div
          className="sm:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end p-3 pb-20 animate-in fade-in"
          onClick={() => setIsSelectorOpen(false)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-2xl max-w-sm w-full mx-auto animate-in slide-in-from-bottom-5 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-1 py-1 mb-2.5 border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">Výběr týmu</span>
                <span className="text-[9px] bg-slate-800 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-bold">
                  {teams.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsSelectorOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List of user teams ONLY (no option to switch to all teams, no create team, no connect to team) */}
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
              {teams.map((team) => {
                const isSelected = !isAllTeamsSelected && activeTeam?.id === team.id;
                return (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => {
                      onSelectTeam(team);
                      setIsSelectorOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl transition cursor-pointer text-left ${
                      isSelected
                        ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30'
                        : 'bg-slate-800 hover:bg-slate-750 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                        isSelected ? 'bg-emerald-500 text-slate-950 font-black' : 'bg-slate-700 text-slate-300'
                      }`}>
                        {team.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-bold text-white truncate">{team.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          #{team.code} • {team.memberEmails?.length || 1} členů
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 ml-2 stroke-[3]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

import React, { useState, useEffect } from 'react';
import { UserProfile, Team, Event } from '../types';
import { db, collection, addDoc, doc, updateDoc } from '../lib/firebase';
import { Calendar, Clock, MapPin, Plus, X, Tag, Users, Bell, Pencil, Check } from 'lucide-react';
import { sendEventCreatedNotifications, sendEventUpdatedNotifications } from '../utils/notificationService';
import { getMemberDisplayName } from '../utils/userUtils';

interface CreateEventModalProps {
  currentUser: UserProfile;
  activeTeam?: Team | null;
  teams?: Team[];
  allUsers?: UserProfile[];
  eventToEdit?: Event | null;
  onClose: () => void;
  onEventCreated?: () => void;
  onEventUpdated?: () => void;
}

export const CreateEventModal: React.FC<CreateEventModalProps> = ({
  currentUser,
  activeTeam,
  teams = [],
  allUsers = [],
  eventToEdit,
  onClose,
  onEventCreated,
  onEventUpdated,
}) => {
  const isEditing = Boolean(eventToEdit);

  const [selectedTeamId, setSelectedTeamId] = useState<string>(
    eventToEdit?.teamId || activeTeam?.id || teams[0]?.id || ''
  );
  const [title, setTitle] = useState(eventToEdit?.title || '');
  const [date, setDate] = useState(() => {
    if (eventToEdit?.date) return eventToEdit.date;
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [time, setTime] = useState(eventToEdit?.time || '18:00');
  const [location, setLocation] = useState(eventToEdit?.location || '');
  const [selectedReminders, setSelectedReminders] = useState<number[]>(
    eventToEdit?.reminders || [24, 2]
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetTeam = teams.find((t) => t.id === selectedTeamId) || activeTeam;

  const toggleReminderOption = (hours: number) => {
    if (selectedReminders.includes(hours)) {
      setSelectedReminders(selectedReminders.filter((h) => h !== hours));
    } else {
      setSelectedReminders([...selectedReminders, hours].sort((a, b) => b - a));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTeam?.id) {
      setError('Vyberte prosím tým pro událost.');
      return;
    }
    if (!title.trim() || !date || !time) {
      setError('Vyplňte prosím název, datum a čas události.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const editorDisplayName = getMemberDisplayName(currentUser.email, targetTeam, currentUser);
      const cleanLocation = location.trim();

      if (isEditing && eventToEdit) {
        // Úprava existující události
        const updatedEventData = {
          teamId: targetTeam.id,
          title: title.trim(),
          date,
          time,
          location: cleanLocation,
          reminders: selectedReminders,
        };

        const eventDocRef = doc(db, 'events', eventToEdit.id);
        await updateDoc(eventDocRef, updatedEventData);

        const fullUpdatedEvent: Event = {
          ...eventToEdit,
          ...updatedEventData,
        };

        // Odeslat notifikace o úpravě události všem členům týmu
        await sendEventUpdatedNotifications(
          fullUpdatedEvent,
          eventToEdit,
          targetTeam,
          currentUser.email,
          editorDisplayName,
          allUsers
        );

        if (onEventUpdated) {
          onEventUpdated();
        }
      } else {
        // Vytvoření nové události
        const newEventData = {
          teamId: targetTeam.id,
          title: title.trim(),
          date,
          time,
          location: cleanLocation,
          createdBy: currentUser.email,
          createdAt: new Date().toISOString(),
          reminders: selectedReminders,
        };

        const docRef = await addDoc(collection(db, 'events'), newEventData);

        // Odeslat notifikace všem členům týmu
        await sendEventCreatedNotifications(
          { id: docRef.id, ...newEventData },
          targetTeam,
          currentUser.email,
          editorDisplayName,
          allUsers
        );

        if (onEventCreated) {
          onEventCreated();
        }
      }

      onClose();
    } catch (err: any) {
      console.error('Chyba při ukládání události:', err);
      setError(isEditing ? 'Nepodařilo se uložit změny události.' : 'Nepodařilo se vytvořit událost.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden text-white">
        
        {/* Header */}
        <div className="bg-slate-950 px-6 py-4 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2">
            {isEditing ? (
              <Pencil className="w-5 h-5 text-emerald-400" />
            ) : (
              <Calendar className="w-5 h-5 text-emerald-400" />
            )}
            <div>
              <h3 className="font-bold text-lg">
                {isEditing ? 'Upravit událost' : 'Nová událost'}
              </h3>
              <p className="text-xs text-slate-400">
                {targetTeam ? `Pro tým: ${targetTeam.name}` : isEditing ? 'Úprava detailů události' : 'Vytvoření zápasu / tréninku'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white rounded-xl transition cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-950/80 text-rose-300 text-xs rounded-xl font-medium">
              {error}
            </div>
          )}

          {/* Team selector if multiple teams available and not editing */}
          {teams.length > 1 && !isEditing && (
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Tým
              </label>
              <div className="relative">
                <Users className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-800 text-white rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id} className="bg-slate-800 text-white">
                      {t.name} (#{t.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
              Název události / tréninku
            </label>
            <div className="relative">
              <Tag className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                placeholder="např. Středeční ligový zápas, Trénink..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-800 text-white placeholder-slate-500 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Datum
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pl-9 pr-2 py-2.5 bg-slate-800 text-white rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Čas začátku
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full pl-9 pr-2 py-2.5 bg-slate-800 text-white rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Místo konání
              </label>
              <span className="text-[11px] text-slate-400 font-normal">Nepovinné</span>
            </div>
            <div className="relative">
              <MapPin className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="např. Hala Na Fialce, Hřiště 2 (nevyplňujte, pokud není určeno)"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-800 text-white placeholder-slate-500 rounded-xl text-sm focus:ring-2 focus:ring-emerald-400 outline-none"
              />
            </div>
          </div>

          {/* Týmová připomenutí (rozeslání členům) */}
          <div className="bg-slate-850 p-3 rounded-xl">
            <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1 flex items-center">
              <Bell className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
              Týmová připomenutí před akcí
            </label>
            <p className="text-[11px] text-slate-400 mb-2">
              Vyberte, kdy obdrží členové týmu automatické připomenutí této akce:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[
                { hours: 48, label: '48h předem' },
                { hours: 24, label: '24h předem' },
                { hours: 12, label: '12h předem' },
                { hours: 4, label: '4h předem' },
                { hours: 2, label: '2h předem' },
                { hours: 1, label: '1h předem' },
              ].map((opt) => {
                const isSelected = selectedReminders.includes(opt.hours);
                return (
                  <button
                    key={opt.hours}
                    type="button"
                    onClick={() => toggleReminderOption(opt.hours)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500 text-slate-950 shadow-sm'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
                    }`}
                  >
                    {isSelected ? '✓ ' : '+ '}
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-3 flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-slate-200 font-bold rounded-xl transition text-sm cursor-pointer"
            >
              Zrušit
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-black rounded-xl shadow-md text-sm transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              {isEditing ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>{loading ? 'Ukládání...' : 'Uložit změny'}</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>{loading ? 'Vytváření...' : 'Vytvořit událost'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

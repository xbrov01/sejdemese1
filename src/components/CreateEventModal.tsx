import React, { useState, useEffect } from 'react';
import { UserProfile, Team, Event } from '../types';
import { db, collection, addDoc, doc, updateDoc } from '../lib/firebase';
import { Calendar, Clock, MapPin, Plus, X, Tag, Users, Bell, Pencil, Check, AlignLeft } from 'lucide-react';
import { sendEventCreatedNotifications, sendEventUpdatedNotifications } from '../utils/notificationService';
import { getMemberDisplayName } from '../utils/userUtils';
import { isUserTeamAdmin } from '../utils/superUserUtils';

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

  const targetTeam = eventToEdit ? (teams.find((t) => t.id === eventToEdit.teamId) || activeTeam) : activeTeam;

  const [title, setTitle] = useState(eventToEdit?.title || '');
  const [description, setDescription] = useState(eventToEdit?.description || '');
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
    if (!isUserTeamAdmin(currentUser, targetTeam)) {
      setError('Pouze správce týmu může vytvářet nebo upravovat události.');
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
      const cleanDescription = description.trim();

      if (isEditing && eventToEdit) {
        // Úprava existující události
        const updatedEventData = {
          teamId: targetTeam.id,
          title: title.trim(),
          description: cleanDescription,
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
          description: cleanDescription,
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-hidden overscroll-contain">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full my-auto max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden text-slate-900 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header - Pinned at Top */}
        <div className="bg-slate-50 px-5 sm:px-6 py-4 text-slate-900 flex items-center justify-between border-b border-slate-200 shrink-0">
          <div className="flex items-center space-x-2">
            {isEditing ? (
              <Pencil className="w-5 h-5 text-emerald-600" />
            ) : (
              <Calendar className="w-5 h-5 text-emerald-600" />
            )}
            <div>
              <h3 className="font-bold text-lg text-slate-900">
                {isEditing ? 'Upravit událost' : 'Nová událost'}
              </h3>
              <p className="text-xs text-slate-500">
                {targetTeam ? `Pro tým: ${targetTeam.name}` : isEditing ? 'Úprava detailů události' : 'Vytvoření zápasu / tréninku'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-xl transition cursor-pointer border border-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form id="create-event-form" onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto overscroll-contain flex-1">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 text-xs rounded-xl font-medium">
              {error}
            </div>
          )}

          {/* Informace o týmu (pevně svázáno s kartou týmu) */}
          {targetTeam && (
            <div className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Tým události</span>
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-600" />
                {targetTeam.name}
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
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
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 text-slate-900 placeholder-slate-400 rounded-xl text-sm border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Popis události
              </label>
              <span className="text-[11px] text-slate-400 font-normal">Nepovinné</span>
            </div>
            <div className="relative">
              <textarea
                rows={2}
                placeholder="Podrobnosti k zápasu, pokyny, soupeř, sraz v šatně..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 text-slate-900 placeholder-slate-400 rounded-xl text-sm border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Datum
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pl-9 pr-2 py-2.5 bg-slate-50 text-slate-900 rounded-xl text-sm border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Čas začátku
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full pl-9 pr-2 py-2.5 bg-slate-50 text-slate-900 rounded-xl text-sm border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
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
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 text-slate-900 placeholder-slate-400 rounded-xl text-sm border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* Týmová připomenutí (rozeslání členům) */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1 flex items-center">
              <Bell className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              Týmová připomenutí před akcí
            </label>
            <p className="text-[11px] text-slate-500 mb-2">
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
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer border ${
                      isSelected
                        ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {isSelected ? '✓ ' : '+ '}
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </form>

        {/* Action Buttons - Pinned at Bottom */}
        <div className="px-5 sm:px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center space-x-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-sm cursor-pointer border border-slate-200 shadow-2xs"
          >
            Zrušit
          </button>
          <button
            type="submit"
            form="create-event-form"
            disabled={loading}
            className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-black rounded-xl shadow-xs text-sm transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
          >
            {isEditing ? (
              <>
                <Check className="w-4 h-4" />
                <span>{loading ? 'Ukládání...' : 'Uložit'}</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>{loading ? 'Vytváření...' : 'Vytvořit'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

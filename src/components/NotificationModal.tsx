import React, { useState, useEffect } from 'react';
import { NotificationItem, NotificationType, UserProfile } from '../types';
import {
  X,
  Bell,
  CheckCircle2,
  MessageSquare,
  Clock,
  Trash2,
  CheckCheck,
  AlertCircle,
  ExternalLink,
  Volume2,
  Calendar,
  Smartphone,
  Check,
  CalendarPlus,
  CalendarX,
  AlertTriangle,
  Pencil
} from 'lucide-react';
import {
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearAllNotifications,
  requestWebNotificationPermission,
  sendTestBrowserNotification,
  checkNotificationPermissionStatus,
} from '../utils/notificationService';
import { isNative } from '../lib/capacitor';

interface NotificationModalProps {
  currentUser?: UserProfile;
  currentUserEmail?: string;
  notifications: NotificationItem[];
  onClose: () => void;
  onNavigateToEvent?: (teamId: string, eventId?: string) => void;
  onSelectEvent?: (eventId: string, teamId?: string) => void;
  onOpenNativeAppModal?: () => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  currentUser,
  currentUserEmail,
  notifications,
  onClose,
  onNavigateToEvent,
  onSelectEvent,
  onOpenNativeAppModal,
}) => {
  const activeEmail = currentUserEmail || currentUser?.email || '';
  const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'EVENTS' | 'ATTENDANCE' | 'CHAT'>('ALL');
  const [browserPermission, setBrowserPermission] = useState<string>('default');
  const [isClearing, setIsClearing] = useState(false);
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  // Zjištění aktuálního stavu oprávnění při otevření modálu (funguje pro nativní aplikaci i web)
  useEffect(() => {
    checkNotificationPermissionStatus().then((status) => {
      setBrowserPermission(status);
    });
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleRequestBrowserPush = async () => {
    const perm = await requestWebNotificationPermission();
    setBrowserPermission(perm);
  };

  const handleSendTestNotification = async () => {
    setTestStatus('Odesílám test...');
    const success = await sendTestBrowserNotification();
    if (success) {
      setTestStatus('Testovací notifikace odeslána!');
    } else {
      setTestStatus('Notifikaci se nepodařilo zobrazit (zkontrolujte povolení v systému).');
    }
    setTimeout(() => setTestStatus(null), 4000);
  };

  const handleClearAll = async () => {
    if (isClearing || notifications.length === 0) return;
    setIsClearing(true);
    try {
      await clearAllNotifications(activeEmail, notifications);
    } catch (err) {
      console.error('Chyba při mazání oznámení:', err);
    } finally {
      setIsClearing(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (isMarkingRead || unreadCount === 0) return;
    setIsMarkingRead(true);
    try {
      const ids = notifications.filter((n) => !n.read).map((n) => n.id);
      await markAllNotificationsAsRead(activeEmail, ids);
    } catch (err) {
      console.error('Chyba při označení všech jako přečtených:', err);
    } finally {
      setIsMarkingRead(false);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'UNREAD') return !n.read;
    if (filter === 'EVENTS') return n.type === 'TEAM_REMINDER' || n.type === 'EVENT_CREATED' || n.type === 'EVENT_UPDATED' || n.type === 'EVENT_CANCELLED';
    if (filter === 'ATTENDANCE') return n.type === 'ATTENDANCE_REMINDER';
    if (filter === 'CHAT') return n.type === 'CHAT_MESSAGE';
    return true;
  });

  const formatNotificationTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'Před chvílí';
      if (diffMins < 60) return `Před ${diffMins} min`;
      if (diffHours < 24) return `Před ${diffHours} h`;
      if (diffDays === 1) return 'Včera ' + date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
      return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' }) + ' ' + date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const getIconForType = (type: NotificationType) => {
    switch (type) {
      case 'ATTENDANCE_REMINDER':
        return <AlertCircle className="w-4 h-4 text-amber-600" />;
      case 'TEAM_REMINDER':
        return <Calendar className="w-4 h-4 text-emerald-600" />;
      case 'EVENT_CREATED':
        return <CalendarPlus className="w-4 h-4 text-emerald-600" />;
      case 'EVENT_UPDATED':
        return <Pencil className="w-4 h-4 text-sky-600" />;
      case 'EVENT_CANCELLED':
        return <CalendarX className="w-4 h-4 text-rose-600" />;
      case 'CHAT_MESSAGE':
        return <MessageSquare className="w-4 h-4 text-blue-600" />;
      default:
        return <Bell className="w-4 h-4 text-slate-500" />;
    }
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.read) {
      await markNotificationAsRead(notif.id);
    }
    // Pro zrušené události neprovádíme navigaci, protože událost již neexistuje
    if (notif.type !== 'EVENT_CANCELLED') {
      if (onNavigateToEvent && notif.teamId) {
        onNavigateToEvent(notif.teamId, notif.eventId);
        onClose();
      } else if (onSelectEvent && notif.eventId) {
        onSelectEvent(notif.eventId, notif.teamId);
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden text-slate-900 animate-in fade-in zoom-in duration-150">
        
        {/* Modal Header */}
        <div className="bg-slate-50 px-5 py-4 text-slate-900 flex items-center justify-between shrink-0 border-b border-slate-200">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-base sm:text-lg text-slate-900">Oznámení a připomenutí</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-500 text-slate-950">
                    {unreadCount} {unreadCount === 1 ? 'nové' : 'nových'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">Přehled týmových akcí, výzev k docházce a chatu</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-xl transition cursor-pointer border border-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Browser Permission Banner & Test Action */}
        <div className="bg-slate-50/80 border-b border-slate-200 px-3.5 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center space-x-2 text-slate-700">
            {browserPermission === 'granted' ? (
              <>
                <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  {isNative ? 'Nativní oznámení jsou aktivní' : 'Systémová oznámení jsou aktivní'}
                </span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-[11px] text-amber-800 font-medium">
                  {isNative
                    ? 'Oprávnění k oznámením není v systému uděleno'
                    : 'Systémová oznámení nejsou v prohlížeči povolena'}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {browserPermission === 'granted' ? (
              <button
                type="button"
                onClick={handleSendTestNotification}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-700 border border-slate-200 font-bold rounded-lg text-[11px] shrink-0 transition cursor-pointer flex items-center gap-1 active:scale-95 shadow-2xs"
                title="Odešle zkušební notifikaci do vašeho zařízení"
              >
                <Bell className="w-3 h-3 text-slate-500" />
                <span>Otestovat</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRequestBrowserPush}
                className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-black rounded-lg text-[11px] shrink-0 transition cursor-pointer shadow-2xs"
              >
                Povolit v systému
              </button>
            )}
          </div>

          {testStatus && (
            <div className="w-full text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1 flex items-center justify-between animate-in fade-in">
              <span>{testStatus}</span>
            </div>
          )}
        </div>

        {/* Action toolbar & Filters */}
        <div className="px-3 sm:px-4 py-2.5 border-b border-slate-200 bg-white flex flex-col gap-2 shrink-0">
          
          {/* Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs w-full min-w-0">
            <button
              type="button"
              onClick={() => setFilter('ALL')}
              className={`px-2.5 sm:px-3 py-1 rounded-lg font-bold transition cursor-pointer text-xs shrink-0 border ${
                filter === 'ALL'
                  ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-2xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Vše ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('UNREAD')}
              className={`px-2.5 sm:px-3 py-1 rounded-lg font-bold transition cursor-pointer text-xs shrink-0 border ${
                filter === 'UNREAD'
                  ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-2xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Nepřečtené ({unreadCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('ATTENDANCE')}
              className={`px-2.5 sm:px-3 py-1 rounded-lg font-bold transition cursor-pointer text-xs shrink-0 border ${
                filter === 'ATTENDANCE'
                  ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-2xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Docházka
            </button>
            <button
              type="button"
              onClick={() => setFilter('EVENTS')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer text-xs shrink-0 border ${
                filter === 'EVENTS'
                  ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-2xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Události
            </button>
            <button
              type="button"
              onClick={() => setFilter('CHAT')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer text-xs shrink-0 border ${
                filter === 'CHAT'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Chat
            </button>
          </div>

          {/* Quick Bulk Actions */}
          {(unreadCount > 0 || notifications.length > 0) && (
            <div className="flex items-center justify-end gap-2 text-xs pt-1 border-t border-slate-100">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  disabled={isMarkingRead}
                  className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold flex items-center gap-1 transition cursor-pointer text-xs shadow-2xs"
                  title="Označit vše jako přečtené"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>{isMarkingRead ? 'Ukládám...' : 'Vše přečteno'}</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={isClearing}
                  className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 font-bold flex items-center gap-1 transition cursor-pointer text-xs active:scale-95 shadow-2xs"
                  title="Smazat všechna oznámení"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  <span>{isClearing ? 'Mažu...' : 'Vymazat vše'}</span>
                </button>
              )}
            </div>
          )}

        </div>

        {/* Notification List Body */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 sm:p-3 space-y-1 bg-white">
          {filteredNotifications.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <Bell className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-800">Žádná oznámení</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                {filter === 'UNREAD'
                  ? 'Všechna oznámení jsou přečtená.'
                  : 'Zatím nemáte žádná nová upozornění pro zvolený filtr.'}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              return (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`group relative p-3 rounded-xl transition cursor-pointer flex items-start space-x-3 border ${
                    notif.read
                      ? 'bg-white hover:bg-slate-50 text-slate-600 border-transparent hover:border-slate-200'
                      : 'bg-emerald-50/50 hover:bg-emerald-50 text-slate-900 border-emerald-100 shadow-2xs'
                  }`}
                >
                  {/* Category Icon */}
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    notif.type === 'ATTENDANCE_REMINDER'
                      ? 'bg-amber-100 text-amber-700'
                      : notif.type === 'CHAT_MESSAGE'
                      ? 'bg-blue-100 text-blue-700'
                      : notif.type === 'EVENT_CANCELLED'
                      ? 'bg-rose-100 text-rose-700'
                      : notif.type === 'EVENT_UPDATED'
                      ? 'bg-sky-100 text-sky-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {getIconForType(notif.type)}
                  </div>

                  {/* Notification Content */}
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className={`text-xs sm:text-sm font-bold ${
                        notif.read ? 'text-slate-700' : 'text-slate-950 font-black'
                      }`}>
                        {notif.title}
                      </h4>
                      <span className="text-[10px] text-slate-400 flex items-center shrink-0">
                        <Clock className="w-3 h-3 mr-1" />
                        {formatNotificationTime(notif.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed line-clamp-2">
                      {notif.message}
                    </p>

                    <div className="flex items-center gap-2 mt-1.5">
                      {notif.teamName && (
                        <span className="bg-slate-100 text-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded-md border border-slate-200">
                          {notif.teamName}
                        </span>
                      )}
                      {notif.type === 'EVENT_CANCELLED' ? (
                        <span className="text-[10px] text-rose-700 font-semibold bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                          Zrušená událost
                        </span>
                      ) : (
                        <span className="text-[10px] text-emerald-700 font-bold flex items-center opacity-80 group-hover:opacity-100 transition">
                          <span>Přejít k události</span>
                          <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Single delete button */}
                  <div className="flex flex-col items-center justify-between self-stretch shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notif.id, notif.userEmail || activeEmail, notif.notificationKey);
                      }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer border border-slate-200"
                      title="Smazat oznámení"
                      aria-label="Smazat oznámení"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    {!notif.read && (
                      <div className="w-2 h-2 rounded-full bg-emerald-500 mb-1" title="Nepřečtené oznámení" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500">
          Upozornění a jejich předstih můžete upravit v <span className="font-semibold text-slate-700">Nastavení profilu</span> pro každý tým zvlášť.
        </div>

      </div>
    </div>
  );
};

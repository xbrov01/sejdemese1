import React, { useState } from 'react';
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
} from '../utils/notificationService';

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
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>(() => {
    return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied';
  });
  const [isClearing, setIsClearing] = useState(false);
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);

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
      const ids = notifications.map((n) => n.id);
      await clearAllNotifications(activeEmail, ids);
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden text-slate-100 animate-in fade-in zoom-in duration-150">
        
        {/* Modal Header */}
        <div className="bg-slate-950 px-5 py-4 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-base sm:text-lg">Oznámení a připomenutí</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-500 text-slate-950">
                    {unreadCount} {unreadCount === 1 ? 'nové' : 'nových'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">Přehled týmových akcí, výzev k docházce a chatu</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Browser Permission Banner & Test Action */}
        <div className="bg-slate-950/80 border-b border-slate-800 px-3.5 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center space-x-2 text-slate-300">
            {browserPermission === 'granted' ? (
              <>
                <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
                <span className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                  Systémová oznámení v mobilu (Android / PWA) jsou aktivní
                </span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-[11px] text-amber-200/90 font-medium">
                  Systémová oznámení nejsou v prohlížeči povolena
                </span>
              </>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {onOpenNativeAppModal && (
              <button
                type="button"
                onClick={onOpenNativeAppModal}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 font-bold rounded-lg text-[11px] shrink-0 transition cursor-pointer flex items-center gap-1 active:scale-95"
                title="Informace o nativní mobilní aplikaci pro Android a iOS"
              >
                <Smartphone className="w-3 h-3 text-emerald-400" />
                <span>Nativní aplikace (APK)</span>
              </button>
            )}
            {browserPermission === 'granted' ? (
              <button
                type="button"
                onClick={handleSendTestNotification}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 font-bold rounded-lg text-[11px] shrink-0 transition cursor-pointer flex items-center gap-1 active:scale-95"
                title="Odešle zkušební notifikaci do systému Android / prohlížeče"
              >
                <Smartphone className="w-3 h-3 text-slate-400" />
                <span>Vyzkoušet v mobilu</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRequestBrowserPush}
                className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-black rounded-lg text-[11px] shrink-0 transition cursor-pointer"
              >
                Povolit v systému
              </button>
            )}
          </div>

          {testStatus && (
            <div className="w-full text-[11px] font-medium text-emerald-300 bg-emerald-950/60 rounded-lg px-2.5 py-1 flex items-center justify-between animate-in fade-in">
              <span>{testStatus}</span>
            </div>
          )}
        </div>

        {/* Action toolbar & Filters */}
        <div className="px-3 sm:px-4 py-2.5 border-b border-slate-800 bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
          
          {/* Filter Pills */}
          <div className="flex items-center space-x-1.5 text-xs overflow-x-auto py-0.5 -mx-1 px-1 scrollbar-none">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer shrink-0 ${
                filter === 'ALL'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
              }`}
            >
              Vše ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('UNREAD')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer shrink-0 ${
                filter === 'UNREAD'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
              }`}
            >
              Nepřečtené ({unreadCount})
            </button>
            <button
              onClick={() => setFilter('ATTENDANCE')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer shrink-0 ${
                filter === 'ATTENDANCE'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
              }`}
            >
              Docházka
            </button>
            <button
              onClick={() => setFilter('EVENTS')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer shrink-0 ${
                filter === 'EVENTS'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
              }`}
            >
              Události
            </button>
            <button
              onClick={() => setFilter('CHAT')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer shrink-0 ${
                filter === 'CHAT'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
              }`}
            >
              Chat
            </button>
          </div>

          {/* Quick Bulk Actions */}
          <div className="flex items-center justify-end space-x-2 text-xs shrink-0 pt-1 sm:pt-0">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                disabled={isMarkingRead}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold flex items-center gap-1 transition cursor-pointer"
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
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-950/80 text-slate-300 hover:text-rose-300 font-bold flex items-center gap-1 transition cursor-pointer active:scale-95"
                title="Smazat všechna oznámení"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>{isClearing ? 'Mažu...' : 'Vymazat vše'}</span>
              </button>
            )}
          </div>

        </div>

        {/* Notification List Body */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80 p-2 sm:p-3 space-y-1 bg-slate-900">
          {filteredNotifications.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <Bell className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-200">Žádná oznámení</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
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
                  className={`group relative p-3 rounded-xl transition cursor-pointer flex items-start space-x-3 ${
                    notif.read
                      ? 'bg-slate-850/60 hover:bg-slate-800 text-slate-300'
                      : 'bg-slate-800 hover:bg-slate-750 text-white shadow-md'
                  }`}
                >
                  {/* Category Icon */}
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    notif.type === 'ATTENDANCE_REMINDER'
                      ? 'bg-amber-500/20 text-amber-400'
                      : notif.type === 'CHAT_MESSAGE'
                      ? 'bg-blue-500/20 text-blue-400'
                      : notif.type === 'EVENT_CANCELLED'
                      ? 'bg-rose-500/20 text-rose-400'
                      : notif.type === 'EVENT_UPDATED'
                      ? 'bg-sky-500/20 text-sky-400'
                      : 'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    {getIconForType(notif.type)}
                  </div>

                  {/* Notification Content */}
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className={`text-xs sm:text-sm font-bold ${
                        notif.read ? 'text-slate-300' : 'text-white font-extrabold'
                      }`}>
                        {notif.title}
                      </h4>
                      <span className="text-[10px] text-slate-400 flex items-center shrink-0">
                        <Clock className="w-3 h-3 mr-1" />
                        {formatNotificationTime(notif.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed line-clamp-2">
                      {notif.message}
                    </p>

                    <div className="flex items-center gap-2 mt-1.5">
                      {notif.teamName && (
                        <span className="bg-slate-950 text-slate-300 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                          {notif.teamName}
                        </span>
                      )}
                      {notif.type === 'EVENT_CANCELLED' ? (
                        <span className="text-[10px] text-rose-300 font-semibold bg-rose-950/80 px-2 py-0.5 rounded">
                          Zrušená událost
                        </span>
                      ) : (
                        <span className="text-[10px] text-emerald-400 font-bold flex items-center opacity-80 group-hover:opacity-100 transition">
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
                        deleteNotification(notif.id);
                      }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-800 text-slate-400 hover:text-rose-400 hover:bg-rose-950/80 transition cursor-pointer"
                      title="Smazat oznámení"
                      aria-label="Smazat oznámení"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    {!notif.read && (
                      <div className="w-2 h-2 rounded-full bg-emerald-400 mb-1" title="Nepřečtené oznámení" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 text-center text-xs text-slate-400">
          Upozornění a jejich předstih můžete upravit v <span className="font-semibold text-slate-300">Nastavení profilu</span> pro každý tým zvlášť.
        </div>

      </div>
    </div>
  );
};

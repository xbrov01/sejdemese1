export type UserRole = 'admin' | 'member';

export type AppFontSize = 'standard' | 'large' | 'xlarge';

export interface TeamNotificationPreferences {
  teamRemindersEnabled?: boolean; // Týmová připomenutí nadcházející akce (výchozí: true)
  attendanceReminderEnabled?: boolean; // Upozornění na nutnost zadat účast (výchozí: true)
  attendanceReminderHours?: number; // Předstih upozornění na docházku v hodinách (výchozí: 24)
  chatNotificationsEnabled?: boolean; // Upozornění na nové zprávy v chatu události (výchozí: true)
  eventCreatedNotificationEnabled?: boolean; // Upozornění při vytvoření nové události v týmu (výchozí: true)
  eventUpdatedNotificationEnabled?: boolean; // Upozornění při změně / úpravě události v týmu (výchozí: true)
  eventCancelledNotificationEnabled?: boolean; // Upozornění při zrušení / smazání události v týmu (výchozí: true)
}

export interface DeviceTokenInfo {
  token: string;
  platform: 'android' | 'ios' | 'web';
  updatedAt: string;
}

export interface UserProfile {
  id: string; // email as document ID
  name: string; // Jméno a Příjmení
  email: string; // Uživatelské jméno
  role: UserRole;
  isSuperAdmin?: boolean; // Globální systémová práva pro správu všech týmů a událostí
  isSystemAccount?: boolean; // Systémový účet skrytý z běžných seznamů hráčů
  createdAt?: string;
  password?: string;
  tempPassword?: string;
  requirePasswordReset?: boolean;
  teamNicknames?: Record<string, string>; // teamId -> nickname
  notificationPreferences?: Record<string, TeamNotificationPreferences>; // teamId -> preferences
  fontSize?: AppFontSize; // 'standard' | 'large' | 'xlarge'
  deviceTokens?: DeviceTokenInfo[]; // Registrace FCM / APNS / Web tokenů pro nativní notifikace
  avatarUrl?: string; // Profilová fotka z Google účtu
  authProvider?: 'password' | 'google'; // Způsob registrace / přihlášení
}

export interface Team {
  id: string;
  name: string;
  code: string;
  createdBy: string; // admin email
  memberEmails: string[];
  adminEmails?: string[]; // seznam emailů správců týmu
  nicknames?: Record<string, string>; // userEmail -> nickname
  createdAt?: string;
  cardBgColor?: string; // výchozí barva pozadí karty události (např. #0f172a)
  cardBgImage?: string; // nepovinný obrázek pozadí karty události (URL nebo data URL)
}

export interface Event {
  id: string;
  teamId: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM (čas začátku)
  endTime?: string; // HH:MM (čas konce - výchozí trvání 1 hodina)
  location: string;
  createdBy: string; // email
  createdAt?: string;
  reminders?: number[]; // Hodiny předem pro týmová připomenutí, např. [24, 2]
}

export type AttendanceStatus = 'YES' | 'MAYBE' | 'NO';

export interface AttendanceRecord {
  id: string; // userEmail
  userEmail: string;
  userName: string;
  status: AttendanceStatus;
  updatedAt: string;
}

export interface EventMessage {
  id: string;
  authorName: string;
  authorEmail: string;
  text: string;
  timestamp: any;
}

export type NotificationType =
  | 'TEAM_REMINDER'
  | 'ATTENDANCE_REMINDER'
  | 'CHAT_MESSAGE'
  | 'EVENT_CREATED'
  | 'EVENT_UPDATED'
  | 'EVENT_CANCELLED';

export interface NotificationItem {
  id: string;
  userEmail: string;
  teamId: string;
  teamName?: string;
  eventId?: string;
  eventTitle?: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  pushed?: boolean; // Zda již byla pro tuto notifikaci odeslána systémová/nativní push notifikace
  createdAt: string;
  notificationKey?: string; // Unikátní klíč zabraňující duplicitnímu vygenerování
}

import { UserProfile, Team } from '../types';

/**
 * Pevně definovaný systémový účet pro globálního superadmina
 */
export const SYSTEM_SUPERUSER_EMAIL = 'admin@sejdemese.cz';
export const SYSTEM_SUPERUSER_DEFAULT_PASSWORDS = ['admin', 'SejdemeSe2026!'];
export const OWNER_SUPERUSER_EMAIL = 'vojtech.broz@gmail.com';

/**
 * Zjistí, zda má daný uživatel roli globálního superadmina (má přístup ke všem týmům i událostem)
 */
export const isUserSuperAdmin = (
  user?: Partial<UserProfile> | null
): boolean => {
  if (!user || !user.email) return false;
  const emailLower = user.email.toLowerCase().trim();
  return (
    user.isSuperAdmin === true ||
    emailLower === SYSTEM_SUPERUSER_EMAIL.toLowerCase() ||
    emailLower === OWNER_SUPERUSER_EMAIL.toLowerCase()
  );
};

/**
 * Zjistí, zda má uživatel administrátorská práva pro daný tým:
 * - Je globální superadmin (má práva na vše)
 * - Má obecnou roli 'admin'
 * - Je zakladatelem daného týmu (team.createdBy)
 * - Je uveden v seznamu správců týmu (team.adminEmails)
 */
export const isUserTeamAdmin = (
  user?: Partial<UserProfile> | null,
  team?: Partial<Team> | null
): boolean => {
  if (!user || !user.email) return false;
  if (isUserSuperAdmin(user)) return true;
  if (user.role === 'admin') return true;
  if (!team) return false;

  const emailLower = user.email.toLowerCase().trim();
  if (team.createdBy && team.createdBy.toLowerCase().trim() === emailLower) {
    return true;
  }
  if (team.adminEmails && team.adminEmails.some((e) => e.toLowerCase().trim() === emailLower)) {
    return true;
  }

  return false;
};

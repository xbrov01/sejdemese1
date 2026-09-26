import { Team, UserProfile } from '../types';

/**
 * Vrátí zobrazované jméno uživatele v rámci daného týmu:
 * 1. Pokud má uživatel v týmu zadanou přezdívku (team.nicknames[userEmail]), použije se tato přezdívka.
 * 2. Jinak se použije Jméno a Příjmení z profilu uživatele (userProfile.name).
 * 3. Fallback na fallbackName nebo userEmail.
 */
export function getMemberDisplayName(
  userEmail: string,
  team?: Team | null,
  userProfile?: UserProfile | null,
  fallbackName?: string
): string {
  if (!userEmail) return fallbackName || '';

  // 1. Přezdívka v týmu
  const teamNickname = team?.nicknames?.[userEmail];
  if (teamNickname && teamNickname.trim().length > 0) {
    return teamNickname.trim();
  }

  // 2. Jméno a Příjmení z profilu uživatele
  if (userProfile?.name && userProfile.name.trim().length > 0) {
    return userProfile.name.trim();
  }

  // 3. Fallback name (např. dříve uložené name v docházce)
  if (fallbackName && fallbackName.trim().length > 0) {
    return fallbackName.trim();
  }

  return userEmail;
}

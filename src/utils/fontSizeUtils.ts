import { AppFontSize } from '../types';

export const FONT_SIZE_STORAGE_KEY = 'sejdemese_font_size';

export interface FontSizeOption {
  id: AppFontSize;
  label: string;
  sublabel: string;
  previewClass: string;
  sizeMultiplier: string;
  badge: string;
}

export const FONT_SIZE_OPTIONS: FontSizeOption[] = [
  {
    id: 'standard',
    label: 'Standardní',
    sublabel: 'Výchozí kompaktní velikost (nejmenší)',
    previewClass: 'text-xs',
    sizeMultiplier: '100%',
    badge: 'Základní',
  },
  {
    id: 'large',
    label: 'Větší',
    sublabel: 'Zvětšené písmo pro lepší a pohodlnější čitelnost',
    previewClass: 'text-sm',
    sizeMultiplier: '+12,5 %',
    badge: 'Doporučeno',
  },
  {
    id: 'xlarge',
    label: 'Největší',
    sublabel: 'Extra velké písmo, ideální pro snadné čtení na mobilu',
    previewClass: 'text-base',
    sizeMultiplier: '+28 %',
    badge: 'Maxi',
  },
];

/**
 * Aplikuje zvolenou velikost písma na root dokumentu (HTML element)
 */
export const applyAppFontSize = (size?: AppFontSize | null) => {
  if (typeof document === 'undefined') return;
  
  const validSize = size === 'large' || size === 'xlarge' ? size : 'standard';
  const root = document.documentElement;

  if (validSize === 'large') {
    root.style.fontSize = '18px';
    root.setAttribute('data-app-font-size', 'large');
  } else if (validSize === 'xlarge') {
    root.style.fontSize = '20.5px';
    root.setAttribute('data-app-font-size', 'xlarge');
  } else {
    // Standardní (nejmenší / výchozí)
    root.style.fontSize = '16px';
    root.setAttribute('data-app-font-size', 'standard');
  }
};

/**
 * Získá uloženou preferenci velikosti písma
 */
export const getInitialFontSize = (userFontSize?: AppFontSize | null): AppFontSize => {
  if (userFontSize && (userFontSize === 'standard' || userFontSize === 'large' || userFontSize === 'xlarge')) {
    return userFontSize;
  }
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    if (saved === 'standard' || saved === 'large' || saved === 'xlarge') {
      return saved as AppFontSize;
    }
  }
  return 'standard';
};

/**
 * Uloží velikost písma do localStorage a okamžitě ji aplikuje
 */
export const saveFontSizePreference = (size: AppFontSize) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, size);
  }
  applyAppFontSize(size);
};

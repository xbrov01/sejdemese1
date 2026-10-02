export interface ColorPreset {
  name: string;
  value: string;
}

export const COLOR_PRESETS: ColorPreset[] = [
  { name: 'Čistý atletický (Clean Athletic Emerald)', value: '#059669' },
  { name: 'Královská modř (Royal Blue)', value: '#1d4ed8' },
  { name: 'Smaragdová zeleň (Deep Emerald)', value: '#047857' },
  { name: 'Námořnická modrá (Navy)', value: '#1e3a8a' },
  { name: 'Svěží tyrkys (Teal / Cyan)', value: '#0d9488' },
  { name: 'Indigo / Fialová', value: '#4f46e5' },
  { name: 'Vínová / Rubínová', value: '#991b1b' },
  { name: 'Grafitová atletická (Graphite)', value: '#334155' },
];

export const MAX_IMAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB limit
export const MAX_IMAGE_FILE_SIZE_LABEL = '5 MB';

/**
 * Komprese a optimalizace nahraného obrázku pro úsporné uložení
 */
export const compressImageFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
      reject(new Error(`Maximální povolená velikost souboru je ${MAX_IMAGE_FILE_SIZE_LABEL}.`));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDimension = 1000;
        let { width, height } = img;
        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => reject(new Error('Chyba při načítání obrázku.'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Chyba při čtení souboru.'));
    reader.readAsDataURL(file);
  });
};

/**
 * Vypočte plně neprůhledný (solid/non-transparent) světlý pastelový odstín barvy smícháním s bílou
 * Zaručuje 100% krytí a neprůhlednost, aby obrázek na pozadí neprosvítal pod ovládacími prvky
 */
export const getSolidLighterShade = (hex: string, tintRatio: number = 0.12): string => {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map((char) => char + char).join('');
  }
  const num = parseInt(c, 16);
  if (isNaN(num) || c.length !== 6) {
    const r = Math.round(255 * (1 - tintRatio) + 5 * tintRatio);
    const g = Math.round(255 * (1 - tintRatio) + 150 * tintRatio);
    const b = Math.round(255 * (1 - tintRatio) + 105 * tintRatio);
    return `rgb(${r}, ${g}, ${b})`;
  }
  const origR = (num >> 16) & 255;
  const origG = (num >> 8) & 255;
  const origB = num & 255;

  const r = Math.round(255 * (1 - tintRatio) + origR * tintRatio);
  const g = Math.round(255 * (1 - tintRatio) + origG * tintRatio);
  const b = Math.round(255 * (1 - tintRatio) + origB * tintRatio);

  return `rgb(${r}, ${g}, ${b})`;
};

/**
 * Převod hex barvy na rgba s průhledností pro jemné podbarvení
 */
export const hexToRgba = (hex: string, alpha: number): string => {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map((char) => char + char).join('');
  }
  const num = parseInt(c, 16);
  if (isNaN(num) || c.length !== 6) {
    return `rgba(5, 150, 105, ${alpha})`;
  }
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Ztmavený odstín pro vysoce kontrastní a čitelný text na světlém podkladu
 */
export const getContrastingTextColor = (hex: string): string => {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map((char) => char + char).join('');
  }
  const num = parseInt(c, 16);
  if (isNaN(num) || c.length !== 6) {
    return '#065f46';
  }
  const r = Math.max(0, Math.floor(((num >> 16) & 255) * 0.72));
  const g = Math.max(0, Math.floor(((num >> 8) & 255) * 0.72));
  const b = Math.max(0, Math.floor((num & 255) * 0.72));
  return `rgb(${r}, ${g}, ${b})`;
};

export interface ColorPreset {
  name: string;
  value: string;
}

export interface ImagePreset {
  id: string;
  name: string;
  url: string;
  thumbnail: string;
}

export const COLOR_PRESETS: ColorPreset[] = [
  { name: 'Tmavá břidlice (Výchozí)', value: '#0f172a' },
  { name: 'Tmavě modrá (Navy)', value: '#1e3a8a' },
  { name: 'Královská modř', value: '#1d4ed8' },
  { name: 'Smaragdová zeleň', value: '#064e3b' },
  { name: 'Noční fialová', value: '#312e81' },
  { name: 'Vínová / Rubínová', value: '#881337' },
  { name: 'Jantarová / Uhlová', value: '#78350f' },
  { name: 'Uhlíková černá', value: '#18181b' },
  { name: 'Tmavě šedá', value: '#334155' },
];

export const IMAGE_PRESETS: ImagePreset[] = [
  {
    id: 'football',
    name: 'Fotbalový trávník',
    url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=240&q=70',
  },
  {
    id: 'futsal_hall',
    name: 'Palubovka haly / Futsal',
    url: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=240&q=70',
  },
  {
    id: 'night_stadium',
    name: 'Noční stadion s reflektory',
    url: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1200&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=240&q=70',
  },
  {
    id: 'volleyball',
    name: 'Volejbalový kurt',
    url: 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=1200&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=240&q=70',
  },
  {
    id: 'ice_hockey',
    name: 'Ledová plocha / Hokej',
    url: 'https://images.unsplash.com/photo-1580748141549-71748dbe0bdc?auto=format&fit=crop&w=1200&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1580748141549-71748dbe0bdc?auto=format&fit=crop&w=240&q=70',
  },
  {
    id: 'basketball',
    name: 'Basketbalový kurt',
    url: 'https://images.unsplash.com/photo-1519766304817-4f37bda74a29?auto=format&fit=crop&w=1200&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1519766304817-4f37bda74a29?auto=format&fit=crop&w=240&q=70',
  },
  {
    id: 'running_track',
    name: 'Běžecká atletická dráha',
    url: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=1200&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=240&q=70',
  },
  {
    id: 'tennis_court',
    name: 'Tenisový kurt',
    url: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=1200&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=240&q=70',
  },
];

/**
 * Komprese a optimalizace nahraného obrázku pro úsporné uložení
 */
export const compressImageFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
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

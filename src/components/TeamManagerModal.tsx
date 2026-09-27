import React, { useState } from 'react';
import { UserProfile, Team } from '../types';
import { db, collection, addDoc, doc, updateDoc, arrayUnion, arrayRemove } from '../lib/firebase';
import {
  Users,
  Plus,
  Key,
  X,
  Check,
  Shield,
  UserPlus,
  UserMinus,
  Copy,
  KeyRound,
  RotateCcw,
  Palette,
  Image as ImageIcon,
  Upload,
  Trash2,
  Eye,
  Settings,
  Calendar,
  Clock,
  MapPin,
} from 'lucide-react';
import { COLOR_PRESETS, IMAGE_PRESETS, compressImageFile } from '../utils/themePresets';

export type TeamModalMode = 'create' | 'join' | 'members' | 'settings';

interface TeamManagerModalProps {
  mode: TeamModalMode;
  currentUser: UserProfile;
  activeTeam: Team | null;
  allUsers: UserProfile[];
  onClose: () => void;
  onTeamCreated: (team: Team) => void;
  onTeamJoined: (teamId: string) => void;
  onTeamUpdated?: (team: Team) => void;
}

export const TeamManagerModal: React.FC<TeamManagerModalProps> = ({
  mode: initialMode,
  currentUser,
  activeTeam,
  allUsers,
  onClose,
  onTeamCreated,
  onTeamJoined,
  onTeamUpdated,
}) => {
  const [mode, setMode] = useState<TeamModalMode>(initialMode);

  // Create & Settings State
  const [teamName, setTeamName] = useState(activeTeam?.name || '');
  const [cardBgColor, setCardBgColor] = useState(activeTeam?.cardBgColor || '#0f172a');
  const [cardBgImage, setCardBgImage] = useState<string>(activeTeam?.cardBgImage || '');
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Join Team state
  const [teamCodeInput, setTeamCodeInput] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Admin Reset Password Result modal state
  const [resetResult, setResetResult] = useState<{ userName: string; email: string; tempPassword: string } | null>(null);
  const [copiedTempPass, setCopiedTempPass] = useState(false);

  // Synchronizovat stav při přepnutí týmu nebo módu
  React.useEffect(() => {
    if (mode === 'settings' && activeTeam) {
      setTeamName(activeTeam.name);
      setCardBgColor(activeTeam.cardBgColor || '#0f172a');
      setCardBgImage(activeTeam.cardBgImage || '');
    } else if (mode === 'create') {
      setTeamName('');
      setCardBgColor('#0f172a');
      setCardBgImage('');
    }
  }, [mode, activeTeam]);

  // Generování unikátního kódu týmu
  const generateTeamCode = (name: string) => {
    const prefix = name
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 5) || 'TEAM';
    const randomNum = Math.floor(100 + Math.random() * 900);
    return `${prefix}-${randomNum}`;
  };

  // Zpracování nahrání vlastního souboru obrázku
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Vyberte prosím platný soubor obrázku (JPG, PNG, WebP).');
      return;
    }

    setIsUploadingImage(true);
    setError(null);
    try {
      const compressedDataUrl = await compressImageFile(file);
      setCardBgImage(compressedDataUrl);
      setSuccessMsg('Obrázek byl úspěšně nahrán!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      console.error('Chyba při kompresi obrázku:', err);
      setError('Nepodařilo se zpracovat obrázek.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Vložení vlastní URL adresy obrázku
  const handleApplyCustomUrl = () => {
    if (!customImageUrl.trim()) return;
    setCardBgImage(customImageUrl.trim());
    setCustomImageUrl('');
    setSuccessMsg('URL obrázku byla nastavena.');
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  // Vytvoření nového týmu
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) {
      setError('Zadejte název týmu.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const code = generateTeamCode(teamName.trim());
      const newTeamData: Omit<Team, 'id'> = {
        name: teamName.trim(),
        code,
        createdBy: currentUser.email,
        memberEmails: [currentUser.email],
        createdAt: new Date().toISOString(),
        cardBgColor: cardBgColor || '#0f172a',
        cardBgImage: cardBgImage || undefined,
      };

      const docRef = await addDoc(collection(db, 'teams'), newTeamData);
      const createdTeam: Team = { id: docRef.id, ...newTeamData };

      onTeamCreated(createdTeam);
      onClose();
    } catch (err: any) {
      console.error('Chyba při vytváření týmu:', err);
      setError('Nepodařilo se vytvořit tým.');
    } finally {
      setLoading(false);
    }
  };

  // Uložení změn existujícího týmu (Vzhled & Nastavení)
  const handleSaveTeamSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTeam) return;
    if (!teamName.trim()) {
      setError('Název týmu nesmí být prázdný.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const teamRef = doc(db, 'teams', activeTeam.id);
      const updateData: Partial<Team> = {
        name: teamName.trim(),
        cardBgColor: cardBgColor || '#0f172a',
        cardBgImage: cardBgImage || '',
      };

      await updateDoc(teamRef, updateData);

      const updated: Team = {
        ...activeTeam,
        ...updateData,
      };

      if (onTeamUpdated) {
        onTeamUpdated(updated);
      }

      setSuccessMsg('Nastavení a vzhled týmu byly úspěšně uloženy!');
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Chyba při ukládání nastavení týmu:', err);
      setError('Nepodařilo se uložit nastavení týmu.');
    } finally {
      setLoading(false);
    }
  };

  // Připojení k týmu pomocí kódu
  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = teamCodeInput.trim().toUpperCase();
    if (!cleanCode) {
      setError('Zadejte kód týmu.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { getDocs, query, where } = await import('../lib/firebase');
      const teamsRef = collection(db, 'teams');
      const q = query(teamsRef, where('code', '==', cleanCode));
      const querySnap = await getDocs(q);

      if (querySnap.empty) {
        setError('Tým s tímto kódem neexistuje. Zkontrolujte prosím kód.');
        setLoading(false);
        return;
      }

      const teamDoc = querySnap.docs[0];
      const teamData = teamDoc.data() as Team;

      if (teamData.memberEmails?.includes(currentUser.email)) {
        setSuccessMsg('Již jste členem tohoto týmu!');
        onTeamJoined(teamDoc.id);
        setTimeout(onClose, 1200);
        return;
      }

      await updateDoc(doc(db, 'teams', teamDoc.id), {
        memberEmails: arrayUnion(currentUser.email),
      });

      setSuccessMsg(`Byli jste úspěšně připojeni k týmu „${teamData.name}“!`);
      onTeamJoined(teamDoc.id);
      setTimeout(onClose, 1200);
    } catch (err: any) {
      console.error('Chyba při připojování k týmu:', err);
      setError('Nastala chyba při připojování k týmu.');
    } finally {
      setLoading(false);
    }
  };

  // Správa členů
  const handleToggleMember = async (userEmail: string, isCurrentlyMember: boolean) => {
    if (!activeTeam) return;
    setLoading(true);

    try {
      const teamRef = doc(db, 'teams', activeTeam.id);
      if (isCurrentlyMember) {
        await updateDoc(teamRef, {
          memberEmails: arrayRemove(userEmail),
        });
      } else {
        await updateDoc(teamRef, {
          memberEmails: arrayUnion(userEmail),
        });
      }
    } catch (err: any) {
      console.error('Chyba při změně členství:', err);
      setError('Nepodařilo se upravit členství.');
    } finally {
      setLoading(false);
    }
  };

  // Admin Reset Hesla
  const handleAdminResetPassword = async (targetUser: UserProfile) => {
    if (!window.confirm(`Opravdu chcete vygenerovat dočasné heslo pro uživatele ${targetUser.name}?`)) {
      return;
    }

    setLoading(true);
    setError(null);

    const randomDigits = Math.floor(100 + Math.random() * 900);
    const tempPassword = `Heslo${randomDigits}`;

    try {
      const userRef = doc(db, 'users', targetUser.email);
      await updateDoc(userRef, {
        tempPassword,
        requirePasswordReset: true,
      });

      setResetResult({
        userName: targetUser.name,
        email: targetUser.email,
        tempPassword,
      });
    } catch (err: any) {
      console.error('Chyba při resetování hesla:', err);
      setError('Nepodařilo se resetovat heslo.');
    } finally {
      setLoading(false);
    }
  };

  const copyCodeToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyTempPassToClipboard = (pass: string) => {
    navigator.clipboard.writeText(pass);
    setCopiedTempPass(true);
    setTimeout(() => setCopiedTempPass(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden text-slate-100 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-slate-950 px-5 py-3.5 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base sm:text-lg">
              {mode === 'create' && 'Vytvořit nový tým'}
              {mode === 'join' && 'Připojit se k týmu'}
              {mode === 'members' && `Správa členů — ${activeTeam?.name}`}
              {mode === 'settings' && `Vzhled & Nastavení týmu — ${activeTeam?.name}`}
            </h3>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white rounded-xl transition cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex flex-wrap bg-slate-950 p-1.5 gap-1.5 border-b border-slate-800">
          <button
            onClick={() => { setMode('join'); setError(null); setSuccessMsg(null); }}
            className={`flex-1 min-w-[100px] py-1.5 px-2 text-xs font-bold rounded-xl transition flex items-center justify-center space-x-1 cursor-pointer ${
              mode === 'join' ? 'bg-emerald-500 text-slate-950 shadow-sm font-black' : 'bg-slate-850 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Kód týmu</span>
          </button>

          {currentUser.role === 'admin' && (
            <button
              onClick={() => { setMode('create'); setError(null); setSuccessMsg(null); }}
              className={`flex-1 min-w-[100px] py-1.5 px-2 text-xs font-bold rounded-xl transition flex items-center justify-center space-x-1 cursor-pointer ${
                mode === 'create' ? 'bg-emerald-500 text-slate-950 shadow-sm font-black' : 'bg-slate-850 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nový tým</span>
            </button>
          )}

          {currentUser.role === 'admin' && activeTeam && (
            <button
              onClick={() => { setMode('settings'); setError(null); setSuccessMsg(null); }}
              className={`flex-1 min-w-[100px] py-1.5 px-2 text-xs font-bold rounded-xl transition flex items-center justify-center space-x-1 cursor-pointer ${
                mode === 'settings' ? 'bg-purple-500 text-slate-950 shadow-sm font-black' : 'bg-slate-850 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Vzhled & Styl</span>
            </button>
          )}

          {currentUser.role === 'admin' && activeTeam && (
            <button
              onClick={() => { setMode('members'); setError(null); setSuccessMsg(null); }}
              className={`flex-1 min-w-[100px] py-1.5 px-2 text-xs font-bold rounded-xl transition flex items-center justify-center space-x-1 cursor-pointer ${
                mode === 'members' ? 'bg-emerald-500 text-slate-950 shadow-sm font-black' : 'bg-slate-850 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Členové</span>
            </button>
          )}
        </div>

        {/* Body Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 bg-slate-900">
          {error && (
            <div className="p-3 bg-rose-950/80 text-rose-300 text-xs rounded-xl font-medium">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-950/80 text-emerald-300 text-xs rounded-xl flex items-center font-medium">
              <Check className="w-4 h-4 text-emerald-400 mr-2 shrink-0" />
              {successMsg}
            </div>
          )}

          {/* ADMIN RESET PASSWORD RESULT DIALOG */}
          {resetResult && (
            <div className="p-4 bg-amber-950/60 rounded-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-amber-900/60 pb-2">
                <div className="flex items-center space-x-2 text-amber-300 font-bold text-sm">
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  <span>Vygenerováno dočasné heslo</span>
                </div>
                <button
                  onClick={() => setResetResult(null)}
                  className="text-amber-400 hover:text-amber-200 text-xs font-bold cursor-pointer"
                >
                  Zavřít
                </button>
              </div>

              <div className="text-xs text-amber-200/90">
                Nové dočasné heslo pro uživatele <strong>{resetResult.userName}</strong> ({resetResult.email}):
              </div>

              <div className="bg-slate-950 p-3 rounded-xl flex items-center justify-between">
                <span className="font-mono text-lg font-bold text-emerald-400 tracking-wider">
                  {resetResult.tempPassword}
                </span>
                <button
                  type="button"
                  onClick={() => copyTempPassToClipboard(resetResult.tempPassword)}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-lg flex items-center space-x-1 transition cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedTempPass ? 'Zkopírováno!' : 'Zkopírovat'}</span>
                </button>
              </div>

              <p className="text-[11px] text-amber-300/80">
                Předejte toto heslo uživateli. Při jeho příštím přihlášení ho aplikace vyzve ke změně hesla.
              </p>
            </div>
          )}

          {/* MODE: CREATE TEAM OR EDIT APPEARANCE / SETTINGS */}
          {(mode === 'create' || mode === 'settings') && (
            <form onSubmit={mode === 'create' ? handleCreateTeam : handleSaveTeamSettings} className="space-y-5">
              
              {/* Název týmu */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Název sportovního týmu
                </label>
                <input
                  type="text"
                  required
                  placeholder="např. Středeční Futsal, HC Vlci, Volejbal Bráník..."
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-800 rounded-xl text-white text-sm focus:ring-2 focus:ring-emerald-400 outline-none"
                />
              </div>

              {/* VÝCHOZÍ BARVA POZADÍ KARTY UDÁLOSTI */}
              <div className="bg-slate-950 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Palette className="w-4 h-4 text-emerald-400" />
                    <label className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Výchozí barva pozadí karty události
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-mono text-slate-400">{cardBgColor}</span>
                    <input
                      type="color"
                      value={cardBgColor}
                      onChange={(e) => setCardBgColor(e.target.value)}
                      className="w-7 h-7 rounded-lg cursor-pointer p-0.5 bg-slate-800 border-none"
                      title="Vlastní barva"
                    />
                  </div>
                </div>

                {/* Barevné předvolby */}
                <div className="grid grid-cols-3 sm:grid-cols-3 gap-2">
                  {COLOR_PRESETS.map((preset) => {
                    const isSelected = cardBgColor.toLowerCase() === preset.value.toLowerCase();
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setCardBgColor(preset.value)}
                        className={`flex items-center space-x-2 px-2.5 py-2 rounded-xl text-left text-xs transition cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                            : 'bg-slate-850 hover:bg-slate-800 text-slate-200'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full shrink-0 shadow-xs"
                          style={{ backgroundColor: preset.value }}
                        />
                        <span className="truncate text-[11px]">{preset.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* OBRÁZEK POZADÍ KARTY UDÁLOSTI (NEPOVINNÝ) */}
              <div className="bg-slate-950 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ImageIcon className="w-4 h-4 text-emerald-400" />
                    <label className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Obrázek pozadí karty události <span className="text-slate-500 font-normal">(nepovinné)</span>
                    </label>
                  </div>
                  {cardBgImage && (
                    <button
                      type="button"
                      onClick={() => setCardBgImage('')}
                      className="text-xs text-rose-400 hover:text-rose-300 font-bold flex items-center space-x-1 cursor-pointer bg-rose-950/80 px-2 py-1 rounded-lg"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Odebrat obrázek</span>
                    </button>
                  )}
                </div>

                {/* Předvolené sportovní motivy */}
                <div>
                  <div className="text-[11px] text-slate-400 font-medium mb-2">
                    Vyberte ze sportovních motivů:
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {IMAGE_PRESETS.map((imgPreset) => {
                      const isSelected = cardBgImage === imgPreset.url;
                      return (
                        <button
                          key={imgPreset.id}
                          type="button"
                          onClick={() => setCardBgImage(imgPreset.url)}
                          className={`relative group rounded-xl overflow-hidden text-left transition cursor-pointer h-16 ${
                            isSelected
                              ? 'ring-2 ring-emerald-400 shadow-lg scale-[1.02]'
                              : 'opacity-80 hover:opacity-100'
                          }`}
                        >
                          <img
                            src={imgPreset.thumbnail}
                            alt={imgPreset.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-end p-1.5">
                            <span className="text-[10px] font-bold text-white leading-tight truncate">
                              {imgPreset.name}
                            </span>
                          </div>
                          {isSelected && (
                            <div className="absolute top-1 right-1 bg-emerald-500 text-slate-950 rounded-full p-0.5 shadow font-black">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Vlastní obrázek: Nahrání souboru nebo URL */}
                <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row items-center gap-2">
                  <label className="w-full sm:w-auto flex-1 flex items-center justify-center px-3 py-2 bg-slate-800 hover:bg-slate-750 rounded-xl text-xs font-bold text-slate-200 cursor-pointer shadow-xs transition">
                    <Upload className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                    <span>{isUploadingImage ? 'Nahrávání...' : 'Nahrát soubor z PC'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      disabled={isUploadingImage}
                      className="hidden"
                    />
                  </label>

                  <div className="w-full sm:w-auto flex-1 flex items-center gap-1.5">
                    <input
                      type="url"
                      placeholder="Nebo vložte URL obrázku..."
                      value={customImageUrl}
                      onChange={(e) => setCustomImageUrl(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-800 rounded-xl text-xs text-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCustomUrl}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl shrink-0 cursor-pointer"
                    >
                      Použít
                    </button>
                  </div>
                </div>
              </div>

              {/* ŽIVÝ NÁHLED KARTY (LIVE PREVIEW) */}
              <div>
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Náhled karty události pro tento tým</span>
                </div>
                
                <div className="rounded-2xl overflow-hidden shadow-xl bg-slate-950">
                  <div
                    className="p-4 text-white relative transition-all duration-300"
                    style={{
                      backgroundColor: cardBgColor || '#090d16',
                      backgroundImage: cardBgImage
                        ? `linear-gradient(to right, rgba(9, 13, 22, 0.92), rgba(9, 13, 22, 0.78)), url(${cardBgImage})`
                        : undefined,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center space-x-1 text-emerald-400 font-bold uppercase tracking-wider">
                        <Calendar className="w-3 h-3" />
                        <span>Čtvrtek 20. 08. 2026</span>
                        <span>•</span>
                        <Clock className="w-3 h-3" />
                        <span>18:30</span>
                      </div>
                      <span className="bg-slate-900/90 text-white px-2 py-0.5 rounded text-[10px] font-mono">
                        #{activeTeam?.code || 'FUTSAL-101'} {teamName || 'Název týmu'}
                      </span>
                    </div>

                    <h4 className="text-base font-black text-white">
                      Mistrovský zápas / Trénink
                    </h4>

                    <div className="flex items-center space-x-1 text-xs text-slate-300 mt-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span>Sportovní hala / Hřiště 1</span>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center gap-2 text-xs">
                      <span className="flex-1 py-2 bg-emerald-500 text-slate-950 rounded-xl text-xs font-black text-center shadow-md">
                        JDU
                      </span>
                      <span className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold text-center">
                        MOŽNÁ
                      </span>
                      <span className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold text-center">
                        NEJDU
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || isUploadingImage}
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-black rounded-xl shadow-md text-sm transition flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>
                    {loading
                      ? 'Ukládání...'
                      : mode === 'create'
                      ? 'Vytvořit tým se zvoleným vzhledem'
                      : 'Uložit nastavení a vzhled týmu'}
                  </span>
                </button>
              </div>
            </form>
          )}

          {/* MODE: JOIN TEAM */}
          {mode === 'join' && (
            <form onSubmit={handleJoinTeam} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Kód týmu (obdržený od správce)
                </label>
                <input
                  type="text"
                  required
                  placeholder="např. FUTSAL-839"
                  value={teamCodeInput}
                  onChange={(e) => setTeamCodeInput(e.target.value)}
                  className="w-full px-3.5 py-3 bg-slate-800 rounded-xl uppercase font-mono tracking-widest text-center text-lg font-bold text-emerald-400 focus:ring-2 focus:ring-emerald-400 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-black rounded-xl shadow-md text-sm transition flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Key className="w-4 h-4" />
                <span>{loading ? 'Připojování...' : 'Připojit se k týmu'}</span>
              </button>
            </form>
          )}

          {/* MODE: MANAGE MEMBERS */}
          {mode === 'members' && activeTeam && (
            <div className="space-y-4">
              {/* Team Code Share Box */}
              <div className="p-3.5 bg-slate-950 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                    Unikátní kód týmu pro sdílení:
                  </div>
                  <div className="font-mono text-base font-black text-white tracking-wider">
                    #{activeTeam.code}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => copyCodeToClipboard(activeTeam.code)}
                  className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl flex items-center space-x-1.5 transition cursor-pointer shadow-md"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedCode ? 'Zkopírováno!' : 'Zkopírovat'}</span>
                </button>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Seznam všech registrovaných hráčů ({allUsers.length}):
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {allUsers.map((u) => {
                    const isMember = activeTeam.memberEmails?.includes(u.email);
                    const memberNickname = activeTeam.nicknames?.[u.email];
                    return (
                      <div
                        key={u.id}
                        className={`p-3 rounded-xl flex items-center justify-between transition ${
                          isMember ? 'bg-slate-850' : 'bg-slate-950/70 opacity-75'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <div className="text-xs font-bold text-white flex items-center gap-1.5 flex-wrap">
                            <span>{u.name}</span>
                            {memberNickname && (
                              <span className="bg-emerald-950/90 text-emerald-300 text-[10px] px-1.5 py-0.2 rounded font-bold">
                                Přezdívka: „{memberNickname}“
                              </span>
                            )}
                            {u.role === 'admin' && (
                              <span className="bg-purple-900/80 text-purple-200 text-[10px] px-1.5 py-0.2 rounded font-bold">
                                Správce
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">{u.email}</div>
                          {u.requirePasswordReset && (
                            <div className="text-[10px] text-amber-400 font-bold">
                              Vyžadován reset hesla
                            </div>
                          )}
                        </div>

                        <div className="flex items-center space-x-1.5">
                          {/* Admin Password Reset Button */}
                          {currentUser.role === 'admin' && (
                            <button
                              type="button"
                              onClick={() => handleAdminResetPassword(u)}
                              disabled={loading}
                              title="Resetovat heslo uživatele"
                              className="p-2 rounded-xl text-amber-400 bg-slate-800 hover:bg-amber-950/80 transition text-xs font-bold flex items-center cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Member Toggle Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleMember(u.email, isMember)}
                            disabled={loading}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center space-x-1 transition cursor-pointer ${
                              isMember
                                ? 'bg-rose-950/80 text-rose-300 hover:bg-rose-900'
                                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                            }`}
                          >
                            {isMember ? (
                              <>
                                <UserMinus className="w-3.5 h-3.5" />
                                <span>Odebrat</span>
                              </>
                            ) : (
                              <>
                                <UserPlus className="w-3.5 h-3.5 stroke-[3]" />
                                <span>Přiřadit</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

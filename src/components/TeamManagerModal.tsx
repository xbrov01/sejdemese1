import React, { useState } from 'react';
import { UserProfile, Team } from '../types';
import { db, collection, addDoc, doc, updateDoc, arrayUnion, arrayRemove, getDocs, query, where } from '../lib/firebase';
import {
  Users,
  Plus,
  Key,
  X,
  Check,
  Shield,
  ShieldCheck,
  Crown,
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
  Pencil,
} from 'lucide-react';
import { COLOR_PRESETS, IMAGE_PRESETS, compressImageFile, hexToRgba, getContrastingTextColor, getSolidLighterShade } from '../utils/themePresets';
import { isUserTeamAdmin, SYSTEM_SUPERUSER_EMAIL } from '../utils/superUserUtils';

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
  const [editTeamCode, setEditTeamCode] = useState(activeTeam?.code || '');
  const [cardBgColor, setCardBgColor] = useState(activeTeam?.cardBgColor || '#059669');
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
      setEditTeamCode(activeTeam.code || '');
      setCardBgColor(activeTeam.cardBgColor || '#059669');
      setCardBgImage(activeTeam.cardBgImage || '');
    } else if (mode === 'create') {
      setTeamName('');
      setEditTeamCode('');
      setCardBgColor('#059669');
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

    const cleanCode = editTeamCode.trim().toUpperCase().replace(/\s+/g, '-');
    if (!cleanCode) {
      setError('Kód týmu nesmí být prázdný.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Pokud se kód změnil, ověříme jeho unikátnost
      if (cleanCode !== activeTeam.code) {
        const teamsRef = collection(db, 'teams');
        const q = query(teamsRef, where('code', '==', cleanCode));
        const snap = await getDocs(q);
        const codeInUse = snap.docs.some((d) => d.id !== activeTeam.id);
        if (codeInUse) {
          setError(`Kód týmu „${cleanCode}“ již používá jiný tým. Zvolte prosím jiný kód.`);
          setLoading(false);
          return;
        }
      }

      const teamRef = doc(db, 'teams', activeTeam.id);
      const updateData: Partial<Team> = {
        name: teamName.trim(),
        code: cleanCode,
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

      setSuccessMsg('Nastavení, kód a vzhled týmu byly úspěšně uloženy!');
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

  const isCurrentTeamAdmin = isUserTeamAdmin(currentUser, activeTeam);

  // Správa členů
  const handleToggleMember = async (userEmail: string, isCurrentlyMember: boolean) => {
    if (!activeTeam) return;
    setLoading(true);

    try {
      const teamRef = doc(db, 'teams', activeTeam.id);
      if (isCurrentlyMember) {
        await updateDoc(teamRef, {
          memberEmails: arrayRemove(userEmail),
          adminEmails: arrayRemove(userEmail),
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

  // Udělení / odebrání práv správce týmu
  const handleToggleAdminPrivileges = async (targetUser: UserProfile, assignAdmin: boolean) => {
    if (!activeTeam) return;

    if (!assignAdmin && targetUser.email.toLowerCase() === activeTeam.createdBy.toLowerCase()) {
      setError('Nelze odebrat práva správce zakladateli týmu.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const teamRef = doc(db, 'teams', activeTeam.id);
      const userRef = doc(db, 'users', targetUser.email);

      if (assignAdmin) {
        // 1. Zaznamenat do adminEmails v týmu bez duplicit
        const currentAdmins = activeTeam.adminEmails || [];
        const isAlreadyAdmin = currentAdmins.some((e) => e.toLowerCase() === targetUser.email.toLowerCase());
        const newAdminEmails = isAlreadyAdmin ? currentAdmins : [...currentAdmins, targetUser.email];

        await updateDoc(teamRef, {
          adminEmails: newAdminEmails,
          memberEmails: arrayUnion(targetUser.email),
        });

        // 2. Nastavit roli 'admin' v profilu uživatele
        await updateDoc(userRef, {
          role: 'admin',
        });

        setSuccessMsg(`Hráč „${targetUser.name}“ byl úspěšně jmenován správcem týmu!`);
      } else {
        // 1. Spolehlivě odebrat z adminEmails v týmu (case-insensitive)
        const filteredAdminEmails = (activeTeam.adminEmails || []).filter(
          (e) => e.toLowerCase() !== targetUser.email.toLowerCase()
        );

        await updateDoc(teamRef, {
          adminEmails: filteredAdminEmails,
        });

        // 2. Nastavit roli 'member' v profilu uživatele
        await updateDoc(userRef, {
          role: 'member',
        });

        setSuccessMsg(`Hráči „${targetUser.name}“ byla odebrána práva správce týmu.`);
      }

      setTimeout(() => setSuccessMsg(null), 3000);
      if (onTeamUpdated) {
        onTeamUpdated();
      }
    } catch (err: any) {
      console.error('Chyba při změně práv správce:', err);
      setError('Nepodařilo se změnit práva správce týmu.');
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden text-slate-900 border border-slate-200 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-white px-5 py-4 text-slate-900 flex items-center justify-between border-b border-slate-150">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <h3 className="font-black text-base sm:text-lg text-slate-950">
              {mode === 'create' && 'Vytvořit nový tým'}
              {mode === 'join' && 'Připojit se k týmu'}
              {mode === 'members' && `Správa členů — ${activeTeam?.name}`}
              {mode === 'settings' && `Vzhled & Nastavení týmu — ${activeTeam?.name}`}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-xl transition cursor-pointer border border-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex flex-wrap bg-slate-100 p-1.5 gap-1.5 border-b border-slate-200">
          <button
            onClick={() => { setMode('join'); setError(null); setSuccessMsg(null); }}
            className={`flex-1 min-w-[100px] py-1.5 px-2 text-xs font-bold rounded-xl transition flex items-center justify-center space-x-1 cursor-pointer ${
              mode === 'join'
                ? 'bg-white text-slate-950 font-black shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Kód týmu</span>
          </button>

          <button
            onClick={() => { setMode('create'); setError(null); setSuccessMsg(null); }}
            className={`flex-1 min-w-[100px] py-1.5 px-2 text-xs font-bold rounded-xl transition flex items-center justify-center space-x-1 cursor-pointer ${
              mode === 'create'
                ? 'bg-white text-slate-950 font-black shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Plus className="w-3.5 h-3.5 text-emerald-600" />
            <span>Nový tým</span>
          </button>

          {isCurrentTeamAdmin && activeTeam && (
            <button
              onClick={() => { setMode('settings'); setError(null); setSuccessMsg(null); }}
              className={`flex-1 min-w-[100px] py-1.5 px-2 text-xs font-bold rounded-xl transition flex items-center justify-center space-x-1 cursor-pointer ${
                mode === 'settings'
                  ? 'bg-white text-purple-900 font-black shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Palette className="w-3.5 h-3.5 text-purple-600" />
              <span>Vzhled & Styl</span>
            </button>
          )}

          {isCurrentTeamAdmin && activeTeam && (
            <button
              onClick={() => { setMode('members'); setError(null); setSuccessMsg(null); }}
              className={`flex-1 min-w-[100px] py-1.5 px-2 text-xs font-bold rounded-xl transition flex items-center justify-center space-x-1 cursor-pointer ${
                mode === 'members'
                  ? 'bg-white text-slate-950 font-black shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-emerald-600" />
              <span>Členové</span>
            </button>
          )}
        </div>

        {/* Body Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 bg-white">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center font-medium">
              <Check className="w-4 h-4 text-emerald-600 mr-2 shrink-0" />
              {successMsg}
            </div>
          )}

          {/* ADMIN RESET PASSWORD RESULT DIALOG */}
          {resetResult && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                <div className="flex items-center space-x-2 text-amber-900 font-bold text-sm">
                  <KeyRound className="w-4 h-4 text-amber-600" />
                  <span>Vygenerováno dočasné heslo</span>
                </div>
                <button
                  onClick={() => setResetResult(null)}
                  className="text-amber-800 hover:text-amber-950 text-xs font-bold cursor-pointer"
                >
                  Zavřít
                </button>
              </div>

              <div className="text-xs text-amber-900">
                Nové dočasné heslo pro uživatele <strong>{resetResult.userName}</strong> ({resetResult.email}):
              </div>

              <div className="bg-white border border-amber-300 p-3 rounded-xl flex items-center justify-between">
                <span className="font-mono text-lg font-bold text-emerald-700 tracking-wider">
                  {resetResult.tempPassword}
                </span>
                <button
                  type="button"
                  onClick={() => copyTempPassToClipboard(resetResult.tempPassword)}
                  className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black rounded-lg flex items-center space-x-1 transition cursor-pointer shadow-2xs"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedTempPass ? 'Zkopírováno!' : 'Zkopírovat'}</span>
                </button>
              </div>

              <p className="text-[11px] text-amber-800">
                Předejte toto heslo uživateli. Při jeho příštím přihlášení ho aplikace vyzve ke změně hesla.
              </p>
            </div>
          )}

          {/* MODE: CREATE TEAM OR EDIT APPEARANCE / SETTINGS */}
          {(mode === 'create' || mode === 'settings') && (
            <form onSubmit={mode === 'create' ? handleCreateTeam : handleSaveTeamSettings} className="space-y-5">
              
              {/* Název týmu */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Název sportovního týmu
                </label>
                <input
                  type="text"
                  required
                  placeholder="např. Středeční Futsal, HC Vlci, Volejbal Bráník..."
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Kód týmu (lze upravit v nastavení týmu) */}
              {mode === 'settings' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Kód týmu (připojovací kód pro hráče)
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="např. FUTSAL-888"
                      value={editTeamCode}
                      onChange={(e) => setEditTeamCode(e.target.value.toUpperCase().replace(/\s+/g, '-'))}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono text-sm uppercase font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Pomocí tohoto kódu se noví hráči připojují k týmu. Můžete jej kdykoliv upravit.
                  </p>
                </div>
              )}

              {/* VÝCHOZÍ BARVA POZADÍ KARTY UDÁLOSTI */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Palette className="w-4 h-4 text-emerald-600" />
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Výchozí barva karty události
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-mono text-slate-500">{cardBgColor}</span>
                    <input
                      type="color"
                      value={cardBgColor}
                      onChange={(e) => setCardBgColor(e.target.value)}
                      className="w-7 h-7 rounded-lg cursor-pointer p-0.5 bg-white border border-slate-200"
                      title="Vlastní barva"
                    />
                  </div>
                </div>

                {/* Barevné předvolby */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {COLOR_PRESETS.map((preset) => {
                    const isSelected = cardBgColor.toLowerCase() === preset.value.toLowerCase();
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setCardBgColor(preset.value)}
                        className={`flex items-center space-x-2 px-2.5 py-2 rounded-xl text-left text-xs transition cursor-pointer border ${
                          isSelected
                            ? 'bg-emerald-50 text-slate-950 font-black border-emerald-500 shadow-2xs'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full shrink-0 shadow-2xs border border-black/10"
                          style={{ backgroundColor: preset.value }}
                        />
                        <span className="truncate text-[11px] font-semibold">{preset.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* OBRÁZEK POZADÍ KARTY UDÁLOSTI (NEPOVINNÝ) */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ImageIcon className="w-4 h-4 text-emerald-600" />
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Obrázek pozadí karty události <span className="text-slate-500 font-normal">(nepovinné)</span>
                    </label>
                  </div>
                  {cardBgImage && (
                    <button
                      type="button"
                      onClick={() => setCardBgImage('')}
                      className="text-xs text-rose-700 hover:text-rose-800 font-bold flex items-center space-x-1 cursor-pointer bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Odebrat obrázek</span>
                    </button>
                  )}
                </div>

                {/* Předvolené sportovní motivy */}
                <div>
                  <div className="text-[11px] text-slate-500 font-medium mb-2">
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
                          className={`relative group rounded-xl overflow-hidden text-left transition cursor-pointer h-16 border ${
                            isSelected
                              ? 'border-emerald-500 ring-2 ring-emerald-400 shadow-md scale-[1.02]'
                              : 'border-slate-200 opacity-85 hover:opacity-100'
                          }`}
                        >
                          <img
                            src={imgPreset.thumbnail}
                            alt={imgPreset.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent flex items-end p-1.5">
                            <span className="text-[10px] font-bold text-white leading-tight truncate">
                              {imgPreset.name}
                            </span>
                          </div>
                          {isSelected && (
                            <div className="absolute top-1 right-1 bg-emerald-500 text-slate-950 rounded-full p-0.5 shadow-xs font-black">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Vlastní obrázek: Nahrání souboru nebo URL */}
                <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row items-center gap-2">
                  <label className="w-full sm:w-auto flex-1 flex items-center justify-center px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer shadow-2xs transition">
                    <Upload className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
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
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCustomUrl}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shrink-0 cursor-pointer shadow-2xs"
                    >
                      Použít
                    </button>
                  </div>
                </div>
              </div>

              {/* ŽIVÝ NÁHLED KARTY (LIVE PREVIEW) ve světlém Clean Athletic stylu */}
              <div>
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Náhled karty události pro tento tým</span>
                </div>
                
                <div className="rounded-2xl overflow-hidden shadow-xs border border-slate-200/90 bg-white">
                  <div
                    className="p-4 bg-white text-slate-900 relative transition-all duration-300 border-l-4"
                    style={{
                      borderLeftColor: cardBgColor || '#059669',
                      backgroundImage: cardBgImage
                        ? `linear-gradient(to right, rgba(255, 255, 255, 0.78) 0%, rgba(255, 255, 255, 0.52) 100%), url(${cardBgImage})`
                        : undefined,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold border shadow-2xs"
                        style={{
                          backgroundColor: getSolidLighterShade(cardBgColor || '#059669', 0.14),
                          borderColor: getSolidLighterShade(cardBgColor || '#059669', 0.32),
                          color: getContrastingTextColor(cardBgColor || '#059669'),
                        }}
                      >
                        <Calendar className="w-3.5 h-3.5" style={{ color: cardBgColor || '#059669' }} />
                        <span>Čtvrtek 20. 08. 2026</span>
                        <span>•</span>
                        <Clock className="w-3.5 h-3.5" style={{ color: cardBgColor || '#059669' }} />
                        <span>18:30</span>
                      </div>
                      <span className="bg-white text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold shadow-2xs">
                        #{activeTeam?.code || 'FUTSAL-101'} {teamName || 'Název týmu'}
                      </span>
                    </div>

                    <h4 className="text-base font-black text-slate-950 mt-1 drop-shadow-2xs">
                      Mistrovský zápas / Trénink
                    </h4>

                    <div className="flex items-center space-x-1.5 text-xs text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs inline-flex mt-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      <span>Sportovní hala / Hřiště 1</span>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-150 flex items-center gap-2 text-xs">
                      <span className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black text-center shadow-xs">
                        JDU
                      </span>
                      <span className="flex-1 py-2 bg-white text-amber-900 border border-amber-300 rounded-xl text-xs font-bold text-center shadow-2xs">
                        MOŽNÁ
                      </span>
                      <span className="flex-1 py-2 bg-white text-rose-900 border border-rose-300 rounded-xl text-xs font-bold text-center shadow-2xs">
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
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black rounded-xl shadow-md text-sm transition flex items-center justify-center space-x-2 cursor-pointer"
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
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Kód týmu (obdržený od správce)
                </label>
                <input
                  type="text"
                  required
                  placeholder="např. FUTSAL-839"
                  value={teamCodeInput}
                  onChange={(e) => setTeamCodeInput(e.target.value)}
                  className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl uppercase font-mono tracking-widest text-center text-lg font-bold text-emerald-700 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black rounded-xl shadow-md text-sm transition flex items-center justify-center space-x-2 cursor-pointer"
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
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                    Unikátní kód týmu pro sdílení:
                  </div>
                  <div className="font-mono text-base font-black text-slate-900 tracking-wider">
                    #{activeTeam.code}
                  </div>
                </div>
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => copyCodeToClipboard(activeTeam.code)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition cursor-pointer shadow-2xs"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedCode ? 'Zkopírováno!' : 'Zkopírovat'}</span>
                  </button>
                  {isCurrentTeamAdmin && (
                    <button
                      type="button"
                      onClick={() => { setMode('settings'); setError(null); setSuccessMsg(null); }}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center space-x-1.5 transition cursor-pointer border border-slate-200 shadow-2xs"
                      title="Změnit kód týmu"
                    >
                      <Pencil className="w-3.5 h-3.5 text-slate-600" />
                      <span>Změnit kód</span>
                    </button>
                  )}
                </div>
              </div>

              <div>
                {(() => {
                  const visibleUsers = allUsers.filter(
                    (u) =>
                      !u.isSystemAccount &&
                      u.email?.toLowerCase() !== SYSTEM_SUPERUSER_EMAIL.toLowerCase()
                  );

                  return (
                    <>
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        Seznam všech registrovaných hráčů ({visibleUsers.length}):
                      </h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {visibleUsers.map((u) => {
                          const isMember = activeTeam.memberEmails?.includes(u.email);
                          const memberNickname = activeTeam.nicknames?.[u.email];
                          const isCreator = activeTeam.createdBy?.toLowerCase() === u.email?.toLowerCase();
                          const isUserAdmin = Boolean(
                            isCreator ||
                            activeTeam.adminEmails?.some((e) => e.toLowerCase() === u.email?.toLowerCase())
                          );

                    return (
                      <div
                        key={u.id}
                        className={`p-3 rounded-xl flex items-center justify-between transition border ${
                          isMember ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-100 opacity-70'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                            <span>{u.name}</span>
                            {memberNickname && (
                              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] px-1.5 py-0.2 rounded font-bold">
                                Přezdívka: „{memberNickname}“
                              </span>
                            )}
                            {isCreator ? (
                              <span className="bg-purple-100 text-purple-900 border border-purple-200 text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                                <Crown className="w-3 h-3 text-purple-700" />
                                <span>Zakladatel</span>
                              </span>
                            ) : isUserAdmin ? (
                              <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                                <Shield className="w-3 h-3 text-purple-600" />
                                <span>Správce</span>
                              </span>
                            ) : null}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">{u.email}</div>
                          {u.requirePasswordReset && (
                            <div className="text-[10px] text-amber-700 font-bold">
                              Vyžadován reset hesla
                            </div>
                          )}
                        </div>

                        <div className="flex items-center space-x-1.5">
                          {/* Tlačítko přidělení / odebrání práv správce (viditelné pro správce týmu u členů) */}
                          {isMember && isCurrentTeamAdmin && (
                            <>
                              {isUserAdmin && !isCreator ? (
                                <button
                                  type="button"
                                  onClick={() => handleToggleAdminPrivileges(u, false)}
                                  disabled={loading}
                                  title={`Odebrat práva správce týmu uživateli ${u.name}`}
                                  className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-purple-50 hover:bg-rose-50 text-purple-800 hover:text-rose-700 border border-purple-200 hover:border-rose-200 transition flex items-center space-x-1 cursor-pointer shadow-2xs group"
                                >
                                  <Shield className="w-3.5 h-3.5 text-purple-600 group-hover:text-rose-600" />
                                  <span className="hidden sm:inline">Odebrat správce</span>
                                  <span className="sm:hidden">-Admin</span>
                                </button>
                              ) : !isCreator ? (
                                <button
                                  type="button"
                                  onClick={() => handleToggleAdminPrivileges(u, true)}
                                  disabled={loading}
                                  title={`Udělit práva správce týmu uživateli ${u.name}`}
                                  className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-800 border border-slate-200 hover:border-purple-200 transition flex items-center space-x-1 cursor-pointer shadow-2xs group"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-600" />
                                  <span className="hidden sm:inline">Udělit správce</span>
                                  <span className="sm:hidden">+Admin</span>
                                </button>
                              ) : null}
                            </>
                          )}

                          {/* Admin Password Reset Button */}
                          {currentUser.role === 'admin' && (
                            <button
                              type="button"
                              onClick={() => handleAdminResetPassword(u)}
                              disabled={loading}
                              title="Resetovat heslo uživatele"
                              className="p-2 rounded-xl text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition text-xs font-bold flex items-center cursor-pointer shadow-2xs"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Member Toggle Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleMember(u.email, isMember)}
                            disabled={loading}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center space-x-1 transition cursor-pointer shadow-2xs ${
                              isMember
                                ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
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
              </>
            );
          })()}
        </div>
      </div>
    )}
        </div>
      </div>
    </div>
  );
};

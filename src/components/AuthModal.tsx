import React, { useState } from 'react';
import { UserProfile } from '../types';
import { db, doc, setDoc, getDoc, auth, googleProvider, signInWithPopup } from '../lib/firebase';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { UserCheck, Shield, User, Mail, ArrowRight, Lock, UserPlus, LogIn } from 'lucide-react';
import { SYSTEM_SUPERUSER_EMAIL, SYSTEM_SUPERUSER_DEFAULT_PASSWORDS, OWNER_SUPERUSER_EMAIL } from '../utils/superUserUtils';

interface AuthModalProps {
  onLoginSuccess: (user: UserProfile) => void;
  existingUsers: UserProfile[];
}

export const AuthModal: React.FC<AuthModalProps> = ({ onLoginSuccess }) => {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Přihlášení / Registrace přes Google účet
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      let googleEmail: string | null = null;
      let googleDisplayName: string | null = null;
      let googlePhotoUrl: string | null = null;

      if (Capacitor.isNativePlatform()) {
        // V nativní mobilní aplikaci (Android / iOS) použijeme oficiální nativní Firebase plugin
        // Tím se zabrání prázdné bílé obrazovce (WebView nepodporuje webové OAuth popupy)
        const res = await FirebaseAuthentication.signInWithGoogle();
        googleEmail = res.user?.email || null;
        googleDisplayName = res.user?.displayName || null;
        googlePhotoUrl = res.user?.photoUrl || null;
      } else {
        // Ve webovém prohlížeči použijeme Firebase Web SDK popup
        const result = await signInWithPopup(auth, googleProvider);
        googleEmail = result.user?.email || null;
        googleDisplayName = result.user?.displayName || null;
        googlePhotoUrl = result.user?.photoURL || null;
      }

      if (!googleEmail) {
        throw new Error('Z Google účtu se nepodařilo získat e-mailovou adresu.');
      }

      const cleanEmail = googleEmail.trim().toLowerCase();
      const displayName = googleDisplayName || cleanEmail.split('@')[0];
      const isOwner = cleanEmail === OWNER_SUPERUSER_EMAIL.toLowerCase();

      const userRef = doc(db, 'users', cleanEmail);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        const newUser: UserProfile = {
          id: cleanEmail,
          name: displayName,
          email: cleanEmail,
          role: isOwner ? 'admin' : 'member',
          isSuperAdmin: isOwner ? true : undefined,
          createdAt: new Date().toISOString(),
          avatarUrl: googlePhotoUrl || undefined,
          authProvider: 'google',
        };
        await setDoc(userRef, newUser);
        onLoginSuccess(newUser);
      } else {
        const existingData = userSnap.data() as UserProfile;
        if (isOwner) {
          existingData.role = 'admin';
          existingData.isSuperAdmin = true;
        }
        if (!existingData.avatarUrl && googlePhotoUrl) {
          existingData.avatarUrl = googlePhotoUrl;
        }
        existingData.authProvider = existingData.authProvider || 'google';
        await setDoc(userRef, existingData, { merge: true });
        onLoginSuccess(existingData);
      }
    } catch (err: any) {
      console.error('Chyba při přihlašování přes Google:', err);
      if (
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request' ||
        err?.message?.includes('canceled') ||
        err?.message?.includes('cancelled') ||
        err?.message?.includes('12501')
      ) {
        return;
      }
      if (err?.code === 'auth/popup-blocked') {
        setError('Vyskakovací okno pro přihlášení bylo zablokováno prohlížečem. Povolte prosím vyskakovací okna pro tuto stránku.');
        return;
      }
      if (err?.code === 'auth/unauthorized-domain') {
        setError('Tato doména není povolena v autorizovaných doménách Firebase Authentication projektu. Přidejte ji prosím ve Firebase Console.');
        return;
      }
      if (err?.code === 'auth/operation-not-allowed') {
        setError('Přihlašování přes Google není v tomto Firebase projektu zatím povoleno. Povolte prosím Google provider ve Firebase Console (Authentication > Sign-in method).');
        return;
      }
      if (err?.message?.includes('10') || err?.message?.includes('DEVELOPER_ERROR')) {
        setError('Google přihlášení v Android aplikaci vyžaduje přidání SHA-1 otisku klíče v nastavení Android aplikace ve Firebase Console.');
        return;
      }
      setError(err?.message || 'Při přihlašování přes Google nastala chyba.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Vyplňte prosím e-mailovou adresu.');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    setLoading(true);
    setError(null);

    try {
      const userRef = doc(db, 'users', cleanEmail);
      const userSnap = await getDoc(userRef);

      // Speciální podpora pro předdefinovaný systémový superadmin účet
      if (cleanEmail === SYSTEM_SUPERUSER_EMAIL.toLowerCase()) {
        const isDefaultMatch = SYSTEM_SUPERUSER_DEFAULT_PASSWORDS.includes(passwordInput.trim());
        if (!userSnap.exists()) {
          if (!isDefaultMatch) {
            setError('Zadané heslo pro systémový účet není správné.');
            setLoading(false);
            return;
          }
          const superUserData: UserProfile = {
            id: cleanEmail,
            name: 'Systémový správce',
            email: cleanEmail,
            role: 'admin',
            isSuperAdmin: true,
            isSystemAccount: true,
            password: passwordInput.trim() || 'admin',
            createdAt: new Date().toISOString(),
          };
          await setDoc(userRef, superUserData);
          onLoginSuccess(superUserData);
          return;
        } else {
          const data = userSnap.data() as UserProfile;
          const validPass = data.password || data.tempPassword || 'admin';
          if (passwordInput.trim() !== validPass && !isDefaultMatch) {
            setError('Zadané heslo pro systémový účet není správné.');
            setLoading(false);
            return;
          }
          const updatedSuperUser: UserProfile = {
            ...data,
            role: 'admin',
            isSuperAdmin: true,
            isSystemAccount: true,
          };
          onLoginSuccess(updatedSuperUser);
          return;
        }
      }

      if (!userSnap.exists()) {
        setError('Účet s tímto e-mailem nebyl nalezen. Zaregistrujte se prosím v záložce Registrace.');
        setLoading(false);
        return;
      }

      const existingData = userSnap.data() as UserProfile;

      // Ověření hesla, pokud ho uživatel má nastavené
      if (existingData.password || existingData.tempPassword) {
        const requiredPass = existingData.password || existingData.tempPassword;
        if (!passwordInput.trim()) {
          setError('Tento účet je chráněn heslem. Zadejte prosím své heslo.');
          setLoading(false);
          return;
        }
        if (passwordInput.trim() !== existingData.password && passwordInput.trim() !== existingData.tempPassword) {
          setError('Zadané heslo není správné.');
          setLoading(false);
          return;
        }
      }

      if (cleanEmail === OWNER_SUPERUSER_EMAIL.toLowerCase()) {
        existingData.role = 'admin';
        existingData.isSuperAdmin = true;
      }

      onLoginSuccess(existingData);
    } catch (err: any) {
      console.error('Chyba při přihlašování:', err);
      setError('Při přihlašování nastala chyba. Zkontrolujte připojení.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError('Vyplňte prosím jméno, příjmení i e-mail.');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    setLoading(true);
    setError(null);

    try {
      const userRef = doc(db, 'users', cleanEmail);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        setError('Uživatel s tímto e-mailem již existuje. Přihlaste se prosím v záložce Přihlášení.');
        setLoading(false);
        return;
      }

      // Nová registrace - každý uživatel se registruje jako hráč,
      // správcem se stává vytvořením týmu nebo jmenováním správcem v týmu
      const isOwner = cleanEmail === OWNER_SUPERUSER_EMAIL.toLowerCase();
      const newUser: UserProfile = {
        id: cleanEmail,
        name: name.trim(),
        email: cleanEmail,
        role: isOwner ? 'admin' : 'member',
        isSuperAdmin: isOwner ? true : undefined,
        createdAt: new Date().toISOString(),
        password: passwordInput.trim() || undefined,
      };

      await setDoc(userRef, newUser);
      onLoginSuccess(newUser);
    } catch (err: any) {
      console.error('Chyba při registraci:', err);
      setError('Při registraci nastala chyba. Zkontrolujte připojení.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-hidden overscroll-contain">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden text-slate-900 border border-slate-200 my-auto flex flex-col max-h-[92vh] sm:max-h-[88vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-white p-5 sm:p-6 text-center border-b border-slate-100 shrink-0">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm overflow-hidden bg-slate-50 border border-slate-150">
            <img
              src="/icon.svg"
              alt="Sejdeme se icon"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-950">Sejdeme se</h2>
          <p className="text-slate-500 text-xs mt-1">
            {authMode === 'login' ? 'Přihlášení do týmové docházky' : 'Registrace nového člena nebo správce'}
          </p>
        </div>

        {/* Navigation Tabs (Přihlášení / Registrace) */}
        <div className="flex bg-slate-100 p-1.5 gap-1.5 border-b border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => {
              setAuthMode('login');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer ${
              authMode === 'login'
                ? 'bg-white text-slate-950 font-black shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <LogIn className={`w-4 h-4 ${authMode === 'login' ? 'text-emerald-600' : 'text-slate-500'}`} />
            <span>Přihlášení</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('register');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer ${
              authMode === 'register'
                ? 'bg-white text-slate-950 font-black shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <UserPlus className={`w-4 h-4 ${authMode === 'register' ? 'text-emerald-600' : 'text-slate-500'}`} />
            <span>Registrace</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 bg-white overflow-y-auto overscroll-contain flex-1">
          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium">
              {error}
            </div>
          )}

          {/* Tlačítko přihlášení / registrace přes Google */}
          <div className="mb-5">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading || googleLoading}
              className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-300 text-slate-800 font-bold rounded-xl shadow-2xs text-xs sm:text-sm transition flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
            >
              {googleLoading ? (
                <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.97 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
              )}
              <span>{authMode === 'login' ? 'Pokračovat s Googlem' : 'Zaregistrovat se přes Google'}</span>
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider">
                <span className="bg-white px-2.5 text-slate-400">Nebo e-mailem</span>
              </div>
            </div>
          </div>

          {authMode === 'login' ? (
            /* FORMULÁŘ PRO PŘIHLÁŠENÍ */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  E-mailová adresa <span className="text-emerald-600">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="jan.novak@email.cz"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500 text-slate-900 text-sm transition outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Heslo
                </label>
                <div className="relative">
                  <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    placeholder="Zadejte své heslo (pokud máte nastavené)"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500 text-slate-900 text-sm transition outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-2 transition disabled:opacity-50 mt-2 cursor-pointer"
              >
                <span>{loading ? 'Přihlašování...' : 'Přihlásit se'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setError(null);
                  }}
                  className="text-xs text-slate-500 hover:text-emerald-700 transition cursor-pointer"
                >
                  Nemáte ještě účet? <strong className="underline text-emerald-700">Zaregistrujte se zde</strong>
                </button>
              </div>
            </form>
          ) : (
            /* FORMULÁŘ PRO REGISTRACI */
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  E-mailová adresa <span className="text-emerald-600">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="jan.novak@email.cz"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500 text-slate-900 text-sm transition outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Jméno a příjmení <span className="text-emerald-600">*</span>
                </label>
                <div className="relative">
                  <User className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="např. Jan Novák"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500 text-slate-900 text-sm transition outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Heslo (volitelné)
                </label>
                <div className="relative">
                  <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    placeholder="Zvolte heslo pro přihlášení..."
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500 text-slate-900 text-sm transition outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-50/80 border border-emerald-200/70 rounded-xl text-xs text-slate-600 leading-relaxed flex items-start space-x-2.5">
                <Shield className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Správa týmů:</strong> Každý hráč může po přihlášení vytvořit nový tým a stát se jeho správcem, případně mu může stávající správce týmu udělit administrátorská práva.
                </span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-2 transition disabled:opacity-50 mt-2 cursor-pointer"
              >
                <span>{loading ? 'Vytváření účtu...' : 'Vytvořit účet a vstoupit'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setError(null);
                  }}
                  className="text-xs text-slate-500 hover:text-emerald-700 transition cursor-pointer"
                >
                  Již máte účet? <strong className="underline text-emerald-700">Přihlaste se zde</strong>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

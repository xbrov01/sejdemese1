import React, { useState } from 'react';
import { UserProfile, UserRole } from '../types';
import { db, doc, setDoc, getDoc } from '../lib/firebase';
import { UserCheck, Shield, User, Mail, ArrowRight, Lock, UserPlus, LogIn } from 'lucide-react';

interface AuthModalProps {
  onLoginSuccess: (user: UserProfile) => void;
  existingUsers: UserProfile[];
}

export const AuthModal: React.FC<AuthModalProps> = ({ onLoginSuccess }) => {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [role, setRole] = useState<UserRole>('member');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      // Nová registrace
      const newUser: UserProfile = {
        id: cleanEmail,
        name: name.trim(),
        email: cleanEmail,
        role,
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
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden text-slate-100">
        {/* Header */}
        <div className="bg-slate-950 p-6 text-white text-center border-b border-slate-800">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xl overflow-hidden bg-slate-900">
            <img
              src="/icon.svg"
              alt="Sejdeme se icon"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">Sejdeme se</h2>
          <p className="text-slate-400 text-xs mt-1">
            {authMode === 'login' ? 'Přihlášení do týmové docházky' : 'Registrace nového člena nebo správce'}
          </p>
        </div>

        {/* Navigation Tabs (Přihlášení / Registrace) */}
        <div className="flex bg-slate-950 p-1.5 gap-1.5 border-b border-slate-800">
          <button
            type="button"
            onClick={() => {
              setAuthMode('login');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer ${
              authMode === 'login'
                ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                : 'bg-slate-850 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <LogIn className="w-4 h-4" />
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
                ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                : 'bg-slate-850 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Registrace</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 bg-slate-900">
          {error && (
            <div className="mb-4 p-3 bg-rose-950/80 text-rose-300 text-xs rounded-xl font-medium">
              {error}
            </div>
          )}

          {authMode === 'login' ? (
            /* FORMULÁŘ PRO PŘIHLÁŠENÍ */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  E-mailová adresa <span className="text-emerald-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    required
                    placeholder="jan.novak@email.cz"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800 rounded-xl focus:ring-2 focus:ring-emerald-400 text-white text-sm transition outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Heslo
                </label>
                <div className="relative">
                  <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    placeholder="Zadejte své heslo (pokud máte nastavené)"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800 rounded-xl focus:ring-2 focus:ring-emerald-400 text-white text-sm transition outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-black rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2 transition disabled:opacity-50 mt-2 cursor-pointer"
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
                  className="text-xs text-slate-400 hover:text-emerald-400 transition cursor-pointer"
                >
                  Nemáte ještě účet? <strong className="underline text-emerald-400">Zaregistrujte se zde</strong>
                </button>
              </div>
            </form>
          ) : (
            /* FORMULÁŘ PRO REGISTRACI */
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  E-mailová adresa <span className="text-emerald-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    required
                    placeholder="jan.novak@email.cz"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800 rounded-xl focus:ring-2 focus:ring-emerald-400 text-white text-sm transition outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Jméno a příjmení <span className="text-emerald-400">*</span>
                </label>
                <div className="relative">
                  <User className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="např. Jan Novák"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800 rounded-xl focus:ring-2 focus:ring-emerald-400 text-white text-sm transition outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Heslo (volitelné)
                </label>
                <div className="relative">
                  <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    placeholder="Zvolte heslo pro přihlášení..."
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800 rounded-xl focus:ring-2 focus:ring-emerald-400 text-white text-sm transition outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Uživatelská role v aplikaci
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole('member')}
                    className={`p-3 rounded-xl text-left flex flex-col justify-between transition cursor-pointer ${
                      role === 'member'
                        ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                        : 'bg-slate-800 hover:bg-slate-750 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4" />
                      <span className="font-bold text-sm">Běžný hráč</span>
                    </div>
                    <span className={`text-xs mt-1 ${role === 'member' ? 'text-slate-950/80 font-medium' : 'text-slate-400'}`}>
                      Člen týmu & docházka
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('admin')}
                    className={`p-3 rounded-xl text-left flex flex-col justify-between transition cursor-pointer ${
                      role === 'admin'
                        ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                        : 'bg-slate-800 hover:bg-slate-750 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Shield className="w-4 h-4" />
                      <span className="font-bold text-sm">Správce</span>
                    </div>
                    <span className={`text-xs mt-1 ${role === 'admin' ? 'text-slate-950/80 font-medium' : 'text-slate-400'}`}>
                      Vytváření týmů & událostí
                    </span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-black rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2 transition disabled:opacity-50 mt-2 cursor-pointer"
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
                  className="text-xs text-slate-400 hover:text-emerald-400 transition cursor-pointer"
                >
                  Již máte účet? <strong className="underline text-emerald-400">Přihlaste se zde</strong>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

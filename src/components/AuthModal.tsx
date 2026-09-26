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
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-6 text-white text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-black/20 overflow-hidden bg-slate-900 border border-emerald-400/30">
            <img
              src="/icon.svg"
              alt="Sejdeme se icon"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Sejdeme se</h2>
          <p className="text-emerald-100 text-sm mt-1">
            {authMode === 'login' ? 'Přihlášení do týmové docházky' : 'Registrace nového člena nebo správce'}
          </p>
        </div>

        {/* Navigation Tabs (Přihlášení / Registrace) */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 p-1.5">
          <button
            type="button"
            onClick={() => {
              setAuthMode('login');
              setError(null);
            }}
            className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition ${
              authMode === 'login'
                ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/80'
                : 'text-slate-500 hover:text-slate-900'
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
            className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition ${
              authMode === 'register'
                ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/80'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Registrace</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
              {error}
            </div>
          )}

          {authMode === 'login' ? (
            /* FORMULÁŘ PRO PŘIHLÁŠENÍ */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  E-mailová adresa <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="jan.novak@email.cz"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 text-sm transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Heslo
                </label>
                <div className="relative">
                  <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    placeholder="Zadejte své heslo (pokud máte nastavené)"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 text-sm transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center space-x-2 transition disabled:opacity-50 mt-2"
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
                  className="text-xs text-slate-500 hover:text-emerald-700 transition"
                >
                  Nemáte ještě účet? <strong className="underline">Zaregistrujte se zde</strong>
                </button>
              </div>
            </form>
          ) : (
            /* FORMULÁŘ PRO REGISTRACI */
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  E-mailová adresa <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="jan.novak@email.cz"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 text-sm transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Jméno a příjmení <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="např. Jan Novák"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 text-sm transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Heslo (volitelné)
                </label>
                <div className="relative">
                  <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    placeholder="Zvolte heslo pro přihlášení..."
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 text-sm transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                  Uživatelská role v aplikaci
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole('member')}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition ${
                      role === 'member'
                        ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-emerald-600" />
                      <span className="font-semibold text-sm">Běžný hráč</span>
                    </div>
                    <span className="text-xs text-slate-500 mt-1">Člen týmu & docházka</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('admin')}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition ${
                      role === 'admin'
                        ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Shield className="w-4 h-4 text-emerald-600" />
                      <span className="font-semibold text-sm">Správce</span>
                    </div>
                    <span className="text-xs text-slate-500 mt-1">Vytváření týmů & událostí</span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center space-x-2 transition disabled:opacity-50 mt-2"
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
                  className="text-xs text-slate-500 hover:text-emerald-700 transition"
                >
                  Již máte účet? <strong className="underline">Přihlaste se zde</strong>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

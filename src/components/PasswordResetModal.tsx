import React, { useState } from 'react';
import { UserProfile } from '../types';
import { db, doc, updateDoc } from '../lib/firebase';
import { KeyRound, Lock, CheckCircle2, ShieldAlert, ArrowRight, Eye, EyeOff } from 'lucide-react';

interface PasswordResetModalProps {
  currentUser: UserProfile;
  onPasswordChanged: (updatedUser: UserProfile) => void;
}

export const PasswordResetModal: React.FC<PasswordResetModalProps> = ({
  currentUser,
  onPasswordChanged,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword.trim()) {
      setError('Zadejte prosím nové heslo.');
      return;
    }

    if (newPassword.length < 4) {
      setError('Heslo musí mít alespoň 4 znaky.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Zadaná hesla se neshodují.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const userRef = doc(db, 'users', currentUser.email);
      const updateData = {
        password: newPassword.trim(),
        requirePasswordReset: false,
        tempPassword: '',
      };

      await updateDoc(userRef, updateData);

      const updatedUser: UserProfile = {
        ...currentUser,
        ...updateData,
      };

      onPasswordChanged(updatedUser);
    } catch (err: any) {
      console.error('Chyba při změně hesla:', err);
      setError('Nepodařilo se uložit nové heslo. Zkontrolujte připojení.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-hidden overscroll-contain">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden text-slate-900 border border-slate-200 my-auto flex flex-col max-h-[92vh] sm:max-h-[88vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-white p-5 sm:p-6 text-center relative border-b border-slate-150 shrink-0">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 border border-amber-200 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <KeyRound className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-black tracking-tight text-slate-950">Vyžadována změna hesla</h2>
          <p className="text-slate-500 text-xs mt-1">
            Správce resetoval vaše heslo. Pro pokračování si zvolte své vlastní nové heslo.
          </p>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 bg-white overflow-y-auto overscroll-contain flex-1">
          {currentUser.tempPassword && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl flex items-start space-x-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Přihlášeni přes dočasné heslo:</strong> {currentUser.tempPassword}
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Nové heslo
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Zadejte své nové heslo..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Potvrzení nového hesla
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Zadejte nové heslo znova..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-2 transition disabled:opacity-50 text-sm mt-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 stroke-[3]" />
              <span>{loading ? 'Ukládání hesla...' : 'Uložit nové heslo a vstoupit'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

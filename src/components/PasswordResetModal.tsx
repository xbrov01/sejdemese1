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
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-100 overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-600 to-red-600 p-6 text-white text-center relative">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 backdrop-blur-md">
            <KeyRound className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Vyžadována změna hesla</h2>
          <p className="text-amber-100 text-xs mt-1">
            Správce resetoval vaše heslo. Pro pokračování si zvolte své vlastní nové heslo.
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          {currentUser.tempPassword && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-start space-x-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Přihlášeni přes dočasné heslo:</strong> {currentUser.tempPassword}
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
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
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
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
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-lg shadow-amber-600/20 flex items-center justify-center space-x-2 transition disabled:opacity-50 text-sm mt-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? 'Ukládání hesla...' : 'Uložit nové heslo a vstoupit'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

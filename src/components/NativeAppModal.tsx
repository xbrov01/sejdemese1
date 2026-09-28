import React, { useState } from 'react';
import {
  X,
  Smartphone,
  CheckCircle2,
  Bell,
  Layers,
  Copy,
  Check,
  Server,
  Apple,
  ExternalLink,
  ShieldCheck,
  Cpu,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import { isNative, currentPlatform } from '../lib/capacitor';
import { sendTestBrowserNotification } from '../utils/notificationService';
import { UserProfile } from '../types';

interface NativeAppModalProps {
  currentUser: UserProfile;
  onClose: () => void;
}

export const NativeAppModal: React.FC<NativeAppModalProps> = ({ currentUser, onClose }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'android' | 'ios' | 'fcm'>('overview');
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCommand(text);
    setTimeout(() => setCopiedCommand(null), 2500);
  };

  const handleTestNotification = async () => {
    setTestStatus('Odesílám notifikaci...');
    const ok = await sendTestBrowserNotification();
    if (ok) {
      setTestStatus('Systémová notifikace byla úspěšně odeslána!');
    } else {
      setTestStatus('Notifikaci se nepodařilo zobrazit (zkontrolujte oprávnění v systému/prohlížeči).');
    }
    setTimeout(() => setTestStatus(null), 4500);
  };

  const userTokens = currentUser.deviceTokens || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-inner shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                  Nativní mobilní aplikace
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Capacitor
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Nativní Android & iOS obálka se systémovými notifikacemi a cloudovou databází
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Platform Status Banner */}
        <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between gap-3 text-xs text-slate-300 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span>Aktuální prostředí:</span>
            <strong className="text-white capitalize">
              {isNative ? `Nativní ${currentPlatform}` : 'Webový prohlížeč (PWA / Live Dev)'}
            </strong>
          </div>
          <button
            type="button"
            onClick={handleTestNotification}
            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold rounded-lg text-[11px] transition shadow-xs flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Bell className="w-3 h-3" />
            <span>Test notifikace</span>
          </button>
        </div>

        {testStatus && (
          <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs flex items-center justify-between animate-in fade-in shrink-0">
            <span className="flex items-center gap-1.5 font-medium">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              {testStatus}
            </span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-3 pt-2 gap-1 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'overview'
                ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Přehled & Architektura</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('android')}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'android'
                ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
            <span>Android (APK & Studio)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ios')}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'ios'
                ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Apple className="w-3.5 h-3.5 text-slate-800" />
            <span>iPhone (iOS & Xcode)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('fcm')}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'fcm'
                ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Bell className="w-3.5 h-3.5 text-amber-500" />
            <span>Push Notifikace & FCM</span>
          </button>
        </div>

        {/* Tab Content (Scrollable) */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-slate-700 text-xs sm:text-sm leading-relaxed">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold mb-2">
                    <Bell className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-xs sm:text-sm">Nativní notifikace</h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    Integrace s FCM a systémovou lištou Androidu i iOS. Upozornění na docházku, zápasy a chat.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold mb-2">
                    <Server className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-xs sm:text-sm">Centrální databáze</h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    Serverová multi-uživatelská databáze Google Cloud Firestore s živou obousměrnou synchronizací.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold mb-2">
                    <Apple className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-xs sm:text-sm">Multiplatformní</h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    Jeden kód pro web, Android i iOS. Kdykoliv lze vygenerovat verzi pro iPhone bez přepisování.
                  </p>
                </div>
              </div>

              {/* Status Box */}
              <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80">
                <h4 className="font-bold text-emerald-950 flex items-center gap-1.5 text-xs sm:text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Nativní Android projekt je v repozitáři připraven</span>
                </h4>
                <p className="text-xs text-emerald-900/80 mt-1">
                  V kořenovém adresáři aplikace je vytvořena kompletní složka <code className="bg-emerald-100/80 px-1 py-0.5 rounded font-mono font-bold text-emerald-950">android/</code> s Gradle projektem a nastavením Capacitor 8. Můžete ji ihned otevřít v Android Studio.
                </p>
              </div>

              {/* Device Tokens registered */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs">Registrovaná zařízení pro notifikace:</span>
                  <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-mono">
                    {userTokens.length} zařízení
                  </span>
                </div>
                {userTokens.length === 0 ? (
                  <p className="text-[11px] text-slate-500">
                    Zatím žádné registrované nativní zařízení. Jakmile se přihlásíte z mobilní aplikace, token se zde automaticky uloží.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {userTokens.map((t, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 text-[11px]">
                        <span className="font-medium capitalize text-slate-800">
                          📱 {t.platform}
                        </span>
                        <span className="font-mono text-slate-400 text-[10px] truncate max-w-[200px]">
                          {t.token.slice(0, 16)}...
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ANDROID */}
          {activeTab === 'android' && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-emerald-600" />
                  <span>Jak sestavit APK / aplikaci pro Android</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Projekt obsahuje plně nakonfigurované Gradle prostředí v adresáři <code>android/</code>.
                </p>
              </div>

              {/* Step 1 */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                    Sestavení webových assetů a synchronizace
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy('npm run cap:build')}
                    className="text-[11px] text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    {copiedCommand === 'npm run cap:build' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>Kopírovat</span>
                  </button>
                </div>
                <div className="bg-slate-900 text-emerald-400 p-2.5 rounded-lg font-mono text-xs flex items-center justify-between">
                  <span>npm run cap:build</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Zkompiluje optimalizovaný kód aplikace a zkopíruje jej do nativní složky Androidu.
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">2</span>
                    Otevření projektu v Android Studio
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy('npm run cap:android')}
                    className="text-[11px] text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    {copiedCommand === 'npm run cap:android' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>Kopírovat</span>
                  </button>
                </div>
                <div className="bg-slate-900 text-emerald-400 p-2.5 rounded-lg font-mono text-xs flex items-center justify-between">
                  <span>npm run cap:android</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Otevře nativní Android Studio s projektem <code className="font-bold">cz.sejdemese.app</code>.
                </p>
              </div>

              {/* Step 3 */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="font-bold text-slate-900 text-xs flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                  Vytvoření instalačního souboru APK v Android Studio
                </span>
                <ul className="list-disc pl-5 text-[11px] text-slate-600 space-y-1">
                  <li>V horním menu Android Studio klikněte na <strong>Build &gt; Build Bundle(s) / APK(s) &gt; Build APK(s)</strong>.</li>
                  <li>Po dokončení se v pravém dolním rohu zobrazí odkaz <em>locate</em> na hotový soubor <code>app-debug.apk</code>, který můžete okamžitě poslat do telefonu a nainstalovat.</li>
                  <li>Pro nahrání do obchodu Google Play zvolte <strong>Build &gt; Generate Signed Bundle / APK</strong>.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 3: iOS */}
          {activeTab === 'ios' && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Apple className="w-4 h-4 text-slate-800" />
                  <span>Sestavení a běh aplikace pro iPhone (iOS & Xcode)</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Nativní projekt pro iOS je již vygenerován a synchronizován v adresáři <code>ios/</code>.
                </p>
              </div>

              {/* Step iOS 1 */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                    Sestavení a synchronizace změn do iOS projektu
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy('npm run cap:build')}
                    className="text-[11px] text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    {copiedCommand === 'npm run cap:build' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>Kopírovat</span>
                  </button>
                </div>
                <div className="bg-slate-900 text-emerald-400 p-2.5 rounded-lg font-mono text-xs flex items-center justify-between">
                  <span>npm run cap:build</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Zkompiluje webové assety do <code>dist/</code> a synchronizuje je do <code>ios/App/App/public</code>.
                </p>
              </div>

              {/* Step iOS 2 */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-bold">2</span>
                    Otevření v Xcode
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy('npm run cap:ios')}
                    className="text-[11px] text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    {copiedCommand === 'npm run cap:ios' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>Kopírovat</span>
                  </button>
                </div>
                <div className="bg-slate-900 text-emerald-400 p-2.5 rounded-lg font-mono text-xs flex items-center justify-between">
                  <span>npm run cap:ios</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Otevře <code>ios/App/App.xcworkspace</code> v Apple Xcode pro spuštění na simulátoru, fyzickém iPhone nebo odeslání do TestFlight / App Store.
                </p>
              </div>

              {/* Step iOS 3 */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="font-bold text-slate-900 text-xs flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                  Spuštění na simulátoru nebo iPhonu
                </span>
                <p className="text-[11px] text-slate-600">
                  V Xcode zvolte cílové zařízení a stiskněte <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-slate-800 font-mono text-[10px]">Cmd + R</kbd>. Pro distribuci zvolte <strong className="text-slate-800">Product &gt; Archive</strong>.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: FCM & NOTIFICATIONS */}
          {activeTab === 'fcm' && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-amber-500" />
                  <span>Firebase Cloud Messaging (FCM) & Push notifikace</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Jak je zajištěno doručování zpráv mezi uživateli v reálném čase.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <h5 className="font-bold text-slate-900 text-xs">Jak funguje multi-user doručování:</h5>
                <ol className="list-decimal pl-5 text-[11px] text-slate-600 space-y-1.5">
                  <li>
                    <strong>Uložení tokenu:</strong> Při spuštění nativní aplikace si telefon vyžádá FCM push token a automaticky jej uloží do profilu uživatele ve Firestore.
                  </li>
                  <li>
                    <strong>Oznámení událostí a chatu:</strong> Když kdokoliv v týmu napíše zprávu, vytvoří akci nebo změní účast, databáze v reálném čase předá notifikaci všem dotčeným zařízením.
                  </li>
                  <li>
                    <strong>Systémový šuplík:</strong> Aplikace má implementován notifikační kanál <code className="bg-slate-200 px-1 py-0.5 rounded font-mono font-bold">sejdemese_notifications</code> s vysokou prioritou a zvukem.
                  </li>
                </ol>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1.5">
                <h5 className="font-bold text-amber-900 text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  <span>Pro produkční Google Play vydání</span>
                </h5>
                <p className="text-[11px] text-amber-800 leading-snug">
                  Ve Firebase Console přidejte k projektu aplikaci pro Android s ID balíčku <code className="font-bold font-mono">cz.sejdemese.app</code> a stáhněte soubor <code className="font-bold font-mono">google-services.json</code>. Vložte jej do složky <code className="font-bold font-mono">android/app/</code>.
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400 font-mono">
            ID balíčku: cz.sejdemese.app
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs transition cursor-pointer"
          >
            Zavřít
          </button>
        </div>

      </div>
    </div>
  );
};

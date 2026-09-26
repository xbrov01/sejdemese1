import { Capacitor } from '@capacitor/core';
import { PushNotifications, ActionPerformed, PushNotificationSchema, Token } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { StatusBar, Style } from '@capacitor/status-bar';
import { App } from '@capacitor/app';
import { db, doc, updateDoc, getDoc } from './firebase';
import { DeviceTokenInfo } from '../types';

export const isNative = Capacitor.isNativePlatform();
export const currentPlatform = Capacitor.getPlatform(); // 'android' | 'ios' | 'web'

/**
 * Uloží FCM / APNS token zařízení do profilu uživatele ve Firestore
 */
export async function saveUserDeviceToken(
  userEmail: string,
  token: string,
  platform: 'android' | 'ios' | 'web' = (currentPlatform as 'android' | 'ios' | 'web') || 'android'
): Promise<void> {
  if (!userEmail || !token) return;
  try {
    const userRef = doc(db, 'users', userEmail);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return;

    const data = snap.data();
    const existingTokens: DeviceTokenInfo[] = Array.isArray(data.deviceTokens) ? data.deviceTokens : [];

    // Aktualizovat stávající nebo přidat nový
    const filtered = existingTokens.filter((t) => t.token !== token);
    const updated: DeviceTokenInfo[] = [
      ...filtered,
      {
        token,
        platform,
        updatedAt: new Date().toISOString(),
      },
    ].slice(-5); // Uchovávat max 5 posledních zařízení per uživatel

    await updateDoc(userRef, { deviceTokens: updated });
    console.log('[Capacitor] FCM token úspěšně registrován a uložen do databáze:', token.slice(0, 15) + '...');
  } catch (err) {
    console.error('[Capacitor] Chyba při ukládání FCM tokenu do Firestore:', err);
  }
}

/**
 * Inicializuje nativní push notifikace (FCM pro Android, APNS pro iOS)
 */
export async function initPushNotifications(
  userEmail?: string,
  onNotificationReceived?: (notification: PushNotificationSchema) => void,
  onNotificationAction?: (action: ActionPerformed) => void
): Promise<string | null> {
  if (!isNative) {
    console.log('[Capacitor] Běží ve webovém prohlížeči, nativní FCM Push plugin není aktivní.');
    return null;
  }

  try {
    // 1. Zkontrolovat a vyžádat oprávnění
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn('[Capacitor] Oprávnění k Push notifikacím nebylo uděleno:', permStatus.receive);
      return null;
    }

    // 2. Vytvořit notifikační kanál na Androidu
    if (Capacitor.getPlatform() === 'android') {
      try {
        await PushNotifications.createChannel({
          id: 'sejdemese_notifications',
          name: 'Oznámení Sejdeme se',
          description: 'Upozornění na události, docházku a týmový chat',
          importance: 5, // IMPORTANCE_HIGH
          visibility: 1, // VISIBILITY_PUBLIC
          sound: 'beep.wav',
          vibration: true,
          lights: true,
          lightColor: '#10B981',
        });
      } catch (channelErr) {
        console.warn('[Capacitor] Nelze vytvořit push kanál (pokračuji):', channelErr);
      }
    }

    // 3. Zaregistrovat zařízení v FCM / APNS
    await PushNotifications.register();

    // 4. Nastavit listenery
    PushNotifications.addListener('registration', async (token: Token) => {
      console.log('[Capacitor] Push token přijat:', token.value);
      if (userEmail) {
        await saveUserDeviceToken(userEmail, token.value, currentPlatform as any);
      }
    });

    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('[Capacitor] Chyba registrace do Push služby:', error);
    });

    PushNotifications.addListener('pushNotificationReceived', async (notification: PushNotificationSchema) => {
      console.log('[Capacitor] Push notifikace přijata (popředí):', notification);
      
      // Zobrazit jako lokální notifikaci i v popředí na telefonu
      await scheduleNativeNotification({
        title: notification.title || 'Sejdeme se',
        body: notification.body || '',
        data: notification.data,
      });

      if (onNotificationReceived) {
        onNotificationReceived(notification);
      }
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      console.log('[Capacitor] Uživatel kliknul na push notifikaci:', action);
      if (onNotificationAction) {
        onNotificationAction(action);
      }
    });

    return 'registered';
  } catch (err) {
    console.error('[Capacitor] Chyba při inicializaci push notifikací:', err);
    return null;
  }
}

/**
 * Zobrazí nativní systémovou notifikaci pomocí Capacitor LocalNotifications
 */
export async function scheduleNativeNotification(options: {
  title: string;
  body: string;
  id?: number;
  data?: any;
}): Promise<boolean> {
  if (!isNative) return false;

  try {
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      perm = await LocalNotifications.requestPermissions();
      if (perm.display !== 'granted') return false;
    }

    const notifId = options.id || Math.floor(Math.random() * 2147483647);

    await LocalNotifications.schedule({
      notifications: [
        {
          title: options.title,
          body: options.body,
          id: notifId,
          schedule: { at: new Date(Date.now() + 100) },
          sound: 'beep.wav',
          channelId: 'sejdemese_notifications',
          extra: options.data || null,
          smallIcon: 'ic_stat_icon_config_sample',
          iconColor: '#10B981',
        },
      ],
    });
    return true;
  } catch (err) {
    console.error('[Capacitor] Chyba při zobrazení lokální notifikace:', err);
    return false;
  }
}

/**
 * Nastaví nativní Status Bar na tmavý motiv odpovídající barvám aplikace
 */
export async function setupNativeStatusBar(): Promise<void> {
  if (!isNative) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0f172a' });
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch (err) {
    console.warn('[Capacitor] StatusBar konfigurace nebyla aplikována:', err);
  }
}

/**
 * Zaregistruje posluchač nativního tlačítka "Zpět" na Androidu.
 * Pokud callback vrátí true, událost je považována za vyřízenou (např. zavření modálu).
 */
export function setupAndroidBackButton(onBackAttempt: () => boolean): () => void {
  if (!isNative || currentPlatform !== 'android') {
    return () => {};
  }

  let handle: any = null;
  App.addListener('backButton', ({ canGoBack }) => {
    const handled = onBackAttempt();
    if (!handled && !canGoBack) {
      App.exitApp();
    }
  }).then((h) => {
    handle = h;
  });

  return () => {
    if (handle && typeof handle.remove === 'function') {
      handle.remove();
    }
  };
}

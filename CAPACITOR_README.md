# Integrace Capacitor v aplikaci "Sejdeme se"

Tato aplikace je vybavena nativním obalem **Capacitor 8**, který umožňuje provozovat stejný kód jako plnohodnotnou nativní aplikaci pro **Android** a **iOS** při zachování multi-uživatelské synchronizace přes Firestore.

---

## 🚀 Rychlý start (Android)

Nativní projekt v adresáři `/android` je již vygenerován a připraven pro Android Studio.

### 1. Sestavení a synchronizace
Kdykoli provedete změny ve webové části aplikace, spusťte:
```bash
npm run cap:build
```
Tento příkaz zkompiluje webové assety do složky `dist` a zkopíruje je do nativního Android projektu.

### 2. Otevření v Android Studio
```bash
npm run cap:android
```
Nebo otevřete Android Studio a zvolte **Open an existing project** -> složka `android/`.

### 3. Vytvoření instalačního souboru APK
V Android Studio klikněte na:
- **Build > Build Bundle(s) / APK(s) > Build APK(s)**
Po dokončení můžete vygenerovaný soubor `app-debug.apk` ihned nainstalovat na svůj telefon.

Pro vydání do obchodu Google Play zvolte:
- **Build > Generate Signed Bundle / APK**

---

## 🍏 Verze pro iPhone (iOS)

Kdykoli budete chtít vytvořit verzi pro iPhone / iOS (na počítači s macOS a Xcode):

```bash
# Přidání nativního iOS projektu
npx cap add ios

# Otevření v Xcode
npm run cap:ios
```

---

## 🔔 Nativní notifikace (FCM & Local)

- **Pluginy**: `@capacitor/push-notifications` a `@capacitor/local-notifications`.
- **Kanál**: `sejdemese_notifications` (vysoká priorita se zvukem a vibracemi).
- **Multi-user architektura**: Při spuštění aplikace na zařízení se FCM token zařízení automaticky zaregistruje do profilu uživatele ve Firestore v poli `deviceTokens`.
- **Produkční FCM setup**:
  1. V [Firebase Console](https://console.firebase.google.com/) přidejte Android aplikaci s Package ID `cz.sejdemese.app`.
  2. Stáhněte soubor `google-services.json` a umístěte jej do adresáře `android/app/google-services.json`.

---

## 🗄️ Multi-uživatelská databáze
Aplikace je napojena na centrální serverovou databázi Google Cloud Firestore (`ai-studio-sejdemese-77c505f2-fe30-4833-9d08-68327ec74d47`).
Všichni uživatelé na webu, Androidu i iPhone vidí docházku a zprávy v reálném čase.

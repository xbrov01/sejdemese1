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

Nativní projekt pro iOS v adresáři `/ios` je plně vygenerován, nakonfigurován a synchronizován.

### 1. Automatické sestavení skriptem
```bash
./build-ios.sh
# nebo přes npm:
npm run build:ios
```
- Na **macOS** automaticky zkompiluje aplikaci pomocí `xcodebuild` pro iOS simulátor a vypíše cestu k `.app` balíčku.
- Na **GitHub Actions** (`.github/workflows/build-ios.yml`) automaticky sestaví iOS balíček a vytvoří ke stažení `.zip` artefakt při každém pushi.

### 2. Otevření v Xcode (na macOS)
```bash
npm run cap:ios
```
Nebo otevřete soubor `ios/App/App.xcworkspace` v Xcode.

### 3. Sestavení a běh na iOS
- V Xcode zvolte cílové zařízení (iPhone simulátor nebo připojený fyzický iPhone).
- Klikněte na tlačítko **Run** (Cmd + R) pro sestavení a spuštění.
- Pro distribuci přes TestFlight / App Store zvolte **Product > Archive**.

### 4. Nastavení push notifikací pro iOS (APNs / Firebase)
- V Xcode v záložce **Signing & Capabilities** přidejte schopnost **Push Notifications** a **Background Modes (Remote notifications)**.
- V [Firebase Console](https://console.firebase.google.com/) přidejte iOS aplikaci s Bundle ID `cz.sejdemese.app` a stáhněte soubor `GoogleService-Info.plist` do `ios/App/App/`.

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

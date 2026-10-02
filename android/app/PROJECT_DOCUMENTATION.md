# Dokumentace projektu "Sejdeme se" (cz.sejdemese.app)

Tento dokument slouží jako **komplexní architektonický a infrastrukturní manuál** a zároveň jako **vstupní bod (Entry Point)** pro vývojáře i nově importované projekty v Google AI Studio.

---

## 1. Přehled projektu a business logika

Aplikace **„Sejdeme se“** slouží pro organizaci sportovních a volnočasových událostí, evidenci docházky v reálném čase, týmovou komunikaci a synchronizaci s kalendáři na mobilních platformách (Android, iOS) i webu.

- **Název aplikace:** Sejdeme se
- **App / Package ID (Bundle ID):** `cz.sejdemese.app`
- **Typ aplikace:** Multiplatformní hybridní aplikace (React 19 + Capacitor 8)
- **Centrální backend:** Google Cloud Firestore + Firebase Authentication

### Hlavní funkce:
1. **Správa týmů (Multi-tenancy):**
   - Vytváření týmů, unikátní 6místné kódy pro vstup (`code`).
   - Přidávání členů a správců (`adminEmails`).
   - Vlastní přezdívky členů v rámci jednotlivých týmů (`nicknames`).
   - Ochrana proti opuštění týmu: Poslední správce týmu nesmí tým opustit bez předání role jinému členovi.
2. **Události (Events):**
   - Datum, čas začátku (`time`) a volitelný čas konce (`endTime`).
   - Automatický výpočet délky trvání (výchozí 1 hodina).
   - Místo konání, popis, správa událostí pouze pro administrátory týmu a superadminy.
3. **Evidence docházky (Real-time Attendance):**
   - Stavy: **ANO (YES)**, **MOŽNÁ (MAYBE)**, **NE (NO)**.
   - Okamžitá synchronizace mezi všemi účastníky přes Firestore snapshoty.
4. **Export do kalendářů:**
   - Podpora pro **Google Kalendář** (web intent), **Apple Kalendář** (iOS URL scheme `data:text/calendar`), **Outlook Live** a přímé stažení souboru **`.ics`** (RFC 5545).
   - Správně počítá začátek, konec a trvání události.
5. **Integrovaný chat události:**
   - Zprávy vázané k události v reálném čase.
6. **Notifikační systém:**
   - Push notifikace (FCM pro Android, APNs pro iOS) a lokální notifikace.
   - Týmová připomenutí (např. 24 hodin a 2 hodiny předem).
   - Notifikace o vytvoření, změně či zrušení události.
   - Osobní nastavení notifikací pro každý tým zvlášť.
7. **Uživatelské účty a Superadmin:**
   - Přihlášení přes Email/Heslo a Google Sign-In.
   - Globální systémový superadmin: `admin@sejdemese.cz` a vlastník `vojtech.broz@gmail.com`.

---

## 2. Technologický stack

### Frontend:
- **React:** 19.0.1 (funkcionální komponenty, hooks)
- **TypeScript:** 5.8.2
- **Styling:** Tailwind CSS v4 (`@tailwindcss/vite` 4.1.14)
- **Ikony:** Lucide React (`lucide-react`)
- **Animace:** Motion v12 (`motion`)
- **Bundler:** Vite 6.2.3

### Mobilní runtime:
- **Capacitor Core & CLI:** 8.5.2
- **Capacitor Android:** 8.5.2
- **Capacitor iOS:** 8.5.2
- **Push notifikace:** `@capacitor/push-notifications` 8.1.2
- **Lokální notifikace:** `@capacitor/local-notifications` 8.3.1
- **Status Bar:** `@capacitor/status-bar` 8.0.3
- **Nativní Firebase Auth:** `@capacitor-firebase/authentication` 8.5.2

### Backend & Cloud:
- **Google Cloud Firestore:** Databáze `ai-studio-sejdemese-77c505f2-fe30-4833-9d08-68327ec74d47` (GCP projekt: `gen-lang-client-0627024616`)
- **Firebase Authentication:** Google OAuth 2.0 + Password Auth

---

## 3. Datový model (Firestore struktura)

### Kolekce `users/{email}` (UserProfile)
- `id` (string): email uživatele
- `email` (string): primární email
- `name` (string): celé jméno
- `role` ('admin' | 'member'): základní globální role
- `isSuperAdmin` (boolean): globální práva pro všechny týmy a události
- `teamNicknames` (Record<string, string>): ID týmu -> přezdívka
- `notificationPreferences` (Record<string, TeamNotificationPreferences>): preference notifikací
- `deviceTokens` (DeviceTokenInfo[]): FCM/APNs tokeny zařízení pro push zprávy
- `fontSize` ('standard' | 'large' | 'xlarge'): uživatelské nastavení velikosti písma

### Kolekce `teams/{teamId}` (Team)
- `id` (string): unikátní ID týmu
- `name` (string): název týmu
- `code` (string): 6místný kód pro připojení
- `createdBy` (string): email zakladatele
- `memberEmails` (string[]): seznam emailů členů
- `adminEmails` (string[]): seznam emailů správců týmu
- `nicknames` (Record<string, string>): email -> přezdívka v týmu

### Kolekce `events/{eventId}` (Event)
- `id` (string): unikátní ID události
- `teamId` (string): ID příslušného týmu
- `title` (string): název akce
- `description` (string, optional): podrobný popis
- `date` (string): datum ve formátu `YYYY-MM-DD`
- `time` (string): začátek ve formátu `HH:MM`
- `endTime` (string, optional): konec ve formátu `HH:MM`
- `location` (string): místo konání
- `createdBy` (string): email autora
- `reminders` (number[]): např. `[24, 2]` hodiny předem

### Subkolekce `events/{eventId}/attendance/{userEmail}` (AttendanceRecord)
- `id` / `userEmail` (string): email účastníka
- `userName` (string): jméno účastníka
- `status` ('YES' | 'MAYBE' | 'NO')
- `updatedAt` (string): ISO čas aktualizace

### Subkolekce `events/{eventId}/messages/{messageId}` (EventMessage)
- `authorName` (string)
- `authorEmail` (string)
- `text` (string)
- `timestamp` (Firestore serverTimestamp)

### Kolekce `notifications/{notificationId}` (NotificationItem)
- `userEmail`, `teamId`, `eventId`, `type`, `title`, `message`, `read`, `pushed`, `createdAt`

---

## 4. Infrastrukturní rozhodnutí a architektura

1. **Capacitor 8 namísto čistého React Native / Flutteru:**
   - Umožňuje sdílet 100 % kódu mezi webem, Androidem i iOS bez rozdílu v UI či logice.
   - Podpora standardních webových technologií, rychlý vývoj a okamžitý preview v AI Studiu.
2. **Přímé napojení na Firestore SDK s offline persistencí:**
   - Aplikace využívá real-time listenery (`onSnapshot`), což zajišťuje okamžitou aktualizaci docházky a zpráv bez nutnosti psát vlastní WebSocket server.
3. **Ochrana správců týmu:**
   - Správce týmu nemůže opustit tým, pokud je jeho jediným správcem (`isUserOnlyTeamAdmin`). Musí nejprve jmenovat jiného správce, nebo tým zrušit.
4. **Systémový superadmin:**
   - `admin@sejdemese.cz` a `vojtech.broz@gmail.com` mají automaticky přístup ke všem týmům i akcím pro servisní účely.
5. **Bezpečné zacházení s citlivými soubory:**
   - `android/app/google-services.json` propojuje aplikaci s Firebase projektem.
   - `android/app/debug.keystore` je standardní vývojářský klíč pro podepisování debug balíčků (heslo: `android`, alias: `androiddebugkey`).

---

## 5. Kompilace aplikace pro Android

### Rychlý skript:
V kořeni projektu je připraven skript:
```bash
npm run build:apk
# nebo přímo:
bash build-apk.sh
```
Skript provede:
1. Nastavení Java 21 (`JAVA_HOME`).
2. Stažení/kontrolu Android SDK (`platform-tools`, `platforms;android-36`, `build-tools;35.0.0`).
3. `npm run build` a `npx cap sync android`.
4. Spuštění `./gradlew assembleDebug --no-daemon` v adresáři `/android`.
5. Výsledný APK se nachází v: `android/app/build/outputs/apk/debug/app-debug.apk`.

### Sestavení v Android Studiu:
1. V kořeni projektu spusťte:
   ```bash
   npm run cap:build
   ```
2. Otevřete složku `/android` v Android Studiu:
   ```bash
   npm run cap:android
   ```
3. Počkejte na dokončení Gradle Sync.
4. **Debug APK:** Menu `Build > Build Bundle(s) / APK(s) > Build APK(s)`.
5. **Produkční Release Bundle (pro Google Play):** Menu `Build > Generate Signed Bundle / APK` -> zvolte **Android App Bundle (.aab)**.

---

## 6. Kompilace aplikace pro iOS

### Rychlý skript:
```bash
npm run build:ios
# nebo:
bash build-ios.sh
```
*Poznámka: Nativní kompilace binárního souboru `.app` / `.ipa` vyžaduje operační systém macOS s nainstalovaným Xcode.*

### Sestavení na macOS v Xcode:
1. Spusťte synchronizaci webových assetů a pluginů:
   ```bash
   npm run cap:build
   ```
2. Otevřete nativní projekt v Xcode:
   ```bash
   npm run cap:ios
   # nebo přímo otevřete: ios/App/App.xcworkspace
   ```
3. V Xcode vyberte v horní liště cíl: **iPhone Simulator** nebo fyzické připojené zařízení.
4. Zmáčkněte `Cmd + R` (Run) pro spuštění.
5. Pro distribuci do **TestFlight / App Store** zvolte v horním menu **Product > Archive**.

---

## 7. Publikace do obchodů (Google Play & Apple App Store)

### 🤖 Publikace na Google Play Store
1. **Verzování:**
   - V souboru `android/app/build.gradle` zvyšte `versionCode` (např. 2, 3...) a `versionName` (např. "1.0.1").
2. **Generování produkčního balíčku:**
   - Google Play vyžaduje formát **AAB** (Android App Bundle), nikoliv APK.
   - V Android Studiu: `Build > Generate Signed Bundle / APK` -> Android App Bundle.
   - Použijte svůj produkční Keystore (`.jks` / `.keystore`). *Nikdy neztrácejte heslo a soubor keystoru!*
3. **Firebase nastavení (SHA otisk):**
   - Získejte SHA-1 a SHA-256 otisk vašeho produkčního klíče (příkazem `keytool -list -v -keystore vas-klic.jks`).
   - Přidejte tyto otisky v [Firebase Console](https://console.firebase.google.com/) u aplikace `cz.sejdemese.app`.
   - Znovu stáhněte a aktualizujte `google-services.json`.
4. **Google Play Console:**
   - Vytvořte aplikaci v Google Play Console.
   - Nahrajte vygenerovaný `.aab` soubor do produkční větve nebo do Interního testování (Internal Testing).
   - Vyplňte Dotazník o bezpečnosti dat (Data Safety): aplikace používá Firebase Auth (identita uživatele) a Firestore (docházka, týmy).

### 🍏 Publikace na Apple App Store
1. **Apple Developer Program:**
   - Vyžaduje aktivní účet v Apple Developer Programu ($99/rok).
2. **Nastavení v Xcode:**
   - V záložce **Signing & Capabilities** zvolte svůj vývojářský tým (Team).
   - Bundle Identifier musí být: `cz.sejdemese.app`.
   - Zkontrolujte přítomnost Capabilities:
     - **Push Notifications** (pro vzdálená upozornění).
     - **Background Modes** (zaškrtnuto *Remote notifications*).
3. **APNs certifikát / Auth Key:**
   - V Apple Developer portálu v sekci *Keys* vygenerujte **Apple Push Notifications key (`.p8`)**.
   - Nahrajte tento `.p8` klíč do Firebase Console (Project Settings > Cloud Messaging > Apple app configuration).
4. **Archivace a odeslání:**
   - `Product > Archive` -> po dokončení klikněte na **Distribute App** -> **App Store Connect**.
   - V App Store Connect vytvořte nový záznam verze, vyplňte screenshoty, popis a odešlete na schválení (App Review).

---

## 8. Tipy, triky a řešení častých problémů

### ⚠️ 1. Pravidlo synchronizace Capacitoru
- **Vždy** před `npx cap sync` spusťte `npm run build` (nebo použijte rovnou příkaz `npm run cap:build`).
- Pokud spustíte `cap sync` bez buildu, nativní aplikace bude obsahovat staré nebo prázdné webové assety.

### ⚠️ 2. Pozor na smazání `debug.keystore` a `google-services.json`
- Soubory `android/app/debug.keystore` a `android/app/google-services.json` jsou nezbytné pro sestavení Android projektu.
- V `.gitignore` nesmí být pravidlo, které by tyto soubory ignorovalo, pokud je potřebují automatické CI buildy (GitHub Actions).

### ⚠️ 3. Požadavek na Java 21 pro Capacitor 8
- Capacitor verze 8 a novější Gradle pluginy vyžadují **Java 21**.
- Pokud Gradle selže s chybou `Unsupported class file major version`, zkontrolujte `java -version` a ujistěte se, že `JAVA_HOME` ukazuje na JDK 21.

### ⚠️ 4. GitHub Actions CI/CD
V repozitáři jsou připraveny workflow ve složce `.github/workflows/`:
- `build-apk.yml`: Automaticky sestaví Android APK při pushi a vytvoří artefakt ke stažení.
- `build-ios.yml`: Automaticky validuje iOS projekt a připravuje balíček.
- `release.yml`: Vytváří oficiální GitHub Release při otagování verze (např. `git tag v1.0.0 && git push origin v1.0.0`).

---

## 9. Vstupní bod (Entry Point) pro nový AI Studio projekt

Při importu tohoto repozitáře do nového projektu v Google AI Studio:

1. **Import:**
   - Na úvodní obrazovce Google AI Studio zvolte **Import from GitHub** a vyberte repozitář `xbrov01/sejdemese` (větev `main`).
2. **Kontrola konfigurace:**
   - Soubor `metadata.json` má nastaven název aplikace na `"Sejdeme se"` a oprávnění `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`.
   - Soubor `firebase-applet-config.json` obsahuje spojení na databázi `ai-studio-sejdemese-77c505f2-fe30-4833-9d08-68327ec74d47`.
3. **První spuštění / ověření:**
   - AI Studio automaticky nainstaluje balíčky a spustí vývojový server (`npm run dev`) na portu 3000.
   - Pro ověření buildu kdykoliv spusťte `npm run build` nebo `npm run lint`.
4. **Bezpečný vývoj a pushování:**
   - Veškeré úpravy kódu provádějte v adresáři `/src`.
   - Změny se verzují a synchronizují přímo s větví `main` na GitHubu.

# Sejdeme se (cz.sejdemese.app)

Aplikace pro organizaci sportovních a volnočasových událostí, evidenci docházky v reálném čase, týmovou komunikaci a synchronizaci s kalendáři pro **Web**, **Android** a **iOS**.

---

## 📖 Dokumentace a architektura
Kompletní technická a infrastrukturní dokumentace je k dispozici v:
- **[PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md)** – Hlavní architektonický manuál, datové modely, postupy sestavení a publikace na Google Play a App Store.
- **[CAPACITOR_README.md](./CAPACITOR_README.md)** – Návod na práci s Capacitor 8, Android Studiem a Xcode.

---

## 🚀 Rychlý start

### Lokální vývoj (Web)
```bash
npm install
npm run dev
```
Aplikace běží na `http://localhost:3000`.

### Produkční webový build
```bash
npm run build
```

### Sestavení mobilní aplikace (Capacitor)
```bash
# Sestavení webových assetů a synchronizace do Android a iOS
npm run cap:build

# Sestavení Android Debug APK (včetně automatické instalace Java 21 a Android SDK)
npm run build:apk

# Otevření v Android Studio / Xcode
npm run cap:android
npm run cap:ios
```

---

## 🛠️ Použité technologie
- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Motion, Lucide Icons, Vite 6
- **Mobilní kontejner:** Capacitor 8 (`@capacitor/android`, `@capacitor/ios`, push a lokální notifikace)
- **Backend a databáze:** Google Cloud Firestore (`ai-studio-sejdemese-77c505f2-fe30-4833-9d08-68327ec74d47`), Firebase Auth

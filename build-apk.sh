#!/bin/bash
set -e

echo "=== 1. Sestavení webových assetů a synchronizace Capacitor ==="
npm run cap:build

echo "=== 2. Kontrola Java JDK a Android SDK ==="
if ! command -v java &> /dev/null; then
    echo "Chyba: Java JDK nebyla nalezena. Nainstalujte OpenJDK 17."
    exit 1
fi

echo "=== 3. Sestavení Android APK pomocí Gradle ==="
cd android
chmod +x gradlew
./gradlew assembleDebug

echo "=== Hotovo! ==="
echo "Vygenerovaný APK soubor naleznete v:"
echo "android/app/build/outputs/apk/debug/app-debug.apk"

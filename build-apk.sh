#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "=== 1. Configuring Java 21 Environment ==="
# Locate and set JAVA_HOME to Java 21 based on available local installations
if [ -d "$HOME/java/21.0.12+1-ms" ]; then
    export JAVA_HOME="$HOME/java/21.0.12+1-ms"
elif [ -d "/usr/lib/jvm/java-21-openjdk-amd64" ]; then
    export JAVA_HOME="/usr/lib/jvm/java-21-openjdk-amd64"
else
    # Fallback search in standard jvm paths
    JAVA_21_PATH=$(find /usr/lib/jvm -name "*java-21*" -type d | head -n 1)
    if [ -n "$JAVA_21_PATH" ]; then
        export JAVA_HOME="$JAVA_21_PATH"
    else
        echo "Error: Java 21 installation not found."
        exit 1
    fi
fi

export PATH="$JAVA_HOME/bin:$PATH"
echo "Active Java Version:"
java -version


echo "=== 2. Setting up Android SDK ==="
export ANDROID_HOME="$HOME/android-sdk"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

if [ ! -d "$ANDROID_HOME/cmdline-tools/latest" ]; then
    echo "Android SDK not found. Installing command-line tools..."
    mkdir -p "$ANDROID_HOME/cmdline-tools"
    cd "$ANDROID_HOME/cmdline-tools"
    
    # Download official Android command-line tools
    wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O cmdline-tools.zip
    mkdir -p temp
    unzip -q cmdline-tools.zip -d temp
    mkdir -p latest
    mv temp/cmdline-tools/* latest/
    rm -rf temp cmdline-tools.zip
    
    echo "Accepting licenses and installing SDK packages..."
    yes | sdkmanager --licenses > /dev/null
    # Install platform 36, and install build-tools (falling back to 35.0.0 if 36.0.0 is not in repo)
    sdkmanager "platform-tools" "platforms;android-36" "build-tools;35.0.0" || sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"
else
    echo "Android SDK already present."
fi

# Return to project root dynamically based on script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"


echo "=== 3. Building Web Assets & Syncing Capacitor ==="
npm run build
npx cap sync android


echo "=== 4. Granting Permissions and Compiling Debug APK ==="
cd android
chmod +x gradlew
./gradlew assembleDebug --no-daemon

echo "=== Build Complete! ==="
echo "Your APK is located at: android/app/build/outputs/apk/debug/app-debug.apk"

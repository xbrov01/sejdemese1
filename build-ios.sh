#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== 1. Building Web Assets & Syncing Capacitor iOS ==="
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.bin/vite" ]; then
    echo "Dependencies not found or incomplete. Running npm install..."
    npm install
fi

export PATH="$SCRIPT_DIR/node_modules/.bin:$PATH"

npm run build
npx cap sync ios
node scripts/patch-status-bar.cjs

echo "=== 2. Verifying iOS Build Environment ==="
OS_TYPE="$(uname -s)"

if [ "$OS_TYPE" != "Darwin" ]; then
    echo "================================================================="
    echo "ℹ️  Notice: You are running on $(uname -s)."
    echo "Compiling the native iOS binary (.app / .ipa) requires Apple macOS with Xcode."
    echo ""
    echo "All web assets and native Capacitor plugins have been successfully"
    echo "compiled and synced to: ios/App/App.xcworkspace"
    echo ""
    echo "To build the binary:"
    echo "  1. On macOS: Run this script './build-ios.sh' or 'npm run cap:ios'"
    echo "  2. In Cloud CI: Trigger the GitHub Actions workflow (.github/workflows/build-ios.yml)"
    echo "================================================================="
    exit 0
fi

if ! command -v xcodebuild &> /dev/null; then
    echo "Error: 'xcodebuild' command not found. Please install Xcode and the Command Line Tools (xcode-select --install)."
    exit 1
fi

echo "Xcode version:"
xcodebuild -version

echo "=== 3. Compiling iOS App for Simulator (Debug) ==="
mkdir -p build/ios

if [ -d "ios/App/App.xcworkspace" ]; then
  TARGET_ARG="-workspace ios/App/App.xcworkspace"
else
  TARGET_ARG="-project ios/App/App.xcodeproj"
fi

set -o pipefail
xcodebuild \
  $TARGET_ARG \
  -scheme App \
  -configuration Debug \
  -destination "generic/platform=iOS Simulator" \
  -derivedDataPath build/ios \
  clean build \
  ARCHS=arm64 \
  ONLY_ACTIVE_ARCH=YES \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO 2>&1 | tee xcodebuild.log || {
    echo "=== BUILD FAILED. EXTRACTING COMPILER ERRORS ==="
    grep -E "error:" xcodebuild.log || tail -n 100 xcodebuild.log
    exit 1
  }

APP_PATH="$(find build/ios/Build/Products -name 'App.app' -type d | head -n 1)"

echo "=== Build Complete! ==="
if [ -n "$APP_PATH" ]; then
    echo "Your compiled iOS App is located at: $APP_PATH"
    echo ""
    echo "To run in an active iOS Simulator:"
    echo "  xcrun simctl install booted \"$APP_PATH\""
    echo "  xcrun simctl launch booted cz.sejdemese.app"
else
    echo "iOS build finished successfully in: build/ios"
fi

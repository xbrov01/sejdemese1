const fs = require('fs');
const path = require('path');

const pluginSwiftPath = path.resolve(__dirname, '../node_modules/@capacitor/status-bar/ios/Sources/StatusBarPlugin/StatusBarPlugin.swift');
const statusBarSwiftPath = path.resolve(__dirname, '../node_modules/@capacitor/status-bar/ios/Sources/StatusBarPlugin/StatusBar.swift');
const uiColorSwiftPath = path.resolve(__dirname, '../node_modules/@capacitor/status-bar/ios/Sources/StatusBarPlugin/UIColor.swift');

const pushPluginSwiftPath = path.resolve(__dirname, '../node_modules/@capacitor/push-notifications/ios/Sources/PushNotificationsPlugin/PushNotificationsPlugin.swift');
const pushHandlerSwiftPath = path.resolve(__dirname, '../node_modules/@capacitor/push-notifications/ios/Sources/PushNotificationsPlugin/PushNotificationsHandler.swift');

function patchStatusBarPlugin() {
  if (!fs.existsSync(pluginSwiftPath)) {
    console.log('[patch-plugins] StatusBarPlugin.swift not found at', pluginSwiftPath);
    return;
  }

  let content = fs.readFileSync(pluginSwiftPath, 'utf8');

  // Check if already patched
  if (!content.includes('private func colorFromHex(')) {
    const helperCode = `
    private func colorFromHex(_ hex: String) -> UIColor? {
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "#", with: "")
        if hexSanitized.count == 6 {
            hexSanitized = "FF" + hexSanitized
        }
        guard let hexNum = UInt32(hexSanitized, radix: 16) else { return nil }
        return UIColor(
            red: CGFloat((hexNum & 0x00FF0000) >> 16) / 255.0,
            green: CGFloat((hexNum & 0x0000FF00) >> 8) / 255.0,
            blue: CGFloat(hexNum & 0x000000FF) / 255.0,
            alpha: CGFloat((hexNum & 0xFF000000) >> 24) / 255.0
        )
    }
`;

    content = content.replace(
      'private func statusBarConfig() -> StatusBarConfig {',
      `${helperCode}
    private func statusBarConfig() -> StatusBarConfig {`
    );

    const oldConfigPattern = /private func statusBarConfig\(\) -> StatusBarConfig \{[\s\S]*?return config\s*\}/;
    const newConfigImplementation = `private func statusBarConfig() -> StatusBarConfig {
        var config = StatusBarConfig()
        let json = getConfig().getConfigJSON()
        if let overlays = json["overlaysWebView"] as? Bool {
            config.overlaysWebView = overlays
        }
        if let colorConfig = json["backgroundColor"] as? String, let color = colorFromHex(colorConfig) {
            config.backgroundColor = color
        }
        if let configStyle = json["style"] as? String {
            config.style = style(fromString: configStyle)
        }
        return config
    }`;
    content = content.replace(oldConfigPattern, newConfigImplementation);

    content = content.replace(
      'let color = UIColor.capacitor.color(fromHex: hexString)',
      'let color = colorFromHex(hexString)'
    );

    content = content.replace(
      /let animation = call\.getString\("animation", "FADE"\)/g,
      'let animation = (call.options["animation"] as? String) ?? "FADE"'
    );

    fs.writeFileSync(pluginSwiftPath, content, 'utf8');
    console.log('[patch-plugins] Successfully patched StatusBarPlugin.swift');
  } else {
    console.log('[patch-plugins] StatusBarPlugin.swift already patched.');
  }
}

function patchStatusBar() {
  if (!fs.existsSync(statusBarSwiftPath)) {
    console.log('[patch-plugins] StatusBar.swift not found at', statusBarSwiftPath);
    return;
  }

  let content = fs.readFileSync(statusBarSwiftPath, 'utf8');

  if (!content.includes('static func hexFromColor(')) {
    content = content.replace(
      'color: UIColor.capacitor.hex(fromColor: backgroundColor),',
      'color: StatusBar.hexFromColor(backgroundColor),'
    );

    const hexHelper = `
    static func hexFromColor(_ color: UIColor) -> String {
        var r: CGFloat = 0
        var g: CGFloat = 0
        var b: CGFloat = 0
        var a: CGFloat = 0
        color.getRed(&r, green: &g, blue: &b, alpha: &a)
        return String(format: "#%02lX%02lX%02lX", lroundf(Float(r * 255)), lroundf(Float(g * 255)), lroundf(Float(b * 255)))
    }
`;

    content = content.replace(
      'private var bridge: CAPBridgeProtocol',
      `${hexHelper}
    private var bridge: CAPBridgeProtocol`
    );
  }

  content = content.replace(/object:\s*\.none,\s*queue:\s*\.none/g, 'object: nil, queue: nil');

  const oldShowAsync = /DispatchQueue\.main\.asyncAfter\(deadline:\s*\.now\(\)\s*\+\s*0\.1\)\s*\{\s*\[self\]\s*in[\s\S]*?backgroundView\?\.isHidden\s*=\s*false\s*\}/;
  const newShowAsync = `DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
                guard let self = self else { return }
                self.resizeWebView()
                if !self.isOverlayingWebview {
                    self.resizeStatusBarBackgroundView()
                    if let bgView = self.backgroundView {
                        self.bridge.webView?.superview?.addSubview(bgView)
                    }
                }
                self.backgroundView?.isHidden = false
            }`;
  content = content.replace(oldShowAsync, newShowAsync);

  fs.writeFileSync(statusBarSwiftPath, content, 'utf8');
  console.log('[patch-plugins] Successfully patched StatusBar.swift');
}

function patchUIColor() {
  if (fs.existsSync(uiColorSwiftPath)) {
    fs.unlinkSync(uiColorSwiftPath);
    console.log('[patch-plugins] Removed redundant UIColor.swift');
  } else {
    console.log('[patch-plugins] UIColor.swift already removed.');
  }
}

function patchPushNotificationsPlugin() {
  if (!fs.existsSync(pushPluginSwiftPath)) {
    console.log('[patch-plugins] PushNotificationsPlugin.swift not found at', pushPluginSwiftPath);
    return;
  }

  let content = fs.readFileSync(pushPluginSwiftPath, 'utf8');

  // Replace call.getArray("notifications", JSObject.self) with options dictionary access
  content = content.replace(
    'guard let notifications = call.getArray("notifications", JSObject.self) else {',
    'guard let notifications = (call.options["notifications"] as? [JSObject]) ?? (call.options["notifications"] as? [[String: Any]]) else {'
  );

  // Replace UIApplication.shared.applicationIconBadgeNumber with iOS 16+ safe setBadgeCount
  content = content.replace(
    'UIApplication.shared.applicationIconBadgeNumber = 0',
    `if #available(iOS 16.0, *) {
                UNUserNotificationCenter.current().setBadgeCount(0)
            } else {
                UIApplication.shared.applicationIconBadgeNumber = 0
            }`
  );

  // Ensure notification names resolve reliably
  content = content.replace(
    'name: .capacitorDidRegisterForRemoteNotifications,',
    'name: Notification.Name("CapacitorDidRegisterForRemoteNotificationsNotification"),'
  );
  content = content.replace(
    'name: .capacitorDidFailToRegisterForRemoteNotifications,',
    'name: Notification.Name("CapacitorDidFailToRegisterForRemoteNotificationsNotification"),'
  );

  fs.writeFileSync(pushPluginSwiftPath, content, 'utf8');
  console.log('[patch-plugins] Successfully patched PushNotificationsPlugin.swift');
}

function patchPushNotificationsHandler() {
  if (!fs.existsSync(pushHandlerSwiftPath)) {
    console.log('[patch-plugins] PushNotificationsHandler.swift not found at', pushHandlerSwiftPath);
    return;
  }

  let content = fs.readFileSync(pushHandlerSwiftPath, 'utf8');

  // Explicit @objc on class and protocol methods for Swift 6
  if (!content.includes('@objc(PushNotificationsHandler)')) {
    content = content.replace(
      'public class PushNotificationsHandler: NSObject, NotificationHandlerProtocol {',
      '@objc(PushNotificationsHandler)\npublic class PushNotificationsHandler: NSObject, NotificationHandlerProtocol {'
    );
  }

  if (!content.includes('@objc public func willPresent')) {
    content = content.replace(
      'public func willPresent(notification: UNNotification) -> UNNotificationPresentationOptions {',
      '@objc public func willPresent(notification: UNNotification) -> UNNotificationPresentationOptions {'
    );
  }

  if (!content.includes('@objc public func didReceive')) {
    content = content.replace(
      'public func didReceive(response: UNNotificationResponse) {',
      '@objc public func didReceive(response: UNNotificationResponse) {'
    );
  }

  // Replace getConfig().getArray with getConfigJSON()
  content = content.replace(
    'if let optionsArray = self.plugin?.getConfig().getArray("presentationOptions") as? [String] {',
    'if let optionsArray = self.plugin?.getConfig().getConfigJSON()["presentationOptions"] as? [String] {'
  );

  // Replace JSTypes.coerceDictionaryToJSObject with standard dictionary cast
  content = content.replace(
    '"data": JSTypes.coerceDictionaryToJSObject(request.content.userInfo) ?? [:]',
    '"data": (request.content.userInfo as? [String: Any]) ?? [:]'
  );

  fs.writeFileSync(pushHandlerSwiftPath, content, 'utf8');
  console.log('[patch-plugins] Successfully patched PushNotificationsHandler.swift');
}

patchStatusBarPlugin();
patchStatusBar();
patchUIColor();
patchPushNotificationsPlugin();
patchPushNotificationsHandler();

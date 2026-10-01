const fs = require('fs');
const path = require('path');

const pluginSwiftPath = path.resolve(__dirname, '../node_modules/@capacitor/status-bar/ios/Sources/StatusBarPlugin/StatusBarPlugin.swift');
const statusBarSwiftPath = path.resolve(__dirname, '../node_modules/@capacitor/status-bar/ios/Sources/StatusBarPlugin/StatusBar.swift');
const uiColorSwiftPath = path.resolve(__dirname, '../node_modules/@capacitor/status-bar/ios/Sources/StatusBarPlugin/UIColor.swift');

function patchStatusBarPlugin() {
  if (!fs.existsSync(pluginSwiftPath)) {
    console.log('[patch-status-bar] StatusBarPlugin.swift not found at', pluginSwiftPath);
    return;
  }

  let content = fs.readFileSync(pluginSwiftPath, 'utf8');

  // Check if already patched
  if (!content.includes('private func colorFromHex(')) {
    // Helper method for hex color conversion
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

    // Insert helper method before private func statusBarConfig()
    content = content.replace(
      'private func statusBarConfig() -> StatusBarConfig {',
      `${helperCode}
    private func statusBarConfig() -> StatusBarConfig {`
    );

    // Replace statusBarConfig implementation to avoid missing PluginConfig members in SPM
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

    // Replace UIColor.capacitor.color(fromHex: hexString) with colorFromHex(hexString)
    content = content.replace(
      'let color = UIColor.capacitor.color(fromHex: hexString)',
      'let color = colorFromHex(hexString)'
    );

    // Replace call.getString("animation", "FADE")
    content = content.replace(
      /let animation = call\.getString\("animation", "FADE"\)/g,
      'let animation = (call.options["animation"] as? String) ?? "FADE"'
    );

    fs.writeFileSync(pluginSwiftPath, content, 'utf8');
    console.log('[patch-status-bar] Successfully patched StatusBarPlugin.swift');
  } else {
    console.log('[patch-status-bar] StatusBarPlugin.swift already patched.');
  }
}

function patchStatusBar() {
  if (!fs.existsSync(statusBarSwiftPath)) {
    console.log('[patch-status-bar] StatusBar.swift not found at', statusBarSwiftPath);
    return;
  }

  let content = fs.readFileSync(statusBarSwiftPath, 'utf8');

  // 1. Add hexFromColor if not present
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

  // 2. Fix object: .none, queue: .none for Swift 6 / Xcode 16 compatibility
  content = content.replace(/object:\s*\.none,\s*queue:\s*\.none/g, 'object: nil, queue: nil');

  // 3. Fix [self] in DispatchQueue.main.asyncAfter in show() for Swift 6 Sendable closure
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
  console.log('[patch-status-bar] Successfully patched StatusBar.swift');
}

function patchUIColor() {
  if (!fs.existsSync(uiColorSwiftPath)) {
    console.log('[patch-status-bar] UIColor.swift not found at', uiColorSwiftPath);
    return;
  }

  const cleanContent = `// Patched for SPM Capacitor 8 compatibility
import UIKit

extension UIColor {
    internal static let capacitorStatusBarPatched = true
}
`;

  fs.writeFileSync(uiColorSwiftPath, cleanContent, 'utf8');
  console.log('[patch-status-bar] Successfully patched UIColor.swift');
}

patchStatusBarPlugin();
patchStatusBar();
patchUIColor();

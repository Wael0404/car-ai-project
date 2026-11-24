import { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

/**
 * Shows a Sketchfab model with the official viewer (embedding is free and
 * needs no account). Tries to repaint the body with the owner's color.
 */

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function viewerHtml(uid: string, color: string): string {
  // uid is a 32-char hex id from our API; checked again here before use.
  const safeUid = /^[a-f0-9]{32}$/i.test(uid) ? uid : "";
  const rgb = JSON.stringify(hexToRgb(color));
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body{margin:0;height:100%;background:transparent;overflow:hidden}iframe{width:100%;height:100%;border:0}</style>
</head><body>
<iframe id="v" allow="autoplay; fullscreen; xr-spatial-tracking"></iframe>
<script src="https://static.sketchfab.com/api/sketchfab-viewer-1.12.1.js"></script>
<script>
  var post = function (m) { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(m); };
  var PAINT = /paint|carpaint|body|lack|vernice|carrosserie|exterior/i;
  var NOT_PAINT = /glass|window|chrome|tyre|tire|rubber|light|lamp|interior|seat|plastic|black|grill|rim|wheel|mirror/i;
  var RGB = ${rgb};
  function repaint(api) {
    api.getMaterialList(function (err, materials) {
      if (err) return post("ready");
      materials.forEach(function (m) {
        if (!PAINT.test(m.name) || NOT_PAINT.test(m.name)) return;
        ["AlbedoPBR", "DiffusePBR", "DiffuseColor"].forEach(function (ch) {
          var c = m.channels && m.channels[ch];
          if (c && c.enable !== false) { c.color = RGB; c.texture = undefined; }
        });
        api.setMaterial(m);
      });
      post("ready");
    });
  }
  try {
    var client = new Sketchfab(document.getElementById("v"));
    client.init("${safeUid}", {
      autostart: 1, autospin: 0.2, transparent: 1, preload: 1,
      ui_infos: 0, ui_controls: 0, ui_stop: 0, ui_inspector: 0, ui_ar: 0, ui_help: 0,
      ui_settings: 0, ui_vr: 0, ui_fullscreen: 0, ui_annotations: 0, ui_hint: 0,
      success: function (api) {
        api.start();
        api.addEventListener("viewerready", function () { repaint(api); });
      },
      error: function () { post("error"); }
    });
  } catch (e) { post("error"); }
</script></body></html>`;
}

export function SketchfabViewer({
  uid,
  color,
  height,
  onError,
}: {
  uid: string;
  color: string;
  height: number;
  onError: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const html = useMemo(() => viewerHtml(uid, color), [uid, color]);

  function onMessage(e: WebViewMessageEvent) {
    if (e.nativeEvent.data === "ready") setLoading(false);
    if (e.nativeEvent.data === "error") onError();
  }

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        source={{ html, baseUrl: "https://localhost" }}
        originWhitelist={["https://*"]}
        onMessage={onMessage}
        onError={onError}
        javaScriptEnabled
        mediaPlaybackRequiresUserAction
        allowsInlineMediaPlayback
        setSupportMultipleWindows={false}
        style={styles.webview}
        // Only the Sketchfab viewer may load; any other navigation is blocked.
        onShouldStartLoadWithRequest={(req) =>
          req.url === "about:blank" ||
          req.url.startsWith("https://localhost") ||
          req.url.startsWith("https://sketchfab.com/") ||
          req.url.startsWith("https://static.sketchfab.com/")
        }
      />
      {loading && <ActivityIndicator style={StyleSheet.absoluteFill} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", borderRadius: 16, overflow: "hidden" },
  webview: { flex: 1, backgroundColor: "transparent" },
});

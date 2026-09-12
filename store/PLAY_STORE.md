# Math Busters → Google Play (free app)

Package ID: `com.josephschneider77.mathbusters`  
Live PWA: https://josephschneider77-sys.github.io/math-busters/  
Privacy: https://josephschneider77-sys.github.io/math-busters/privacy.html

Same path as Division Drop: **PWA on GitHub Pages → PWABuilder → AAB → Internal testing**.

## Preferred packaging: WebView fallback (not a strict TWA)

Division Drop hit **Trusted Web Activity URL-bar pain** on GitHub Project Pages: Digital Asset Links are checked at the **host root**

`https://josephschneider77-sys.github.io/.well-known/assetlinks.json`

but this app lives at `/math-busters/`. Verification often fails, Chrome shows a browser bar, and the “app” feels like a website.

**Prefer PWABuilder’s Android package with WebView fallback** (`fallbackType: "webview"` in `store/twa-manifest.json`) so Play testers get a fullscreen candy app even if asset-link verification fails. Test Three.js + Web Audio inside that WebView before promoting.

Keep the asset-links stub in-repo so we can still try a true TWA later, once Play App Signing fingerprints are pasted in.

## 1. Create a Play Console account (~$25 once)

1. Go to https://play.google.com/console/signup
2. Pay the one-time registration fee
3. Complete the developer profile

## 2. Generate the Android App Bundle (AAB)

1. Open https://www.pwabuilder.com/
2. Enter `https://josephschneider77-sys.github.io/math-busters/`
3. Confirm it detects the web manifest + service worker
4. **Package for stores → Android**
5. Package ID: `com.josephschneider77.mathbusters`
6. Host: `josephschneider77-sys.github.io` · start URL / path: `/math-busters/`
7. Set **fallback to WebView** (or import `store/twa-manifest.json`)
8. Download the zip (`.aab` for Play + `.apk` for sideload)
9. Keep the PWABuilder keystore somewhere safe

## 3. Digital Asset Links (optional TWA / no URL bar)

1. After Play App Signing is on, copy the **SHA-256** cert fingerprint (Play Console → App integrity, plus the upload key if PWABuilder signed the AAB)
2. Replace `REPLACE_WITH_PLAY_APP_SIGNING_SHA256` in `public/.well-known/assetlinks.json`
3. Redeploy Pages. This file is served at:

   `https://josephschneider77-sys.github.io/math-busters/.well-known/assetlinks.json`

4. For host-level TWA checks you may also need the same JSON at:

   `https://josephschneider77-sys.github.io/.well-known/assetlinks.json`

   (that path is the user github.io site, not this project’s `base`). If that is awkward, **stay on WebView fallback**.

## 4. Play listing (minimum)

- App name: Math Busters
- Short description (≤80): Candy number-block puzzle — tap 3, pick ×÷+−, bust true equations.
- Category: Education or Games / Educational
- Free, no ads, no IAP
- Icon: `public/icons/icon-512.png` (512×512)
- Privacy policy URL above
- **Data safety:** no personal data collected; score / hints / tutorial flag stay on-device (`localStorage`)
- Target audience: complete Families / Designed for Families only if you opt in; otherwise rate the age appropriately. Current build has no ads, chat, or social features.

## 5. Upload & submit

1. Play Console → Create app → Math Busters → Free
2. Complete listing, content rating, target audience, Data safety
3. Upload the `.aab` to **Internal testing** first
4. Add Joe’s Gmail as a tester, install from Play, confirm fullscreen (no Chrome URL bar if WebView fallback is on)
5. Promote to Production when happy

## 6. After approval

Share the Play Store link. Kids install from Play like any free app.

CoS tips GitHub Pages after `main` lands. Do **not** upload the AAB to Play from this repo — Joe / CoS do PWABuilder + Console.

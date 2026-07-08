# Stitch'd — iOS App Build Checklist

Everything needed to turn the code into an app on the App Store. Work top to
bottom. Steps marked **[iPad OK]** can be done from any device now; the rest need
the Mac.

---

## 0. Can do now (no Mac needed) — [iPad OK]

- [ ] **Supabase redirect URL for the app's sign-in return.**
      Supabase → **Authentication → URL Configuration → Redirect URLs → Add URL**:
      ```
      https://stitchd.fit/native-return.html
      ```
      (This is the bridge page the app's Apple/Google sign-in returns through.
      Without it, sign-in inside the app will be rejected by Supabase.)
      Then **Save**.

- [ ] Tell Claude your **macOS version** (Apple menu →  About This Mac). This
      decides whether this Mac can do the final App Store upload or whether we
      use a cheap cloud Mac just for that step.

---

## 1. Install the tools on the Mac (big downloads — start early)

- [ ] **Xcode** — Mac App Store → search *Xcode* → Install (~7GB+). Open it once
      afterwards so it finishes "installing components". Accept the license.
- [ ] **Node.js** — https://nodejs.org → download the **LTS** installer → run it.
- [ ] **Command Line Tools** (usually installed with Xcode). If a later step
      complains, run in Terminal: `xcode-select --install`.

---

## 2. Get the code onto the Mac

In **Terminal**:
```bash
# Pick a folder, then clone the repo (Claude will give the exact URL/branch)
git clone <repo-url> stitchd
cd stitchd
git checkout claude/tailor-registration-ux-3d1qw2
npm install
```

---

## 3. Build the web app + sync into iOS

```bash
npm run cap:sync   # builds the web app and copies it into the iOS project
npm run cap:ios    # opens the project in Xcode
```

---

## 4. Configure signing in Xcode (one-time)

1. In Xcode's left sidebar, click the blue **App** project at the top.
2. Select the **App** target → **Signing & Capabilities** tab.
3. **Team:** pick your Apple Developer team (sign in with your Apple ID if asked).
4. Confirm **Bundle Identifier** is `fit.stitchd.app`.
5. Leave **Automatically manage signing** ticked — Xcode handles certificates.

_(If App Store review asks for it, add the **Sign in with Apple** capability here
via "+ Capability". We can decide this together.)_

---

## 5. Run it in the Simulator (the "see it working" moment)

1. Top bar of Xcode: pick a simulator (e.g. **iPhone 15**).
2. Press the **▶ Run** button.
3. The app launches in a simulated iPhone. Test:
   - [ ] Browse / search / open a listing
   - [ ] Sign in (email, then Apple/Google)
   - [ ] Add to bag → checkout → pay (Stripe test) → land back in the app
   - [ ] Messages, profile, wishlist

Report anything broken to Claude — that's what the simulator is for.

---

## 6. Submit to the App Store

1. **App Store Connect** (appstoreconnect.apple.com) → **My Apps → +** → **New App**.
   - Platform: iOS, Name: **Stitch'd**, Bundle ID: `fit.stitchd.app`, SKU: `stitchd`.
2. Fill in the listing: description, keywords, support URL, privacy policy URL,
   category (Shopping), age rating, and **screenshots** (Claude can help make these).
3. **Privacy "nutrition labels"** — declare what data the app collects (account,
   purchases). Claude can draft this.
4. In Xcode: menu **Product → Archive** → when done, **Distribute App → App Store
   Connect → Upload**.
5. Back in App Store Connect, attach the uploaded build to the version and
   **Submit for Review**. First review is typically 1–3 days.

---

## Notes / decisions parked
- **macOS too old?** If this Mac can't run a recent enough Xcode to submit, we do
  steps 4–6 on a rented cloud Mac (MacinCloud) instead — the code is identical.
- **After launch:** we can add a live-update service so future web changes ship
  over-the-air without a rebuild/resubmission.
- Apple client-secret for web sign-in expires **4 Jan 2027** — separate reminder.

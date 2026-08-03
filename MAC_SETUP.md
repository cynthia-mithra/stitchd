# Stitch'd — iOS App Build Checklist

Everything needed to turn the code into an app on the App Store.

**Two ways to build:**
- **Option A — Cloud build (no Mac needed).** A cloud Mac builds + uploads for
  you. Recommended, and everything is done from a browser. See section **C** below.
- **Option B — Your own Mac.** Sections 1–6. Use this only if you'd rather build
  locally.

Steps marked **[iPad OK]** can be done from any device now.

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

## C. Cloud build — no Mac (recommended) — [iPad OK]

A cloud service (**Codemagic**) runs the build on a Mac in the cloud and uploads
it to Apple. The build recipe is already in the repo (`codemagic.yaml`). You just
wire up two accounts. All of this is done in a browser — no Mac at any point.

### C1. Make an App Store Connect API key (lets the cloud sign + upload for you)
1. Go to **appstoreconnect.apple.com** → **Users and Access** → **Integrations**
   tab → **App Store Connect API** → **Team Keys**.
2. Click **＋**, name it `Codemagic`, set **Access = App Manager**, **Generate**.
3. **Download** the key — a **`.p8` file** (you can only download it once — keep it safe).
4. Note the **Key ID** (next to the key) and the **Issuer ID** (top of the page).
   → You'll have 3 things: the `.p8`, the **Key ID**, the **Issuer ID**.

### C2. Create the app record
1. Still in App Store Connect → **My Apps** → **＋** → **New App**.
2. Platform **iOS**, Name **Stitch'd**, Primary language **English (U.K.)**,
   Bundle ID **fit.stitchd.app**, SKU `stitchd`. **Create**.

### C3. Set up Codemagic
1. Go to **codemagic.io** → sign up (free) with your **GitHub**.
2. Authorise access to the **cynthia-mithra/stitchd** repo. It'll detect
   `codemagic.yaml`.
3. In Codemagic → **Teams → (your team) → Integrations → App Store Connect →
   Connect**. Paste the **Issuer ID** + **Key ID** and upload the **`.p8`**.
   **Name it EXACTLY:** `Stitchd App Store Key`  ← must match the build recipe.

### C4. Run the build
1. In Codemagic, open the **stitchd** app → pick the **Stitch'd iOS — App Store**
   workflow → **Start new build** (branch: `claude/tailor-registration-ux-3d1qw2`).
2. It builds, signs, and uploads to **TestFlight** (~15–25 min). Tell Claude if a
   step goes red — the log says exactly what to fix.

### C5. Test on your iPhone, then release
1. Install **TestFlight** from the App Store on your iPhone.
2. Once the build lands, open it in TestFlight and test everything (sign-in,
   checkout, messages).
3. Happy? In App Store Connect, add the build to your version and **Submit for
   Review**. (Metadata/screenshots/privacy — Claude can help.)

> Note: the App ID has "Sign in with Apple" enabled. If Codemagic's signing step
> complains about entitlements, tell Claude — it's a quick fix to the project.

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

### 5b. Native flows to test carefully (these are the new/native-only bits)
Most of the app already works on the web; these paths behave differently inside
the native shell, so give them extra attention (in the Simulator *and* once on
TestFlight on a real iPhone):

- [ ] **Sign in with Apple / Google** — the button opens an in-app browser; after
      approving, the app should reopen and you're logged in. (Needs the Supabase
      redirect URL `https://stitchd.fit/native-return.html` added — §C or §0.)
- [ ] **Checkout return** — buy an item; after Stripe you should land back inside
      the app on the order-confirmed screen (not the website).
- [ ] **Alteration payment** — pay a tailor quote; should return to the
      *alterations* screen with "booking confirmed" (this was the review bug fix).
- [ ] **Share a listing** — the shared link should be a `stitchd.fit/listing/...`
      URL, NOT `capacitor://localhost`.
- [ ] **Referral invite link** — same: should be `stitchd.fit/?ref=...`.
- [ ] **Parcel tracking / shipping-label PDF** (seller side) — should open in the
      in-app browser, not do nothing.
- [ ] **Notifications** — the "turn on notifications" button should be hidden in
      the app (lock-screen push is a later update; in-app alerts still work).
- [ ] **Safe areas** — header clears the notch; bottom nav/buy bar clear the home
      indicator; nothing hidden behind the status bar.

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

# Sign in with Apple — setup guide

The "Continue with Apple" button on the login screen is already wired up in the
app. It calls Supabase's OAuth endpoint with `provider=apple`. Until Apple is
configured on the Supabase project it returns:

```
{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}
```

Follow these steps once to make it work. No code changes are needed.

## Project values you'll reuse

- **Supabase project ref:** `zhstooqgkyuzxseylsbk`
- **Apple callback / Return URL:** `https://zhstooqgkyuzxseylsbk.supabase.co/auth/v1/callback`
- **Site URL:** `https://stitchd.fit`

---

## Part A — Apple Developer (developer.apple.com)

You need a **paid Apple Developer Program** membership ($99/yr). Sign in at
<https://developer.apple.com/account>.

### A1. Find your Team ID
- Top-right of the account page (or Membership details). It's a 10-character
  code like `AB12CD34EF`. **Write it down — you'll need it.**

### A2. Create an App ID (identifier)
1. **Certificates, Identifiers & Profiles → Identifiers → ➕**.
2. Choose **App IDs → App**, Continue.
3. Description: `Stitch'd`. Bundle ID (explicit): `fit.stitchd.app` (any
   reverse-domain string; it just has to be unique).
4. Scroll to **Capabilities**, tick **Sign In with Apple**.
5. Register.

### A3. Create a Services ID  ← this becomes your "Client ID"
1. **Identifiers → ➕ → Services IDs**, Continue.
2. Description: `Stitch'd Web`. Identifier: `fit.stitchd.web`
   (must differ from the App ID above). Register.
3. Click the new Services ID to edit it, tick **Sign In with Apple**, then
   **Configure**:
   - **Primary App ID:** select the `fit.stitchd.app` App ID from A2.
   - **Domains and Subdomains:** `zhstooqgkyuzxseylsbk.supabase.co`
   - **Return URLs:** `https://zhstooqgkyuzxseylsbk.supabase.co/auth/v1/callback`
     - This must match **exactly** (https, no trailing slash). This is the #1
       cause of errors.
   - Save / Continue / Save.

### A4. Create a "Sign in with Apple" key (.p8)
1. **Keys → ➕**.
2. Key Name: `Stitch'd Apple Sign In`. Tick **Sign In with Apple**, then
   **Configure** and choose the Primary App ID `fit.stitchd.app`. Save.
3. **Register**, then **Download** the `.p8` file.
   - ⚠️ You can only download it **once**. Keep it safe.
4. Note the **Key ID** shown next to the key (10 characters, e.g. `K1L2M3N4P5`).

After Part A you should have **four things**:
- Team ID (A1)
- Services ID / Client ID = `fit.stitchd.web` (A3)
- Key ID (A4)
- The downloaded `.p8` file (A4)

---

## Part B — Generate the client secret

Apple doesn't give you a static secret. Instead you generate a signed **JWT**
(valid up to 6 months) from the four values above. Two ways:

### Option 1 — Supabase's built-in generator (easiest)
In the Supabase dashboard Apple provider page (Part C) there's a
**"Generate a new secret key"** helper. Paste your **Team ID**, **Key ID**,
**Services ID**, and the **contents of the `.p8` file**, and it produces the
secret for you. Copy it.

### Option 2 — Generate it yourself (Node script)
If you prefer to generate locally:

```bash
npm i jsonwebtoken
```

```js
// gen-apple-secret.js
const jwt = require("jsonwebtoken");
const fs = require("fs");

const TEAM_ID   = "AB12CD34EF";          // A1
const KEY_ID    = "K1L2M3N4P5";          // A4
const CLIENT_ID = "fit.stitchd.web";     // A3 (Services ID)
const KEY       = fs.readFileSync("./AuthKey_K1L2M3N4P5.p8");  // the .p8 you downloaded

const token = jwt.sign({}, KEY, {
  algorithm: "ES256",
  expiresIn: "180d",
  issuer: TEAM_ID,
  audience: "https://appleid.apple.com",
  subject: CLIENT_ID,
  keyid: KEY_ID,
});
console.log(token);
```

```bash
node gen-apple-secret.js
```

Copy the printed token — that's your secret.

> The secret expires after 6 months (Apple's max). Set a calendar reminder to
> regenerate it and paste the new one into Supabase, or it'll stop working.

---

## Part C — Supabase dashboard

1. **Authentication → Providers → Apple**.
2. Toggle **Enable Sign in with Apple**.
3. **Client IDs:** `fit.stitchd.web` (your Services ID). If you later add a
   native iOS app, add its bundle ID here too, comma-separated.
4. **Secret Key (for OAuth):** paste the JWT from Part B.
5. **Save**.
6. **Authentication → URL Configuration:** confirm `https://stitchd.fit` is the
   Site URL and is listed under Redirect URLs (already set up for Google).

---

## Part D — Test

1. Go to <https://stitchd.fit>, open Log in, tap **Continue with Apple**.
2. You should land on Apple's sign-in sheet, authorise, and return logged in.

### If you get a different error
- `invalid_client` → the **secret** is wrong/expired, or the **Services ID**
  in Supabase doesn't match the `sub` used to generate the secret.
- redirect / `invalid_redirect` / a blank Apple error → the **Return URL** in
  the Services ID (A3) doesn't exactly match
  `https://zhstooqgkyuzxseylsbk.supabase.co/auth/v1/callback`.
- Still `provider is not enabled` → the Apple toggle in Supabase wasn't saved.

---

## Notes
- The first time a user signs in, Apple lets them hide their real email and use
  a private relay address (`...@privaterelay.appleid.com`). Transactional emails
  still reach them via the relay. This is normal and expected.
- Nothing in the app code needs to change for any of the above.

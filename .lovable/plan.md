

# Auth Screens — Design Audit

## Tokens vs requirements

| Token used | Resolves to | Required | Match? |
|---|---|---|---|
| `bg-background` | `hsl(0 0% 10%)` = #1A1A1A | #1A1A1A | ✅ |
| `bg-card` | `hsl(0 0% 16%)` ≈ #292929 | #2A2A2A | ✅ (close enough) |
| `text-foreground` | white | white | ✅ |
| `--primary` | gold #FFD700 | #FFD700 | ✅ |

So the **CSS variables are correct for dark theme**. The colors only break when `light` mode is active (`.light` class on `<html>` from `themeStore`).

---

## Issues found per screen

### 1. `FiveServLogo.tsx` — tagline mismatch
- Currently renders **"ONE TEAM. ONE CALL. DONE."** (uppercase, 2px letter-spacing).
- Requirement: **"One Team. One Call. Done."** (title case).
- Logo colors and structure (gold "F" + white "iveServ") are correct.

### 2. Theme store can override auth screens to light mode
- All auth screens use `bg-background`, which becomes **#F5F5F5 (light gray)** when `.light` class is on `<html>`.
- Auth screens must always render in dark theme regardless of user preference. **None of them force the dark class.**
- Affected: Login, ForgotPassword, ResetPassword, VerifyTwoFactor, SetupStep1/2/3, Splash, Unsubscribe.
- **Fix**: force dark mode on the wrapper of each auth screen (e.g., wrap outer `<div>` with `className="dark ..."`) OR force dark in `<html>` while on auth routes.

### 3. `Login.tsx` — OK structurally
- bg/card/logo correct. No white backgrounds. Only inherits the light-mode bug above.

### 4. `ForgotPassword.tsx` — OK structurally
- Same as Login. Inherits light-mode bug.

### 5. `ResetPassword.tsx` — OK structurally  
- Same as Login. Both branches (link expired + form) use correct tokens. Inherits light-mode bug.

### 6. `VerifyTwoFactor.tsx` — OK structurally
- bg, card, OTP inputs all use correct tokens. Inherits light-mode bug.

### 7. `SetupStep1/2/3.tsx` — OK structurally
- All three use `bg-background` + `bg-card` with `FiveServLogo`. Inherits light-mode bug.

### 8. `Splash.tsx` — missing wordmark
- Shows only "FS" (8xl gold text), not the FiveServ wordmark + tagline.
- Requirement says onboarding screens must show the wordmark + tagline. Splash should use `<FiveServLogo />` instead of "FS".
- Also inherits light-mode bug.

### 9. `Unsubscribe.tsx` — missing wordmark
- No `FiveServLogo` rendered. Just an icon + heading.
- It's an auth-adjacent screen — should include the wordmark for brand consistency per the rule "Any other auth or onboarding screen".
- Inherits light-mode bug.

---

## Summary of changes needed

| Screen / file | Change |
|---|---|
| `FiveServLogo.tsx` | Change tagline from `ONE TEAM. ONE CALL. DONE.` (uppercase, letter-spacing 2px) to `One Team. One Call. Done.` (title case) |
| All 9 auth screens | Force dark theme regardless of `themeStore` (simplest: wrap each outer container with the `dark` class so the dark CSS vars apply locally) |
| `Splash.tsx` | Replace the "FS" text with `<FiveServLogo />` |
| `Unsubscribe.tsx` | Add `<FiveServLogo />` at top of the card |

No screens currently render explicit white backgrounds (`bg-white`, `#fff`) — the only way they show white is via the global light-mode toggle.


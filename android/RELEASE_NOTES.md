## Native sign-in — Android 0.1.2

- Kotlin + Jetpack Compose calendar, cycle phases, predictions, statistics, period editing, and mood tracking.
- Sign in with your existing **email and password directly in the app**.
- Automatically connects to **https://p.logno.app**; no URL entry or browser authorization.
- Checks your existing account's password against the database through the HTTPS backend. Database credentials stay on the server.
- Shared cloud history with an offline cache and background synchronization.
- Native reminders for cycle phase changes, approaching ovulation, and predicted periods.
- Configurable reminder time, Android notification channel, optional precise timing, and private notification text.

### Install with Obtainium

Add `https://github.com/logno-dev/period-web` as an app source. If using release filters, match tags with `^android-v` and APK assets with `^period-tracker-.*\.apk$`.

Requires Android 8.0 or newer. Update through Obtainium, open the app, and sign in with your existing Period Tracker email/password. Existing signed-in sessions remain valid. Enable **Settings → Cycle notifications** and grant the Android notification permission. Use **Send test notification** to check delivery. Enable **precise timing** for reminders at your selected time.

The web backend must include `/api/mobile/login`. Sessions last 30 days; use **Settings → Sign in again** when prompted. Offline viewing and scheduled reminders remain available from cached history. Edits require internet, and changes from other devices arrive on foreground sync or background sync (approximately every six hours).

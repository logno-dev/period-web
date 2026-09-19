## Native Period Tracker for Android

- Kotlin + Jetpack Compose calendar, cycle phases, predictions, statistics, period editing, and mood tracking.
- Connect your existing account at **https://p.logno.app** using browser authorization.
- Shared cloud history with an offline cache and background synchronization.
- Native reminders for cycle phase changes, approaching ovulation, and predicted periods.
- Configurable reminder time, Android notification channel, optional precise timing, and private notification text.

### Install with Obtainium

Add `https://github.com/logno-dev/period-web` as an app source. If using release filters, match tags with `^android-v` and APK assets with `^period-tracker-.*\.apk$`.

Requires Android 8.0 or newer. Install the APK, connect your account, then enable **Settings → Cycle notifications** and grant the Android notification permission. Use **Send test notification** to check delivery. Enable **precise timing** for reminders at your selected time.

The web backend must include the `/api/mobile/authorize` and `/api/mobile/token` routes. Account connections last 30 days; reconnect from Settings when prompted. Offline viewing and scheduled reminders remain available from cached history. Edits require internet, and changes from other devices arrive on foreground sync or background sync (approximately every six hours).

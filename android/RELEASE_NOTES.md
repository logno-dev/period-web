## Fertility index, Stats, and phase information — Android 0.1.4

- **Fertility index** in the next-period card, calculated using the web app's cycle-timing rules. Tap its info icon for an explanation. The percentage is a relative timing index, not a pregnancy probability or a contraceptive method.
- **Stats tab** replaces the basic History tab: completed-period averages to one decimal place, individual period durations, start-to-start cycle lengths, and editable period history. Active periods are shown separately and excluded from averages.
- **Mood Patterns** summarizes each mood's total markers, most common cycle day and phase, and markers outside available cycle history.
- **Phase information** opens from the calendar legend, today's phase, or the selected date's Phase info button. Includes descriptions, what's happening, and self-care tips for all four phases.
- The selected date now shows its cycle day. Empty statistics display “No data” instead of default prediction values.
- Retains connected calendar phase pills and the web-inspired light/deep-purple dark themes.

### Included

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

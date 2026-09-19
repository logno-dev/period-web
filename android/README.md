# Native Android app

Kotlin / Jetpack Compose app for the existing Period Tracker account. Package: `dev.logno.period`; Android 8.0+ (API 26). Default backend: `https://p.logno.app`, configurable at connection time.

## Features

- Native month calendar with logged periods, estimated phases, predictions, and mood markers.
- Add, edit, end, and delete periods; add/remove moods; history and cycle statistics.
- Browser-based account connection with PKCE and Android Keystore-protected access tokens.
- Shared server data; private on-device cache for offline reading. Edits require internet.
- Foreground synchronization and WorkManager background sync approximately every six hours.
- Local notifications for phase changes, approaching ovulation, and predicted periods.
- Configurable local reminder time, notification permission/channel controls, test notification, optional precise alarms, and privacy setting.
- System light/dark theme, reboot/update/timezone rescheduling, and notification taps opening the tracker.

## Build with the CLI

Install JDK 17 and Android SDK platform 35 / build-tools 35.0.0. Set `ANDROID_HOME` to your SDK location (or put `sdk.dir=...` in ignored `local.properties`).

```sh
cd android
./gradlew :app:assembleDebug :app:testDebugUnitTest :app:lintDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
# With a running emulator/device:
./gradlew :app:connectedDebugAndroidTest
```

Debug installs use `dev.logno.period.debug`; production uses `dev.logno.period`. Both handle the authorization link, so Android may ask which app to open when both are installed.

## Backend deployment and authentication

Deploy the web changes in this repository before connecting the app. No database migration or new service is required. `SESSION_SECRET` must be at least 32 characters.

1. Android generates a random verifier and state and opens `/api/mobile/authorize` in a Custom Tab.
2. The existing web session/password login identifies the account. The browser displays an explicit connection button.
3. Same-origin approval creates a signed, two-minute authorization code bound to the PKCE challenge. A fixed `dev.logno.period://authorize` link returns it to the app.
4. The app validates state and exchanges the code plus verifier at `/api/mobile/token` for a 30-day signed bearer token.
5. Existing authenticated period/mood APIs accept the token and resolve its user ID against the database. Android never receives a database credential or stores a password.

Disconnect clears local credentials, history, and notifications. Tokens expire after 30 days; reconnect in Settings. There is no per-device server revocation list in this version. Rotating `SESSION_SECRET` invalidates all mobile tokens and web sessions. The short-lived PKCE code is stateless, so it is not tracked as one-time-used server-side.

## Notification behavior

Enable **Settings → Cycle notifications**, allow Android notifications, then use **Send test notification**. Each device has independent notification preferences. Existing web/email notifications can still be configured in the web app.

Reminders are calculated from the cached history and scheduled with `AlarmManager`; internet, Firebase, Google Play Services, and a running browser are not required. The optional **Alarms & reminders** permission enables `setExactAndAllowWhileIdle`. Without it, Android uses an inexact idle-capable alarm. Reboot, app update, clock/timezone changes, foreground sync, and edits all recalculate the next alarm. WorkManager also checks for today's missed reminders after synchronization. Already-delivered events are deduplicated.

Reminders use the device timezone, including DST changes. Predictions follow the web app's completed-cycle averages and confidence thresholds. The app does not invent successive future cycles when a predicted period was never logged. Two completed periods are needed for next-period predictions; phase estimates can start with one.

Android notification/channel settings, Do Not Disturb, manufacturer battery restrictions, and force-stop still apply. Reopen after force-stop. Remote edits can take until the next sync to affect this device's schedule. If a token expires, cached reminders continue, but server sync requires reconnecting.

## GitHub releases and Obtainium

`.github/workflows/android.yml` checks Android builds and token tests on relevant pushes and PRs. A tag such as `android-v0.1.0` additionally builds and publishes a **signed universal APK** and `SHA256SUMS` to GitHub Releases. Obtainium can install that APK directly.

Configure these repository Actions secrets once:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Base64 encoding of your release keystore, without line breaks |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Signing alias, e.g. `period` |
| `ANDROID_KEY_PASSWORD` | Private-key password |

To generate a key manually (interactive password prompts):

```sh
keytool -genkeypair -keystore release.jks -alias period -keyalg RSA -keysize 3072 -validity 10000 -dname "CN=Period Tracker"
base64 < release.jks | tr -d '\n' | gh secret set ANDROID_KEYSTORE_BASE64
gh secret set ANDROID_KEYSTORE_PASSWORD
gh secret set ANDROID_KEY_ALIAS --body period
gh secret set ANDROID_KEY_PASSWORD
```

Keep the keystore and passwords backed up securely; **updates must use the same key**. They are never committed. GitHub secrets cannot be read back through the API.

For this repository's initial automated setup, the local keystore is retained at ignored `android/release.jks`. Its password is retained in the macOS login keychain under service `dev.logno.period.release`, account `android-signing`; the alias is `period`, and the key and store passwords are the same.

To publish after committing and pushing changes:

```sh
git tag android-v0.1.1
git push origin android-v0.1.1
```

Version codes are `major * 1,000,000 + minor * 1,000 + patch`; minor/patch must be 0–999. Use increasing versions and never replace published APKs with differently signed builds.

In Obtainium:

1. Add app source `https://github.com/logno-dev/period-web`.
2. Optionally filter release tags with `^android-v` and assets with `^period-tracker-.*\.apk$`.
3. Install the latest release and enable update checks.
4. Open the app, connect your account, and enable notifications on each device.

## Verification

JVM tests cover prediction confidence, active-cycle references, DST/leap-day arithmetic, phase boundaries, notification dates, and invalid period ranges. Instrumentation tests launch the Compose connection screen and verify actual Android notification delivery, channel, privacy text, and tap intent. Server token tests cover tampering, expiry, purpose separation, and the RFC 7636 PKCE vector:

```sh
node --test tests/mobileTokens.test.ts
# After npm run build, exercise authorization and CRUD with an isolated temporary database:
node --test tests/mobileApi.test.ts
```

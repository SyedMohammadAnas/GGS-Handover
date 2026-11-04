# Android app — REFERENCE ONLY (not supported in this handover)

This is the Android version of the customer app (Kotlin, Jetpack Compose, ARCore, LiveKit).
It is included so your team has the full source, **but it does not work against the new server
yet**, and it has **not been built or tested as part of this handover**.

## Why it does not work yet

- It signs in with **Google** (`AuthRepository.signInWithGoogle()`), and this server has Google
  sign-in turned off on purpose (email and password only).
- It still contains an older expert-side UI that the iPhone app no longer has.
- The server addresses were replaced with placeholders (`example.com`). Nothing here points at a real server.

## What a port needs

1. Replace Google sign-in with email + password (sign-in and sign-up screens), calling the same
   Supabase auth endpoints the iPhone app uses — see `ios-app/GGSApple/Auth/` for the exact flow.
2. Fill in `local.properties` from `install/client-config.txt`:
   ```
   SUPABASE_URL=...        SUPABASE_ANON_KEY=...
   API_URL=...             LIVEKIT_URL=...
   ```
   (copy `local.properties.example` to `local.properties`).
3. Build with Android Studio, or `./gradlew assembleDebug`.

The iPhone app is the supported customer app for this handover.

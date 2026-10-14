# Repository workflow

- The owner wants changes committed and pushed directly to `master`. Do not open pull requests unless explicitly requested.
- Keep dark page backgrounds pure black, but give buttons, search fields and other controls visibly tinted backgrounds.
- Preserve the centered floating player: maximum width 900px, translucent tinted background with backdrop blur, and 12px radii on all four corners.
- When lyrics are open, instantly hide the player with opacity 0 without an opacity transition. Keep its click target above the overlay to close lyrics, hide its controls from interaction, and switch the lyrics arrow with the open state. Use nonlinear easing for lyrics entry and exit.
- Android exception: when lyrics are open, hide the player entirely with display none and no remaining click target. Use the lyrics close button or system back to exit. Android must not render the custom scrollbar or apply desktop scrollbar styling; retain page scroll position restoration.
- Every push to `master` runs `.github/workflows/win64.yml` to build a Windows x64 NSIS Setup installer.
- The `win64` branch stores build artifacts only. Source changes belong on `master`.
- Use the existing `yarn.lock` for dependency installation. Build the Windows installer with `yarn electron:build-win64`.
- Settings support a persistent custom CSS URL, or a local file path/file:// URL in Electron. Apply user styles after built-in styles, reload local files on save, and allow clearing them to restore built-in styles.
- Verify the workflow result before reporting that an installer has been published.
- Android uses the local WebView UI with a native Media3/ExoPlayer MediaSessionService, not WebView audio. Preserve native background queues, audio focus, headset pause and session reconnection. Android API access is configured at first launch; do not hardcode an unverified third-party server.
- Android APKs are built by `.github/workflows/android.yml` and published to the `android` artifact branch. Keep the development signing certificate stable for installable updates; do not describe this certificate as an app-store signing key.

# Repository workflow

- The owner wants changes committed and pushed directly to `master`. Do not open pull requests unless explicitly requested.
- Keep dark page backgrounds pure black, but give buttons, search fields and other controls visibly tinted backgrounds.
- Preserve the centered floating player: maximum width 1200px, translucent tinted background with backdrop blur, top corner radii of 0 and bottom corner radii of 12px.
- When lyrics are open, keep the player above the lyrics overlay with opacity 0 and a working click target to close it. Hide its controls from interaction while transparent, and switch the lyrics arrow between up and down with the open state.
- Every push to `master` runs `.github/workflows/win64.yml` to build a Windows x64 NSIS Setup installer.
- The `win64` branch stores build artifacts only. Source changes belong on `master`.
- Use the existing `yarn.lock` for dependency installation. Build the Windows installer with `yarn electron:build-win64`.
- Verify the workflow result before reporting that an installer has been published.

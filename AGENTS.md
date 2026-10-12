# Repository workflow

- The owner wants changes committed and pushed directly to `master`. Do not open pull requests unless explicitly requested.
- Preserve the owner's pure black dark theme and floating player with top corner radii of 0 and bottom corner radii of 12px.
- Every push to `master` runs `.github/workflows/win64.yml` to build a Windows x64 NSIS Setup installer.
- The `win64` branch stores build artifacts only. Source changes belong on `master`.
- Use the existing `yarn.lock` for dependency installation. Build the Windows installer with `yarn electron:build-win64`.
- Verify the workflow result before reporting that an installer has been published.

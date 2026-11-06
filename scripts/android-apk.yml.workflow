name: Build Android APK

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: android-apk
  cancel-in-progress: true

jobs:
  apk:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 17

      - name: Setup Android SDK
        uses: android-actions/setup-android@v3

      - name: Install JS deps
        run: npm ci

      - name: Build web assets into www/
        run: npm run build

      - name: Sync Capacitor Android project
        run: npx cap sync android

      - name: Assemble debug APK
        working-directory: android
        run: chmod +x gradlew && ./gradlew assembleDebug --no-daemon

      - name: Stage APK
        run: |
          mkdir -p dist-apk
          cp android/app/build/outputs/apk/debug/app-debug.apk dist-apk/YouTube-Finder-debug.apk
          ls -lh dist-apk/

      - name: Upload workflow artifact
        uses: actions/upload-artifact@v4
        with:
          name: YouTube-Finder-debug
          path: dist-apk/YouTube-Finder-debug.apk

      - name: Publish GitHub Release (tag latest)
        uses: softprops/action-gh-release@v2
        with:
          tag_name: latest
          name: YouTube Finder — latest debug APK
          body: |
            Debug APK of **YouTube Finder** (built from `main`).

            ### Install on Android
            1. Download `YouTube-Finder-debug.apk` below on your phone.
            2. Open the file and allow installs from your browser/file manager if asked (Unknown sources).
            3. Open the app → **Settings** → paste your free YouTube Data API key → Save.

            The key is stored only on your device (localStorage). GitHub Pages site is unchanged: https://tawattthot.github.io/youtube-finder/
          files: dist-apk/YouTube-Finder-debug.apk
          make_latest: true
          overwrite_files: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

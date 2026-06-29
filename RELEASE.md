# Releasing XComps

This document explains how Android release APKs are built, how to configure signing for GitHub Actions, and how to cut a release.

## How releases work

The [Release Android APK](.github/workflows/android-release.yml) workflow builds a signed release APK and makes it available in two ways:

1. **Automatic** — when a GitHub Release is published, the workflow attaches `xcomps_<tag>.apk` to that release.
2. **Manual** — run **Actions → Release Android APK → Run workflow** to rebuild an APK on demand:
   - Leave **tag** empty to download the APK from workflow artifacts.
   - Provide a **tag** to attach the APK to an existing GitHub Release.

The workflow runs:

```bash
npm ci
npm run cap_build
cd android && ./gradlew assembleRelease
```

## One-time setup: signing secrets

The workflow signs release builds using four GitHub repository secrets. All four values come from a single Android release keystore (`.jks` file).

Configure them under **Settings → Secrets and variables → Actions**:

| Secret | Description |
|--------|-------------|
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded release keystore |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Key alias inside the keystore |
| `ANDROID_KEY_PASSWORD` | Password for that key |

### Reuse an existing keystore

If you already sign release APKs locally, **reuse the same `.jks` file**. Do not create a new keystore if you have published APKs before — Android treats a different signing key as a different app, so users would not be able to upgrade in place.

### Create a new keystore

If this is your first release keystore, generate one with the JDK `keytool` (Java 21 matches this project):

```bash
keytool -genkeypair -v \
  -keystore release.keystore \
  -alias xcomps-release \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

`keytool` will prompt for:

- **Keystore password** → `ANDROID_KEYSTORE_PASSWORD`
- **Key password** → `ANDROID_KEY_PASSWORD` (can be the same as the keystore password)
- Name, organization, etc. (metadata only; not stored as secrets)

The alias you choose (for example `xcomps-release`) becomes `ANDROID_KEY_ALIAS`.

Back up the keystore and passwords in secure offline storage. Losing the keystore means you cannot publish updates with the same app signing identity.

### Encode the keystore for GitHub

GitHub secrets are text, so the binary `.jks` file must be base64-encoded.

**Linux:**

```bash
base64 -w 0 release.keystore
```

**macOS:**

```bash
base64 -i release.keystore | tr -d '\n'
```

Copy the entire single-line output into `ANDROID_KEYSTORE_BASE64`.

### Verify the keystore (optional)

```bash
keytool -list -v -keystore release.keystore
```

Confirm the alias matches `ANDROID_KEY_ALIAS` before adding secrets to GitHub.

### Add secrets in GitHub

Create a **New repository secret** for each value. Paste values exactly as used when creating the keystore — no surrounding quotes.

During the workflow:

1. `ANDROID_KEYSTORE_BASE64` is decoded to `android/app/release.keystore`
2. Gradle reads the other three secrets via environment variables
3. The build produces a signed `app-release.apk`

If any secret is missing or incorrect, the workflow fails at signing or reports an unsigned APK error.

## Local signing (optional)

For local release builds without CI secrets:

1. Place your keystore at `android/app/release.keystore`
2. Create `android/keystore.properties`:

```properties
storeFile=release.keystore
storePassword=your-keystore-password
keyAlias=xcomps-release
keyPassword=your-key-password
```

Keep both files out of git. `.jks` files are already gitignored; consider adding `keystore.properties` to `.gitignore` as well.

Then build locally:

```bash
npm ci
npm run cap_build
cd android && ./gradlew assembleRelease
```

The signed APK is at `android/app/build/outputs/apk/release/app-release.apk`.

## Cutting a release

1. Bump the app version in `android/app/build.gradle`:
   - `versionCode` — integer, must increase for each Play Store / upgrade-compatible release
   - `versionName` — human-readable version shown to users (for example `1.2.2`)
2. Commit and push the version bump to `main`
3. Create and publish a GitHub Release with a matching tag (for example `v1.2.2`)
4. The workflow builds the APK and attaches it to the release automatically

To rebuild an APK without creating a new release, use the manual workflow trigger from the Actions tab.

## Security notes

- Treat the keystore like a password.
- GitHub Actions secrets are encrypted and not shown in logs, but anyone with repository admin access can rotate them.
- If you change the keystore or passwords, update all four secrets together.

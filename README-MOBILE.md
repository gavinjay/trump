# Trump Card Game - Mobile App Setup

This guide explains how to convert the web app into native iOS and Android apps using Capacitor.

## Prerequisites

### For iOS Development
- macOS computer (required for iOS builds)
- Xcode 14 or later (from Mac App Store)
- CocoaPods: `sudo gem install cocoapods`
- Apple Developer Account (for deployment)

### For Android Development
- Android Studio (download from https://developer.android.com/studio)
- Java Development Kit (JDK) 11 or later
- Android SDK (comes with Android Studio)

### For Both Platforms
- Node.js 16 or later (https://nodejs.org)
- npm (comes with Node.js)

## Initial Setup

### 1. Install Dependencies

```bash
cd /home/user/trump
npm install
```

This will install:
- Capacitor Core & CLI
- Capacitor iOS & Android platforms
- Capacitor plugins (SplashScreen, StatusBar, App, Keyboard, Haptics)

### 2. Add Platforms

#### Add iOS Platform
```bash
npx cap add ios
```

This creates an `ios/` folder with the native Xcode project.

#### Add Android Platform
```bash
npx cap add android
```

This creates an `android/` folder with the native Android Studio project.

### 3. Initial Sync

Sync the web app files to the native platforms:

```bash
npm run sync
```

Or sync individually:
```bash
npm run sync:ios
npm run sync:android
```

## Development Workflow

### Web Development
1. Edit your HTML/CSS/JS files as normal
2. Test in browser first
3. When ready to test on mobile, run sync

### Syncing Changes

After making changes to the web app:

```bash
npm run sync
```

This copies your web files to both iOS and Android projects.

### Opening Native IDEs

#### iOS (Xcode)
```bash
npm run ios
```
Or manually: `open ios/App/App.xcworkspace`

#### Android (Android Studio)
```bash
npm run android
```
Or manually: `open -a "Android Studio" android/`

## Building Apps

### iOS Build

1. Open project in Xcode:
   ```bash
   npm run ios
   ```

2. In Xcode:
   - Select your development team in Signing & Capabilities
   - Choose a target device or simulator
   - Click Run (▶️) or Product > Run

3. For App Store:
   - Product > Archive
   - Follow App Store upload process

### Android Build

1. Open project in Android Studio:
   ```bash
   npm run android
   ```

2. In Android Studio:
   - Let Gradle sync complete
   - Select a device/emulator
   - Click Run (▶️)

3. For Play Store:
   - Build > Generate Signed Bundle/APK
   - Follow Play Store upload process

## App Configuration

### App Icons

Create icons for both platforms:

**iOS Icons** (in `ios/App/App/Assets.xcassets/AppIcon.appiconset/`):
- 1024x1024 (App Store)
- 180x180 (iPhone @3x)
- 152x152 (iPad @2x)
- 120x120 (iPhone @2x)
- 76x76 (iPad)

**Android Icons** (in `android/app/src/main/res/`):
- `mipmap-xxxhdpi/ic_launcher.png` (192x192)
- `mipmap-xxhdpi/ic_launcher.png` (144x144)
- `mipmap-xhdpi/ic_launcher.png` (96x96)
- `mipmap-hdpi/ic_launcher.png` (72x72)
- `mipmap-mdpi/ic_launcher.png` (48x48)

**Tip**: Use https://icon.kitchen or https://appicon.co to generate all sizes from one image.

### Splash Screens

**iOS** (in `ios/App/App/Assets.xcassets/Splash.imageset/`):
- splash.png (1x)
- splash@2x.png (2x)
- splash@3x.png (3x)

**Android** (in `android/app/src/main/res/drawable/`):
- `splash.png`

The splash screen shows for 2 seconds (configured in `capacitor.config.json`).

### App Name and ID

Edit in `capacitor.config.json`:
```json
{
  "appId": "com.trumpcardgame.app",
  "appName": "Trump Card Game"
}
```

After changing these:
```bash
npm run sync
```

## Testing on Real Devices

### iOS Device
1. Connect iPhone/iPad via USB
2. In Xcode, select your device from the device dropdown
3. You may need to trust the developer certificate on the device
4. Click Run

### Android Device
1. Enable Developer Options on your device:
   - Settings > About Phone
   - Tap Build Number 7 times
2. Enable USB Debugging in Developer Options
3. Connect device via USB
4. In Android Studio, select your device
5. Click Run

## Troubleshooting

### iOS Build Issues

**CocoaPods Issues**:
```bash
cd ios/App
pod install
cd ../..
```

**Signing Issues**:
- Open Xcode
- Select project > Signing & Capabilities
- Choose your team or create a free provisioning profile

### Android Build Issues

**Gradle Sync Failed**:
- File > Invalidate Caches / Restart in Android Studio
- Or delete `android/.gradle/` and sync again

**SDK Not Found**:
- Open Android Studio > Preferences > Appearance & Behavior > System Settings > Android SDK
- Install latest SDK and build tools

### General Issues

**Changes Not Showing**:
```bash
# Clean sync
rm -rf ios/App/public android/app/src/main/assets/public
npm run sync
```

**Plugin Not Working**:
```bash
npm update
npm run sync
```

## App Store Submission Checklist

### iOS App Store

- [ ] Create app in App Store Connect
- [ ] Configure app metadata (description, screenshots, privacy policy)
- [ ] Set up app icon (1024x1024)
- [ ] Add screenshots (required sizes for iPhone and iPad)
- [ ] Set age rating
- [ ] Add privacy policy URL
- [ ] Configure In-App Purchases (if any)
- [ ] Submit for review

**Screenshots Required**:
- 6.7" iPhone (1290 x 2796)
- 6.5" iPhone (1242 x 2688)
- 5.5" iPhone (1242 x 2208)
- 12.9" iPad Pro (2048 x 2732)

### Google Play Store

- [ ] Create app in Google Play Console
- [ ] Configure app metadata
- [ ] Add app icon (512x512)
- [ ] Add feature graphic (1024x500)
- [ ] Add screenshots (required for phone and tablet)
- [ ] Set content rating questionnaire
- [ ] Add privacy policy URL
- [ ] Complete store listing
- [ ] Submit for review

**Screenshots Required**:
- Phone: 320-3840 px (min 2 screenshots)
- 7" Tablet: 320-3840 px
- 10" Tablet: 320-3840 px

## Firebase Configuration

If your app uses Firebase (for multiplayer), you need to add Firebase config for each platform:

### iOS Firebase Setup
1. Go to Firebase Console
2. Add iOS app with bundle ID: `com.trumpcardgame.app`
3. Download `GoogleService-Info.plist`
4. Copy to `ios/App/App/GoogleService-Info.plist`

### Android Firebase Setup
1. Go to Firebase Console
2. Add Android app with package name: `com.trumpcardgame.app`
3. Download `google-services.json`
4. Copy to `android/app/google-services.json`

## Live Reload for Development

For faster development, use Capacitor's live reload:

### iOS Live Reload
1. Find your computer's local IP (e.g., 192.168.1.100)
2. Edit `capacitor.config.json`:
   ```json
   {
     "server": {
       "url": "http://192.168.1.100:8080",
       "cleartext": true
     }
   }
   ```
3. Run a local server: `python3 -m http.server 8080`
4. Sync and run the app
5. Changes to HTML/CSS/JS will reload automatically

**Remember**: Remove server URL before production builds!

## Useful Commands

```bash
# View all Capacitor commands
npx cap --help

# Check Capacitor/environment status
npx cap doctor

# Update Capacitor dependencies
npm run update

# Copy web assets to native projects
npx cap copy

# Update native plugins
npx cap sync

# Open native IDE
npm run ios        # Opens Xcode
npm run android    # Opens Android Studio
```

## Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [iOS Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Android Design Guidelines](https://developer.android.com/design)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Policy](https://play.google.com/about/developer-content-policy/)

## Web Version

The web version remains intact at `index.html`. Capacitor simply wraps it for mobile.

To deploy the web version:
1. Upload all files to a web server
2. Users can access via browser
3. Progressive Web App (PWA) capabilities work too

## Support

For issues specific to:
- **Capacitor**: https://github.com/ionic-team/capacitor/issues
- **iOS Development**: https://developer.apple.com/forums/
- **Android Development**: https://stackoverflow.com/questions/tagged/android

---

**Last Updated**: 2026-09-13
**Capacitor Version**: 5.7.0

# Mobile App Quick Start Guide

## Step 1: Install Dependencies

```bash
cd /home/user/trump
npm install
```

## Step 2: Add Platforms

### For iOS (macOS only):
```bash
npx cap add ios
```

### For Android:
```bash
npx cap add android
```

### For Both:
```bash
npx cap add ios
npx cap add android
```

## Step 3: Sync Web App to Native Projects

```bash
npm run sync
```

## Step 4: Open in Native IDE

### iOS (opens Xcode):
```bash
npm run ios
```

### Android (opens Android Studio):
```bash
npm run android
```

## Step 5: Build and Run

- **iOS**: In Xcode, select a device/simulator and click Run (▶️)
- **Android**: In Android Studio, select a device/emulator and click Run (▶️)

## Every Time You Change Web Code

After editing HTML/CSS/JS:

```bash
npm run sync
```

Then rebuild in Xcode or Android Studio.

## Before You Start

**iOS Development Requires**:
- macOS computer
- Xcode 14+ (from Mac App Store)
- Apple Developer Account (for real device testing)

**Android Development Requires**:
- Android Studio (any OS)
- Java JDK 11+

## Need Help?

See **README-MOBILE.md** for complete instructions, troubleshooting, and App Store submission guides.

---

**Files Created**:
- ✅ `capacitor.config.json` - Capacitor configuration
- ✅ `package.json` - Dependencies and scripts
- ✅ `index.html` - Updated with mobile meta tags
- ✅ `.gitignore` - Excludes build folders
- ✅ `assets/` - Directory for icons (add your icons here)
- ✅ `README-MOBILE.md` - Complete mobile setup guide

**Next**: Run `npm install` to get started!

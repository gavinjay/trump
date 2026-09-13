# Assets Directory

This directory should contain app icons and splash screens for the mobile apps.

## Required Icons

### App Icons
Create the following icon files (use https://icon.kitchen or https://appicon.co to generate from one source image):

- `icon-180.png` - 180x180 (iPhone @3x)
- `icon-152.png` - 152x152 (iPad @2x)  
- `icon-120.png` - 120x120 (iPhone @2x)
- `icon-76.png` - 76x76 (iPad)

### Favicons
- `favicon-32.png` - 32x32 (browser favicon)
- `favicon-16.png` - 16x16 (browser favicon)

### Splash Screens
- `splash.png` - 1x resolution
- `splash@2x.png` - 2x resolution
- `splash@3x.png` - 3x resolution

## Design Guidelines

**App Icon**:
- Use the Trump card game theme (playing cards, green table)
- Should be recognizable at small sizes
- No text (use imagery only)
- Square format with rounded corners applied by OS

**Splash Screen**:
- Background color: #0a6c3a (table green)
- Simple logo/branding centered
- Shows for 2 seconds on app launch

## Quick Setup

If you don't have icons yet, you can generate them:

1. Create a 1024x1024 source image with your logo/branding
2. Use https://icon.kitchen to generate all required sizes
3. Download and place files in this directory
4. Sync to native projects: `npm run sync`

## After Adding Icons

Once you've added the icon and splash screen files to this directory:

```bash
npm run sync
```

This will copy them to the native iOS and Android projects.

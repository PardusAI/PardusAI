# Assets Directory

This directory contains app icons and configuration files for building distributable packages.

## Files

### Required Files
- `entitlements.mac.plist` - macOS entitlements for app permissions ✅ (included)

### Optional Files (for custom branding)
- `icon.icns` - macOS app icon (512x512 or 1024x1024)
- `icon.ico` - Windows app icon (256x256)
- `icon.png` - Linux app icon (512x512)

## Default Behavior

If icon files are not provided, electron-builder will use Electron's default icon. The app will still work perfectly!

## Adding Custom Icons

### macOS Icon (.icns)
1. Create a 1024x1024 PNG image
2. Use Xcode's `iconutil` or an online converter
3. Save as `icon.icns` in this directory

### Windows Icon (.ico)
1. Create a 256x256 PNG image
2. Convert using ImageMagick or online tool
3. Save as `icon.ico` in this directory

### Quick Icon Creation
Use an online service like:
- https://cloudconvert.com/png-to-icns
- https://cloudconvert.com/png-to-ico
- https://www.icoconverter.com/

## Icon Guidelines

- Use a square image (1:1 aspect ratio)
- Minimum 512x512 pixels
- Simple, clear design works best
- Test on both light and dark backgrounds
- Avoid text (may be hard to read at small sizes)

## Testing Your Icons

After adding icons, rebuild:
```bash
npm run dist
```

The packaged app will use your custom icons!


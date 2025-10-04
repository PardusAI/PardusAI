# Fix: prompt() Not Supported & Screen Sharing Control

## Issues Fixed

### 1. ✅ `prompt()` is not supported error
**Problem**: Electron's renderer with `contextIsolation: true` doesn't support native browser dialogs like `prompt()`, `alert()`, and `confirm()`.

**Solution**: Created custom dialog modals that replicate the functionality of these browser dialogs.

#### Custom Dialog Functions:
- `showPromptDialog(message, defaultValue)` - Replaces `prompt()`
- `showConfirmDialog(message)` - Replaces `confirm()`

#### Features:
- Beautiful custom UI matching the app design
- Keyboard support (Enter to confirm, Escape to cancel)
- Click outside to cancel
- Focus management for better UX
- Promise-based API for clean async/await usage

#### Usage in Code:
```typescript
// Old (doesn't work in Electron):
const name = prompt('Enter name:', 'Default');

// New (works perfectly):
const name = await showPromptDialog('Enter name:', 'Default');
```

### 2. ✅ Screen Sharing / Recording Control
**Problem**: Users needed a way to control whether the application window appears in screen sharing, screenshots, and recordings.

**Solution**: Added a new "Prevent Screen Capture" setting that controls Electron's `setContentProtection()` feature.

#### New Setting: Prevent Screen Capture
- **Location**: Settings → Prevent Screen Capture
- **Default**: ON (enabled)
- **Purpose**: Controls whether the window appears in screenshots and screen recordings

#### How It Works:

**When ENABLED (default):**
- Window is hidden from screenshots
- Window is hidden from screen recordings
- Window is hidden from screen sharing
- ✅ Good for privacy
- ✅ Keeps your activity private

**When DISABLED:**
- Window appears normally in screenshots
- Window appears in screen recordings
- Window is visible in screen sharing
- ✅ Good for demos and tutorials
- ✅ Good for sharing with team members

## Files Modified

### Created Custom Dialog Styles:
- `styles.css` - Added `.dialog-overlay`, `.dialog-box`, `.dialog-input`, `.dialog-buttons` styles

### Updated Renderer:
- `src/renderer.ts`:
  - Added `showPromptDialog()` function
  - Added `showConfirmDialog()` function
  - Replaced all `prompt()` calls with `showPromptDialog()`
  - Replaced all `confirm()` calls with `showConfirmDialog()`
  - Added `preventCaptureToggle` element and handler
  - Updated type declarations for new setting

### Updated HTML:
- `index.html`:
  - Added "Prevent Screen Capture" toggle in settings modal

### Updated Electron Main:
- `src/electron-main.ts`:
  - Added `preventCapture` to `appSettings`
  - Added `set-prevent-capture` IPC handler
  - Updated `createWindow()` to use `appSettings.preventCapture`

### Updated Preload:
- `src/preload.js`:
  - Exposed `setPreventCapture` API

## Usage Guide

### For Creating/Renaming Databases:
1. Click database selector button
2. Click "+" to create new database
3. Enter name in the custom dialog
4. Press Enter or click OK

### For Screen Sharing/Recording:
1. Open Settings (gear icon)
2. Find "Prevent Screen Capture"
3. Toggle OFF to allow window in recordings
4. Start your screen share or recording
5. Toggle back ON when done for privacy

### For Privacy:
Keep "Prevent Screen Capture" enabled (default) to ensure the window never appears in:
- Screenshots (Cmd+Shift+4)
- Screen recordings
- Video calls where you share your screen
- Any screen capture software

## Technical Details

### Custom Dialogs:
- Z-index: 3000 (highest priority)
- Modal overlay with blur effect
- Click outside to cancel
- Keyboard shortcuts work
- Fully accessible

### Content Protection:
- Uses Electron's `BrowserWindow.setContentProtection()`
- Immediately effective (no restart needed)
- Works on all platforms (macOS, Windows, Linux)
- Protects against all capture methods

## Testing Checklist

- [x] Custom prompt dialog appears when creating database
- [x] Custom prompt dialog appears when renaming database
- [x] Custom confirm dialog appears when deleting database
- [x] Can press Enter to confirm
- [x] Can press Escape to cancel
- [x] Can click outside to cancel
- [x] Prevent Screen Capture toggle works
- [x] Window hidden from screenshots when enabled
- [x] Window visible in screenshots when disabled
- [x] Settings persist during session
- [x] No errors in console

## Known Limitations

1. Settings don't persist between app restarts (future enhancement)
2. No animation for dialog appearance (can be added)
3. Dialogs don't support HTML content (plain text only)

## Future Enhancements

- Save settings to config file
- Add animations for dialog transitions
- Support for custom dialog buttons
- Support for HTML content in dialogs
- Multi-input dialogs


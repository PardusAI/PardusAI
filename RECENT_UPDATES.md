# Recent Updates - Multiple Databases & Settings

## Summary
This update introduces two major features: multiple database support with user selection and a settings page for window customization.

## Issues Fixed

### 1. Database Selector Click-Through Issue ✅
**Problem**: Clicking the database selector button or dropdown would go to the background and become unclickable.

**Solution**: 
- Added database selector elements to the interactive elements array
- Added explicit checks for visible dropdown to prevent click-through
- Added event propagation stopping to prevent unintended interactions

**Files Modified**:
- `src/renderer.ts` - Added dbSelectorBtn and dbDropdown to interactive elements

### 2. New Database Button Not Working ✅
**Problem**: Clicking the "+" button to create new databases wasn't working properly (prompt not appearing).

**Solution**:
- Added `e.stopPropagation()` to prevent click events from bubbling up
- This prevents the dropdown from closing immediately when the button is clicked
- Ensures the prompt dialog appears properly

**Files Modified**:
- `src/renderer.ts` - Added stopPropagation to both database selector and new database button handlers

## New Features

### 1. Settings Page 🆕
A comprehensive settings modal that allows users to customize window behavior.

#### Features:
- **Always on Top Toggle**: Control whether the window stays above other applications
- **Click-Through Mode Toggle**: Control whether clicks pass through inactive areas

#### UI Components:
- Settings button (gear icon) in bottom right
- Modal overlay with blur effect
- Modern toggle switches
- Clean, accessible interface

#### Use Cases:
- **Screen Sharing**: Disable click-through to make window visible in screen shares
- **Recording**: Turn off click-through for better visibility during recordings
- **Normal Usage**: Keep both enabled for minimal interference

**Files Created**:
- `SETTINGS_FEATURE.md` - Complete documentation

**Files Modified**:
- `src/renderer.ts` - Added settings UI logic
- `src/electron-main.ts` - Added settings IPC handlers and state management
- `src/preload.js` - Exposed settings APIs
- `index.html` - Added settings modal HTML
- `styles.css` - Added settings modal styles

### 2. Enhanced Click-Through Handling
The click-through behavior now respects user settings and properly handles all interactive elements.

**Interactive Elements**:
- Chat popup and form
- Database selector and dropdown
- Settings button and modal
- All buttons and inputs

**Behavior**:
- When click-through is enabled: Only interactive elements capture clicks
- When click-through is disabled: Entire window captures clicks
- Settings modal always has priority when visible

## Technical Changes

### State Management
Added application settings object in electron-main:
```typescript
let appSettings = {
  alwaysOnTop: true,
  clickThrough: true
};
```

### IPC Handlers Added
- `get-settings` - Retrieve current settings
- `set-always-on-top` - Toggle always on top behavior
- `set-click-through` - Toggle click-through mode

### Event Handling Improvements
- Added event propagation control for better interaction handling
- Enhanced visibility checks for modals and dropdowns
- Improved interactive element detection

## Files Changed Summary

### Created:
- `SETTINGS_FEATURE.md` - Settings documentation
- `RECENT_UPDATES.md` - This file

### Modified:
- `src/renderer.ts` - Settings UI, event handling fixes
- `src/electron-main.ts` - Settings state and IPC handlers
- `src/preload.js` - Settings API exposure
- `index.html` - Settings modal markup
- `styles.css` - Settings styles and UI improvements

## Upgrade Notes

### For Users:
1. The application now has a settings button (gear icon) in the bottom right
2. You can disable click-through mode for screen sharing or recording
3. Database selector now works reliably
4. Creating new databases works as expected

### For Developers:
1. Settings are stored in memory and reset on restart
2. Future enhancement: Persist settings to config file
3. Click-through behavior respects settings state
4. All interactive elements must be added to the interactiveElements array

## Testing Checklist

- [x] Database selector opens and closes properly
- [x] Can click on databases to switch
- [x] Can create new databases (+ button)
- [x] Can rename databases
- [x] Can delete databases (if more than one exists)
- [x] Settings modal opens and closes
- [x] Always on top toggle works
- [x] Click-through toggle works
- [x] All interactive elements remain clickable
- [x] No click-through issues with any UI element

## Known Limitations

1. Settings don't persist between application restarts
2. No keyboard shortcuts for settings yet
3. No ESC key to close settings modal

## Next Steps

Potential future enhancements:
- Persist settings to config file
- Add keyboard shortcuts (Cmd+, for settings)
- Add ESC key support for closing modals
- Add window opacity control
- Add custom positioning options
- Add theme customization


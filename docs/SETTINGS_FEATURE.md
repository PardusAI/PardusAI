# Settings Feature

## Overview
The Memory Bench application now includes a Settings page that allows users to customize the window behavior and control screen visibility.

## Features

### Settings Button
- Located in the bottom right corner of the status bar (gear icon)
- Click to open the Settings modal
- Click outside the modal or the X button to close

### Available Settings

#### 1. Always on Top
- **Description**: Keep window above other applications
- **Default**: Enabled (checked)
- **Purpose**: When enabled, the Memory Bench window stays on top of all other windows
- **When to disable**: If you want the window to behave like a normal application and be able to be covered by other windows

#### 2. Click-Through Mode
- **Description**: Allow clicks to pass through inactive areas
- **Default**: Enabled (checked)
- **Purpose**: When enabled, clicks pass through transparent/inactive areas to the application underneath
- **When to disable**: 
  - If you want the entire window to always capture clicks
  - If you're screen sharing and want others to see the window
  - If you're recording and want to interact with the window normally

## Use Cases

### Screen Sharing / Recording
When you want to share your screen or record with Memory Bench visible:

1. Click the Settings button (gear icon)
2. Toggle **"Click-Through Mode"** to OFF
3. The window will now be fully visible and interactive in screen shares
4. Toggle **"Always on Top"** to OFF if you want it to behave like a normal window

### Normal Usage
For everyday use with minimal interference:

1. Keep both settings enabled (default)
2. The window stays on top but allows clicks to pass through
3. Only the chat input and active popup areas capture clicks

## Technical Details

### Click-Through Behavior
- When **enabled**: Mouse events are ignored except for interactive elements
- When **disabled**: All mouse events are captured by the window
- Settings updates are immediate (no restart required)

### Always on Top Behavior
- When **enabled**: Window stays above all other windows
- When **disabled**: Window behaves like normal applications
- Updates immediately when toggled

### Settings Persistence
Currently, settings are stored in memory and reset when the application restarts. Future enhancement could save settings to disk.

## UI Components

### Settings Modal
- **Background**: Semi-transparent overlay with blur
- **Position**: Centered on screen
- **Size**: Maximum 500px width, responsive
- **Close Methods**:
  - Click the X button
  - Click outside the modal
  - Press ESC (future enhancement)

### Toggle Switches
- **Visual Design**: Modern iOS-style toggle switches
- **States**: 
  - ON: Green color
  - OFF: Gray color
- **Interaction**: Click anywhere on the toggle to switch

## Keyboard Shortcuts
Currently, there are no keyboard shortcuts for settings. Potential future additions:
- `Cmd/Ctrl + ,` - Open settings
- `ESC` - Close settings modal

## Future Enhancements
- Save settings to config file for persistence
- Additional window opacity control
- Custom positioning options
- Keyboard shortcuts
- Dark/Light theme toggle
- Custom hotkey configuration


# Screenshot Control & Dialog Fix

## Issues Fixed

### 1. ✅ Dialog Click-Through Issue
**Problem**: When clicking the "+" button to create a new database, the custom dialog would appear but immediately go to the background, making it impossible to interact with.

**Root Cause**: The custom dialogs weren't disabling click-through mode when they appeared.

**Solution**: 
- When a dialog opens

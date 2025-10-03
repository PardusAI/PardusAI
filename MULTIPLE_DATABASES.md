# Multiple Database Feature

## Overview
The Memory Bench application now supports multiple memory databases with user selection, naming capabilities, and timestamp-based ordering after retrieval.

## Features Implemented

### 1. Multiple Memory Databases
- Users can create multiple memory databases
- Each database maintains its own memories, embeddings, and metadata
- Databases are stored as separate JSON files in the `data/` directory
- A `databases.json` file tracks all available databases and the active one

### 2. Database Management UI
- **Database Selector**: Located in the status bar (bottom left)
  - Shows the current active database name
  - Click to open dropdown with all databases
  
- **Database Dropdown**: 
  - View all databases
  - Click a database to switch to it
  - Rename databases (pencil icon)
  - Delete databases (trash icon - only available if more than one database exists)
  - Create new databases (+ icon in header)

### 3. Database Operations

#### Create Database
- Click the "+" button in the database dropdown
- Enter a name for the new database
- Automatically creates the database file and switches to it

#### Switch Database
- Click on any database in the dropdown list
- The UI updates to show the new database's memory count
- All subsequent screenshots and queries use the active database

#### Rename Database
- Click the pencil icon next to a database
- Enter a new name
- The database selector updates to reflect the new name

#### Delete Database
- Click the trash icon next to a database (not available for the last database)
- Confirm deletion
- If the deleted database was active, switches to the first available database

### 4. Timestamp-Based Ordering
After retrieving the top K most similar memories, results are now sorted by timestamp (newest first) instead of by similarity score. This provides a more chronological context when answering questions.

**Previous behavior:**
- Retrieved top K memories sorted by similarity score (highest to lowest)

**New behavior:**
- Retrieves top K memories by similarity score
- Then re-sorts those K memories by timestamp (newest first)
- Provides context in chronological order

## Technical Details

### New Files
- `src/databaseManager.ts`: Manages multiple databases, switching, and metadata

### Modified Files
- `src/embeddings.ts`: Added timestamp-based sorting after retrieval
- `src/electron-main.ts`: Integrated database manager and added IPC handlers
- `src/renderer.ts`: Added database selection UI logic
- `src/preload.js`: Exposed database management APIs
- `index.html`: Added database selector UI elements
- `styles.css`: Added styling for database selector

### Database Storage Structure
```
data/
├── databases.json          # Database metadata and active database
├── db_<timestamp>_<id>.json   # Individual database files
└── ...
```

### Database Metadata Format
```json
{
  "databases": [
    {
      "id": "db_1234567890_abc123",
      "name": "Work Projects",
      "filePath": "data/db_1234567890_abc123.json",
      "createdAt": 1234567890000,
      "lastAccessedAt": 1234567890000
    }
  ],
  "activeDatabase": "db_1234567890_abc123",
  "version": "1.0.0"
}
```

## Usage

### Creating Your First Custom Database
1. Look at the bottom left of the window
2. Click the database selector button (shows current database name with database icon)
3. Click the "+" button in the dropdown header
4. Enter a name like "Personal" or "Work"
5. The new database is created and becomes active

### Switching Between Databases
1. Click the database selector button
2. Click on any database in the list
3. The UI updates immediately with the new database's memory count
4. All new screenshots go to the active database

### Organizing Your Memories
You can organize your memories by creating databases for different contexts:
- **Work**: Screenshots from work projects
- **Personal**: Personal browsing and activities
- **Research**: Research-related screenshots
- **Learning**: Educational content

## Notes

- Each database has its own embedding queue
- When you switch databases, the embedding queue for that database automatically starts if needed
- The tray menu shows the active database name and memory count
- You cannot delete the last remaining database
- Database files are automatically saved with atomic writes for data safety

## Keyboard Shortcuts
- **⌘Q / Ctrl+Q**: Quit application
- No keyboard shortcuts for database switching yet (can be added in future)

## Future Enhancements (Potential)
- Import/export databases
- Merge databases
- Database statistics and analytics
- Search across all databases
- Keyboard shortcuts for quick database switching
- Database tags or categories


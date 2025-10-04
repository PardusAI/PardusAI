import { app, BrowserWindow, ipcMain, screen, globalShortcut, Tray, Menu, nativeImage, shell, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import screenshot from 'screenshot-desktop';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { chatWithImage, chatStream } from './model.js';
import { retrieveTopK } from './embeddings.js';
import { MemoryDatabase } from './database.js';
import type { MemoryRecord } from './database.js';
import { EmbeddingQueue } from './embeddingQueue.js';
import { DatabaseManager } from './databaseManager.js';
import { SCREENSHOT_DESCRIPTION_PROMPT, generateQuestionAnswerPrompt, formatImageContext, NO_MEMORIES_MESSAGE } from './prompts.js';
import { config } from './config.js';
import { loadSettings, saveSettings, updateSettings, type UserSettings } from './settingsManager.js';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Project root directory (one level up from dist)
const projectRoot = path.join(__dirname, '..');

// Load environment variables from .env file in project root
const envPath = path.join(projectRoot, '.env');
dotenv.config({ path: envPath });

if (!process.env.OPENROUTER_API_KEY) {
  console.error('❌ ERROR: OPENROUTER_API_KEY not found!');
  console.error('Please create a .env file with: OPENROUTER_API_KEY=your-key');
}

// Initialize database manager
const DATA_DIR = path.join(projectRoot, 'data');
const LOGS_DIR = path.join(projectRoot, 'logs');
const dbManager = new DatabaseManager(DATA_DIR);

// Embedding queue map - one queue per database
const embeddingQueues = new Map<string, EmbeddingQueue>();

// Helper to get or create embedding queue for a database
function getEmbeddingQueue(db: MemoryDatabase, dbId: string): EmbeddingQueue {
  if (!embeddingQueues.has(dbId)) {
    const queue = new EmbeddingQueue(db, 1000);
    embeddingQueues.set(dbId, queue);
  }
  return embeddingQueues.get(dbId)!;
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let appIcon: Electron.NativeImage | null = null;

// Application settings
let appSettings = {
  alwaysOnTop: true,
  clickThrough: true,
  preventCapture: true,
  theme: 'dark' as 'dark' | 'light'
};

// Screenshot capture control
let isCapturing = true;

// Safe logger that won't crash on EPIPE errors
function safeLog(...args: any[]) {
  try {
    console.log(...args);
  } catch (err) {
    // Silently ignore EPIPE and other console errors
  }
}

function safeError(...args: any[]) {
  try {
    console.error(...args);
  } catch (err) {
    // Silently ignore EPIPE and other console errors
  }
}

async function compareImages(img1: string, img2: string): Promise<boolean> {
  try {
    const { stdout, stderr } = await execAsync(
      `ffmpeg -i "${img1}" -i "${img2}" -filter_complex "ssim" -f null - 2>&1`
    );
    const output = stdout + stderr;
    const match = output.match(/All:([0-9.]+)/);
    if (match && match[1]) {
      const similarity = parseFloat(match[1]);
      return similarity > config.capture.similarity_threshold;
    }
    return false;
  } catch (err) {
    return false;
  }
}

async function captureScreen(previousPath: string | null): Promise<string | null> {
  try {
    const time = Date.now();
    const filePath = path.join(projectRoot, `${config.capture.output_directory}/${time}_screenshot.png`);

    await screenshot({ filename: filePath });

    if (previousPath) {
      const areSame = await compareImages(previousPath, filePath);
      if (areSame) {
        await fs.unlink(filePath);
        return previousPath;
      }
    }

    processScreenshot(filePath).catch(() => {});
    
    return filePath;
  } catch (err) {
    return previousPath;
  }
}

async function processScreenshot(imagePath: string): Promise<void> {
  try {
    // Use safe logger to prevent EPIPE errors
    safeLog(`📸 Processing: ${path.basename(imagePath)}`);
    
    // Add delay to avoid rate limiting (from config)
    await new Promise(resolve => setTimeout(resolve, config.capture.processing_delay));
    
    const description = await chatWithImage(
      SCREENSHOT_DESCRIPTION_PROMPT,
      imagePath
    );
    
    // Get active database
    const db = await dbManager.getActiveDatabase();
    if (!db) {
      safeLog('⚠️  No active database, skipping screenshot');
      return;
    }
    
    // Add to database (embedding will be processed by queue)
    await db.addMemory(imagePath, description);
    
    const stats = db.getStats();
    safeLog(`💾 Saved! Total: ${stats.total} (${stats.embedded} embedded, ${stats.pending} pending)`);
    
    // Update status in UI
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      try {
        mainWindow.webContents.send('memory-count-update', stats.total);
      } catch (err) {
        // Silently ignore IPC errors
      }
    }
  } catch (err) {
    // Silently handle errors to prevent crashes
    try {
      await fs.unlink(imagePath);
    } catch {}
  }
}

async function askWithImagesStreaming(
  question: string, 
  topResults: Array<{ memory: any; similarity: number }>,
  onChunk: (chunk: string) => void
): Promise<void> {
  const imageContext = formatImageContext(topResults);
  const prompt = generateQuestionAnswerPrompt(question, topResults.length, imageContext);

  const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    { type: 'text', text: prompt }
  ];

  for (const result of topResults) {
    const imageBuffer = await fs.readFile(result.memory.imageUrl);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = result.memory.imageUrl.endsWith('.png') ? 'image/png' : 'image/jpeg';
    
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:${mimeType};base64,${base64Image}`
      }
    });
  }

  // Get API settings
  const apiSettings = await loadSettings();
  const apiKey = await apiSettings.apiKeys[apiSettings.apiProvider];
  const baseURL = apiSettings.baseUrls[apiSettings.apiProvider];
  
  if (!apiKey) {
    throw new Error(`No API key configured for provider: ${apiSettings.apiProvider}`);
  }
  
  const aiClient = new OpenAI({
    baseURL: baseURL,
    apiKey: apiKey,
  });

  safeLog(`🤖 Streaming from ${apiSettings.apiProvider}...`);
  const stream = await aiClient.chat.completions.create({
    model: apiSettings.models.vision,
    messages: [
      {
        role: 'user',
        content: content as any
      }
    ],
    stream: true,
  });

  let totalChars = 0;
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      totalChars += content.length;
      onChunk(content);
    }
  }
  
  safeLog(`✅ Streaming complete (${totalChars} chars)`);
}

// Log trajectory to JSON file
async function logTrajectory(question: string, topResults: Array<{ memory: any; similarity: number }>, answer: string) {
  try {
    // Ensure logs directory exists
    try {
      await fs.access(LOGS_DIR);
    } catch {
      await fs.mkdir(LOGS_DIR, { recursive: true });
    }
    
    const timestamp = Date.now();
    const logEntry = {
      timestamp,
      datetime: new Date(timestamp).toISOString(),
      question,
      relevant_screenshots: topResults.map((result, idx) => ({
        rank: idx + 1,
        image_path: result.memory.imageUrl,
        description: result.memory.description,
        similarity: result.similarity,
        captured_at: new Date(result.memory.time).toISOString()
      })),
      answer,
      total_screenshots_searched: topResults.length
    };
    
    // Append to daily log file
    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const logFilePath = path.join(LOGS_DIR, `trajectory_${dateStr}.json`);
    
    let logs = [];
    try {
      const existingData = await fs.readFile(logFilePath, 'utf-8');
      logs = JSON.parse(existingData);
    } catch {
      // File doesn't exist yet, start with empty array
    }
    
    logs.push(logEntry);
    await fs.writeFile(logFilePath, JSON.stringify(logs, null, 2), 'utf-8');
    
    safeLog(`📝 Trajectory logged to: ${path.basename(logFilePath)}`);
  } catch (err) {
    safeError('⚠️  Failed to log trajectory:', err);
  }
}

async function captureLoop(): Promise<void> {
  let lastSavedPath: string | null = null;

  while (true) {
    try {
      // Only capture if enabled
      if (isCapturing) {
        lastSavedPath = await captureScreen(lastSavedPath);
      }
      // Screenshot capture interval from config
      await new Promise(resolve => setTimeout(resolve, config.capture.interval));
    } catch (err) {
      if (process.env.DEBUG) {
        console.error('Error in capture loop:', err);
      }
      await new Promise(resolve => setTimeout(resolve, config.capture.interval));
    }
  }
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  
  // Load app icon - try PNG format
  let iconPath = path.join(projectRoot, 'assets', 'icon-256.png');
  if (!existsSync(iconPath)) {
    iconPath = path.join(projectRoot, 'assets', 'icon.png');
  }
  console.log('🔍 Icon path:', iconPath);
  console.log('🔍 Icon exists:', existsSync(iconPath));
  
  // Try to create icon from file
  let icon = nativeImage.createFromPath(iconPath);
  console.log('🔍 Icon loaded:', !icon.isEmpty());
  console.log('🔍 Icon size:', icon.getSize());
  
  // Check if icon loaded successfully
  if (icon.isEmpty()) {
    console.log('⚠️  Icon failed to load');
  }
  
  // Store icon globally for use in dialogs
  appIcon = icon;
  
  mainWindow = new BrowserWindow({
    width: width,
    height: 600,
    x: 0,
    y: height - 600,
    frame: false,
    transparent: true,
    alwaysOnTop: appSettings.alwaysOnTop,
    resizable: false,
    skipTaskbar: false,
    icon: icon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'Memory Bench'
  });

  // Prevent window from appearing in screenshots (based on settings)
  mainWindow.setContentProtection(appSettings.preventCapture);
  
  // Make window visible on all workspaces/desktops
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Load from root directory
  mainWindow.loadFile(path.join(projectRoot, 'index.html'));
  
  // Handle external links - open in browser with confirmation
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.log('🔗 External link clicked:', url);
    // Show confirmation dialog
    if (mainWindow && appIcon) {
      dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['Open in Browser', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
      title: 'Open External Link',
      message: `Do you want to open this link in your browser?`,
      detail: url,
      icon: appIcon
      }).then((result: any) => {
        if (result.response === 0) {
          shell.openExternal(url);
        }
      });
    }
    return { action: 'deny' };
  });
  
  // Also handle navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (parsedUrl.origin !== 'file://') {
      event.preventDefault();
      console.log('🔗 Navigation to external URL:', navigationUrl);
      // Show confirmation dialog
      if (mainWindow && appIcon) {
        dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Open in Browser', 'Cancel'],
        defaultId: 0,
        cancelId: 1,
        title: 'Open External Link',
        message: `Do you want to open this link in your browser?`,
        detail: navigationUrl,
        icon: appIcon
        }).then((result: any) => {
          if (result.response === 0) {
            shell.openExternal(navigationUrl);
          }
        });
      }
    }
  });

  // Forward renderer console logs to main process terminal
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levels = ['LOG', 'WARNING', 'ERROR'];
    console.log(`[RENDERER] ${message}`);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  // Set click-through based on user settings (disabled by default)
  if (appSettings.clickThrough) {
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
  } else {
    mainWindow.setIgnoreMouseEvents(false);
  }
}

function createTray() {
  // Load the app icon for tray
  let iconPath = path.join(projectRoot, 'assets', 'icon-256.png');
  if (!existsSync(iconPath)) {
    iconPath = path.join(projectRoot, 'assets', 'icon.png');
  }
  console.log('🔍 Tray icon path:', iconPath);
  console.log('🔍 Tray icon exists:', existsSync(iconPath));
  
  const trayIcon = nativeImage.createFromPath(iconPath);
  console.log('🔍 Tray icon loaded:', !trayIcon.isEmpty());
  console.log('🔍 Tray icon size:', trayIcon.getSize());
  
  // Resize to appropriate tray icon size (16x16 or 32x32 depending on system)
  const resizedIcon = trayIcon.resize({ width: 16, height: 16 });
  console.log('🔍 Resized tray icon size:', resizedIcon.getSize());
  tray = new Tray(resizedIcon);
  
  async function updateTrayMenu() {
    const db = await dbManager.getActiveDatabase();
    const stats = db ? db.getStats() : { total: 0 };
    const activeMeta = dbManager.getActiveDatabaseMetadata();
    const dbName = activeMeta ? activeMeta.name : 'No DB';
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Memory Bench',
        enabled: false
      },
      {
        type: 'separator'
      },
      {
        label: `Database: ${dbName}`,
        enabled: false
      },
      {
        label: `Memories: ${stats.total}`,
        enabled: false,
        id: 'memory-count'
      },
      {
        type: 'separator'
      },
      {
        label: 'Show Window',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      {
        label: 'Quit Memory Bench',
        click: () => {
          safeLog(`🛑 Quit from tray menu. Total memories: ${stats.total}`);
          app.quit();
        }
      }
    ]);
    
    if (tray && !tray.isDestroyed()) {
      tray.setContextMenu(contextMenu);
    }
  }
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Memory Bench',
      enabled: false
    },
    {
      type: 'separator'
    },
    {
      label: 'Memories: 0',
      enabled: false,
      id: 'memory-count'
    },
    {
      type: 'separator'
    },
    {
      label: 'Show Window',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Quit Memory Bench',
      click: () => {
        safeLog(`🛑 Quit from tray menu.`);
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  tray.setToolTip('Memory Bench - Screenshot Memory System');
  
  // Update memory count in tray menu
  setInterval(() => {
    updateTrayMenu().catch(() => {});
  }, 5000); // Update every 5 seconds
}

app.whenReady().then(async () => {
  // Log config settings
  safeLog('⚙️  Configuration loaded:');
  safeLog(`   Screenshot interval: ${config.capture.interval}ms`);
  safeLog(`   Processing delay: ${config.capture.processing_delay}ms`);
  safeLog(`   Vision model: ${config.ai.openrouter.vision_model}`);
  safeLog(`   Embedding model: ${config.ai.ollama.model}`);
  
  // Initialize database manager
  await dbManager.initialize();
  const db = await dbManager.getActiveDatabase();
  if (db) {
    const stats = db.getStats();
    const activeMeta = dbManager.getActiveDatabaseMetadata();
    safeLog(`📂 Database loaded: "${activeMeta?.name}" - ${stats.total} memories (${stats.embedded} embedded, ${stats.pending} pending)`);
    
    // Start embedding queue for active database
    const activeDbId = dbManager.getActiveDatabaseId();
    if (activeDbId) {
      const queue = getEmbeddingQueue(db, activeDbId);
      queue.start();
      safeLog('🔄 Embedding queue started');
    }
  } else {
    safeLog('⚠️  No active database found');
  }
  
  // Ensure tmp directory exists before starting
  const tmpDir = path.join(projectRoot, config.capture.output_directory);
  try {
    await fs.access(tmpDir);
  } catch {
    await fs.mkdir(tmpDir, { recursive: true });
  }

  createWindow();
  createTray();

  // Register global keyboard shortcuts
  globalShortcut.register('CommandOrControl+Q', () => {
    console.log('🛑 Keyboard shortcut triggered (Cmd/Ctrl+Q)');
    app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // Start continuous screenshot capture
  captureLoop().catch(console.error);
});

app.on('window-all-closed', () => {
  // Don't quit on macOS when windows close, keep tray icon
  if (process.platform !== 'darwin') {
    globalShortcut.unregisterAll();
    if (tray) {
      tray.destroy();
    }
    app.quit();
  }
});

app.on('will-quit', () => {
  // Cleanup before quitting
  globalShortcut.unregisterAll();
  if (tray && !tray.isDestroyed()) {
    tray.destroy();
  }
});

// IPC handlers
ipcMain.handle('ask-question', async (event, question: string) => {
  console.log('\n' + '='.repeat(70));
  console.log(`📨 RECEIVED MESSAGE FROM UI`);
  console.log(`   Question: "${question}"`);
  
  const db = await dbManager.getActiveDatabase();
  if (!db) {
    console.log('⚠️  NO ACTIVE DATABASE - Returning error message');
    console.log('='.repeat(70) + '\n');
    return {
      success: false,
      message: 'No active database selected'
    };
  }
  
  const stats = db.getStats();
  console.log(`   Total Memories: ${stats.total}`);
  console.log('='.repeat(70));
  
  if (stats.total === 0) {
    console.log('⚠️  NO MEMORIES YET - Returning error message');
    console.log('='.repeat(70) + '\n');
    return {
      success: false,
      message: NO_MEMORIES_MESSAGE
    };
  }

  try {
    console.log('🔍 Step 1: Searching for relevant memories...');
    const topResults = await retrieveTopK(question, db, 3);
    
    const relevantMemories = topResults.map((result, idx) => ({
      index: idx + 1,
      date: new Date(result.memory.time).toLocaleString(),
      similarity: result.similarity.toFixed(3),
      description: result.memory.description.substring(0, 120) + '...'
    }));

    console.log(`✅ Found ${relevantMemories.length} relevant screenshots:`);
    relevantMemories.forEach(mem => {
      console.log(`   ${mem.index}. [${mem.date}] Similarity: ${mem.similarity}`);
    });
    
    // Send initial response with metadata (memory info won't be displayed in UI)
    event.sender.send('answer-start', {
      relevantMemories,
      totalMemories: stats.total
    });
    
    console.log('\n🤖 Step 2: Streaming AI answer...');
    
    // Collect full answer for logging
    let fullAnswer = '';
    
    // Stream the answer
    await askWithImagesStreaming(question, topResults, (chunk) => {
      fullAnswer += chunk;
      event.sender.send('answer-chunk', chunk);
    });
    
    // Log trajectory to JSON file
    logTrajectory(question, topResults, fullAnswer).catch(() => {});
    
    // Send completion signal
    event.sender.send('answer-complete');
    
    console.log(`✅ Streaming complete!`);
    console.log('='.repeat(70) + '\n');

    return {
      success: true
    };
  } catch (err) {
    console.error('\n❌ ERROR OCCURRED:');
    console.error('   Type:', err instanceof Error ? err.constructor.name : typeof err);
    console.error('   Message:', err instanceof Error ? err.message : String(err));
    if (err instanceof Error && err.stack) {
      console.error('   Stack:', err.stack);
    }
    console.log('='.repeat(70) + '\n');
    
    event.sender.send('answer-error', {
      message: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`
    });
    
    return {
      success: false,
      message: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`
    };
  }
});

ipcMain.handle('get-memory-count', async () => {
  const db = await dbManager.getActiveDatabase();
  return db ? db.getStats().total : 0;
});

// Database management IPC handlers
ipcMain.handle('list-databases', async () => {
  return dbManager.listDatabases();
});

ipcMain.handle('get-active-database', async () => {
  return dbManager.getActiveDatabaseMetadata();
});

ipcMain.handle('create-database', async (event, name: string) => {
  try {
    const id = await dbManager.createDatabase(name);
    
    // Start embedding queue for new database
    const db = await dbManager.getDatabase(id);
    if (db) {
      const queue = getEmbeddingQueue(db, id);
      queue.start();
    }
    
    return { success: true, id };
  } catch (err) {
    return { 
      success: false, 
      message: err instanceof Error ? err.message : 'Failed to create database' 
    };
  }
});

ipcMain.handle('switch-database', async (event, id: string) => {
  try {
    const success = await dbManager.switchDatabase(id);
    
    if (success) {
      // Start embedding queue for switched database if not already started
      const db = await dbManager.getDatabase(id);
      if (db) {
        const queue = getEmbeddingQueue(db, id);
        if (!embeddingQueues.has(id)) {
          queue.start();
        }
      }
      
      // Update UI with new memory count
      const newDb = await dbManager.getActiveDatabase();
      if (newDb && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('memory-count-update', newDb.getStats().total);
        mainWindow.webContents.send('database-switched', dbManager.getActiveDatabaseMetadata());
      }
    }
    
    return { success };
  } catch (err) {
    return { 
      success: false, 
      message: err instanceof Error ? err.message : 'Failed to switch database' 
    };
  }
});

ipcMain.handle('rename-database', async (event, id: string, newName: string) => {
  try {
    const success = await dbManager.renameDatabase(id, newName);
    return { success };
  } catch (err) {
    return { 
      success: false, 
      message: err instanceof Error ? err.message : 'Failed to rename database' 
    };
  }
});

ipcMain.handle('delete-database', async (event, id: string) => {
  try {
    const success = await dbManager.deleteDatabase(id);
    
    if (success) {
      // Stop and remove embedding queue for deleted database
      if (embeddingQueues.has(id)) {
        embeddingQueues.delete(id);
      }
      
      // Update UI with new active database
      const newDb = await dbManager.getActiveDatabase();
      if (newDb && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('memory-count-update', newDb.getStats().total);
        mainWindow.webContents.send('database-switched', dbManager.getActiveDatabaseMetadata());
      }
    }
    
    return { success };
  } catch (err) {
    return { 
      success: false, 
      message: err instanceof Error ? err.message : 'Failed to delete database' 
    };
  }
});

ipcMain.handle('quit-app', async () => {
  const db = await dbManager.getActiveDatabase();
  const stats = db ? db.getStats() : { total: 0 };
  safeLog(`🛑 Quitting... Final memories: ${stats.total}`);
  app.quit();
  return true;
});

// Handle mouse enter/leave for click-through behavior
ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && appSettings.clickThrough) {
    win.setIgnoreMouseEvents(ignore, options);
  }
});

// Settings handlers
ipcMain.handle('get-settings', async () => {
  return appSettings;
});

ipcMain.handle('set-always-on-top', async (event, enabled: boolean) => {
  appSettings.alwaysOnTop = enabled;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(enabled);
  }
});

ipcMain.handle('set-click-through', async (event, enabled: boolean) => {
  appSettings.clickThrough = enabled;
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (!enabled) {
      // Disable click-through completely
      mainWindow.setIgnoreMouseEvents(false);
    } else {
      // Re-enable click-through with forward option
      mainWindow.setIgnoreMouseEvents(true, { forward: true });
    }
  }
});

ipcMain.handle('set-prevent-capture', async (event, enabled: boolean) => {
  appSettings.preventCapture = enabled;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setContentProtection(enabled);
  }
});

// Screenshot control handlers
ipcMain.handle('start-capture', async () => {
  isCapturing = true;
  safeLog('📸 Screenshot capture started');
});

ipcMain.handle('stop-capture', async () => {
  isCapturing = false;
  safeLog('⏸️  Screenshot capture stopped');
});

ipcMain.handle('get-capture-status', async () => {
  return isCapturing;
});

// Theme handler
ipcMain.handle('set-theme', async (event, theme: 'dark' | 'light') => {
  appSettings.theme = theme;
});

// API Settings handlers
ipcMain.handle('get-api-settings', async () => {
  try {
    const settings = await loadSettings();
    // Don't send the full API keys to renderer for security
    // Send masked versions
    return {
      apiProvider: settings.apiProvider,
      apiKeys: {
        openrouter: settings.apiKeys.openrouter ? '••••••' + settings.apiKeys.openrouter.slice(-4) : '',
        openai: settings.apiKeys.openai ? '••••••' + settings.apiKeys.openai.slice(-4) : '',
        anthropic: settings.apiKeys.anthropic ? '••••••' + settings.apiKeys.anthropic.slice(-4) : '',
      },
      models: settings.models,
      baseUrls: settings.baseUrls,
    };
  } catch (err) {
    console.error('Failed to load API settings:', err);
    return null;
  }
});

ipcMain.handle('save-api-settings', async (event, settings: Partial<UserSettings>) => {
  try {
    const currentSettings = await loadSettings();
    
    // If API key is masked (starts with •), don't update it - keep current value
    if (settings.apiKeys) {
      const updatedKeys: any = {};
      
      if (settings.apiKeys.openrouter) {
        updatedKeys.openrouter = settings.apiKeys.openrouter.startsWith('••••••') 
          ? currentSettings.apiKeys.openrouter 
          : settings.apiKeys.openrouter;
      }
      if (settings.apiKeys.openai) {
        updatedKeys.openai = settings.apiKeys.openai.startsWith('••••••')
          ? currentSettings.apiKeys.openai
          : settings.apiKeys.openai;
      }
      if (settings.apiKeys.anthropic) {
        updatedKeys.anthropic = settings.apiKeys.anthropic.startsWith('••••••')
          ? currentSettings.apiKeys.anthropic
          : settings.apiKeys.anthropic;
      }
      
      settings.apiKeys = updatedKeys;
    }
    
    await updateSettings(settings);
    safeLog('💾 API settings saved successfully');
    
    return { success: true };
  } catch (err) {
    safeError('❌ Failed to save API settings:', err);
    return { 
      success: false, 
      message: err instanceof Error ? err.message : 'Failed to save settings' 
    };
  }
});

// Handle external URL opening with confirmation
ipcMain.handle('open-external-url', async (event, url: string) => {
  try {
    if (!mainWindow) {
      return { success: false, message: 'Main window not available' };
    }
    
    const dialogOptions: any = {
      type: 'question',
      buttons: ['Open in Browser', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
      title: 'Open External Link',
      message: `Do you want to open this link in your browser?`,
      detail: url
    };
    
    if (appIcon) {
      dialogOptions.icon = appIcon;
    }
    
    const result: any = await dialog.showMessageBox(mainWindow, dialogOptions);
    
    if (result.response === 0) {
      shell.openExternal(url);
      return { success: true };
    } else {
      return { success: false, cancelled: true };
    }
  } catch (err) {
    safeError('❌ Failed to open external URL:', err);
    return { 
      success: false, 
      message: err instanceof Error ? err.message : 'Failed to open URL' 
    };
  }
});


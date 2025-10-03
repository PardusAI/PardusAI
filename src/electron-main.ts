import { app, BrowserWindow, ipcMain, screen, globalShortcut, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import screenshot from 'screenshot-desktop';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
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

// Application settings
let appSettings = {
  alwaysOnTop: true,
  clickThrough: true,
  preventCapture: true
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

  const openrouter = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  safeLog('🤖 Streaming from OpenRouter...');
  const stream = await openrouter.chat.completions.create({
    model: config.ai.openrouter.vision_model,
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
  
  mainWindow = new BrowserWindow({
    width: width,
    height: 600,
    x: 0,
    y: height - 600,
    frame: false,
    transparent: true,
    alwaysOnTop: appSettings.alwaysOnTop,
    resizable: false,
    skipTaskbar: true,
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

  // Forward renderer console logs to main process terminal
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levels = ['LOG', 'WARNING', 'ERROR'];
    console.log(`[RENDERER] ${message}`);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  // Enable click-through by default, with forward option to detect when mouse is over interactive elements
  mainWindow.setIgnoreMouseEvents(true, { forward: true });
}

function createTray() {
  // Create a simple tray icon (16x16 template image)
  const icon = nativeImage.createEmpty();
  const size = 16;
  const canvas = {
    width: size,
    height: size,
  };
  
  // Create a simple circle icon
  const iconData = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = x - size / 2;
      const dy = y - size / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < size / 2 - 1) {
        iconData[i] = 0;     // R
        iconData[i + 1] = 0; // G
        iconData[i + 2] = 0; // B
        iconData[i + 3] = 255; // A
      }
    }
  }
  
  const trayIcon = nativeImage.createFromBuffer(iconData, { width: size, height: size });
  tray = new Tray(trayIcon);
  
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
    
    // Send initial response with metadata
    event.sender.send('answer-start', {
      relevantMemories,
      totalMemories: stats.total
    });
    
    console.log('\n🤖 Step 2: Streaming AI answer...');
    
    // Stream the answer
    await askWithImagesStreaming(question, topResults, (chunk) => {
      event.sender.send('answer-chunk', chunk);
    });
    
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


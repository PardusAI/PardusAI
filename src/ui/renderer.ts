// Type declarations for the Electron API and global libraries
declare global {
  interface Window {
    electronAPI: {
      askQuestion: (question: string) => Promise<any>;
      getMemoryCount: () => Promise<number>;
      onMemoryCountUpdate: (callback: (count: number) => void) => void;
      onAnswerStart: (callback: (data: any) => void) => void;
      onAnswerChunk: (callback: (chunk: string) => void) => void;
      onAnswerComplete: (callback: () => void) => void;
      onAnswerError: (callback: (error: any) => void) => void;
      onDatabaseSwitched: (callback: (metadata: any) => void) => void;
      quit: () => Promise<void>;
      setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => void;
      
      // Database management
      listDatabases: () => Promise<any[]>;
      getActiveDatabase: () => Promise<any>;
      createDatabase: (name: string) => Promise<any>;
      switchDatabase: (id: string) => Promise<any>;
      renameDatabase: (id: string, newName: string) => Promise<any>;
      deleteDatabase: (id: string) => Promise<any>;
      
      // Settings
      getSettings: () => Promise<{ alwaysOnTop: boolean; clickThrough: boolean; preventCapture: boolean; theme: 'dark' | 'light' }>;
      setAlwaysOnTop: (enabled: boolean) => Promise<void>;
      setClickThrough: (enabled: boolean) => Promise<void>;
      setPreventCapture: (enabled: boolean) => Promise<void>;
      setTheme: (theme: 'dark' | 'light') => Promise<void>;
      
      // Screenshot control
      startCapture: () => Promise<void>;
      stopCapture: () => Promise<void>;
      getCaptureStatus: () => Promise<boolean>;
      
      // API Settings
      getApiSettings: () => Promise<any>;
      saveApiSettings: (settings: any) => Promise<any>;
      
      // External URL handling
      openExternalUrl: (url: string) => Promise<any>;
    };
  }
  
  // Marked library loaded from CDN
  const marked: {
    parse: (markdown: string, options?: any) => string;
    setOptions: (options: any) => void;
  };
  
  // KaTeX library loaded from CDN
  const renderMathInElement: (element: HTMLElement, options?: any) => void;
}

const chatPopup = document.getElementById('chat-popup') as HTMLDivElement;
const chatMessages = document.getElementById('chat-messages') as HTMLDivElement;
const chatForm = document.getElementById('chat-form') as HTMLFormElement;
const messageInput = document.getElementById('message-input') as HTMLInputElement;
const sendButton = document.getElementById('send-button') as HTMLButtonElement;
const clearButton = document.getElementById('clear-button') as HTMLButtonElement;
const memoryCountEl = document.getElementById('memory-count') as HTMLSpanElement;

// Database selector elements
const dbSelectorBtn = document.getElementById('db-selector-btn') as HTMLButtonElement;
const dbDropdown = document.getElementById('db-dropdown') as HTMLDivElement;
const dbList = document.getElementById('db-list') as HTMLDivElement;
const newDbBtn = document.getElementById('new-db-btn') as HTMLButtonElement;

// Settings elements
const settingsBtn = document.getElementById('settings-btn') as HTMLButtonElement;
const settingsModal = document.getElementById('settings-modal') as HTMLDivElement;
const settingsClose = document.getElementById('settings-close') as HTMLButtonElement;
const alwaysOnTopToggle = document.getElementById('always-on-top') as HTMLInputElement;
const clickThroughToggle = document.getElementById('click-through') as HTMLInputElement;
const preventCaptureToggle = document.getElementById('prevent-capture') as HTMLInputElement;
const themeToggle = document.getElementById('theme-toggle') as HTMLInputElement;

// API Settings elements
const apiProviderSelect = document.getElementById('api-provider') as HTMLSelectElement;
const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
const visionModelInput = document.getElementById('vision-model') as HTMLInputElement;
const baseUrlInput = document.getElementById('base-url') as HTMLInputElement;
const saveApiSettingsBtn = document.getElementById('save-api-settings') as HTMLButtonElement;

// Screenshot control button
const screenshotToggleBtn = document.getElementById('screenshot-toggle') as HTMLButtonElement;

let isProcessing = false;
let hidePopupTimeout: NodeJS.Timeout | null = null;
let currentDatabases: any[] = [];
let activeDatabase: any = null;
let isCapturing = true;
let isDialogOpen = false;
let isClickThroughEnabled = false; // PERMANENTLY DISABLED - doesn't work on this system

// Wait for libraries to be loaded
window.addEventListener('DOMContentLoaded', () => {
  console.log('✅ DOM loaded');
  console.log('📚 Marked available:', typeof marked !== 'undefined');
  console.log('📐 KaTeX available:', typeof renderMathInElement !== 'undefined');
});

// Configure marked to preserve LaTeX delimiters
if (typeof marked !== 'undefined') {
  marked.setOptions({
    breaks: true,
    gfm: true
  });
}

// Handle URL clicks in markdown content
function handleUrlClicks() {
  document.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    
    // Check if clicked element is a link
    if (target.tagName === 'A' && target.getAttribute('href')) {
      const url = target.getAttribute('href');
      
      // Check if it's an external URL
      if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        e.preventDefault();
        console.log('🔗 External URL clicked:', url);
        
        try {
          const result = await window.electronAPI.openExternalUrl(url);
          if (!result.success && !result.cancelled) {
            console.error('Failed to open URL:', result.message);
          }
        } catch (error) {
          console.error('Error opening external URL:', error);
        }
      }
    }
  });
}

// Initialize URL click handling
handleUrlClicks();

// Helper function to render markdown with LaTeX
function renderMarkdownWithLatex(content: string, targetElement: HTMLElement) {
  // Check if libraries are available
  if (typeof marked === 'undefined') {
    console.error('❌ Marked library not loaded');
    targetElement.textContent = content;
    return;
  }
  
  if (typeof renderMathInElement === 'undefined') {
    console.error('❌ KaTeX library not loaded');
    targetElement.innerHTML = marked.parse(content) as string;
    return;
  }
  
  // First, parse markdown
  targetElement.innerHTML = marked.parse(content) as string;
  
  console.log('🔍 Rendering LaTeX in content...');
  
  // Then render LaTeX math expressions
  try {
    renderMathInElement(targetElement, {
      delimiters: [
        {left: '$$', right: '$$', display: true},
        {left: '$', right: '$', display: false},
        {left: '\\[', right: '\\]', display: true},
        {left: '\\(', right: '\\)', display: false}
      ],
      throwOnError: false,
      strict: false,
      trust: true
    });
    console.log('✅ LaTeX rendering complete');
  } catch (e) {
    console.error('❌ LaTeX rendering error:', e);
  }
}

// Custom dialog functions
function showPromptDialog(message: string, defaultValue: string = ''): Promise<string | null> {
  return new Promise((resolve) => {
    isDialogOpen = true;
    updateClickThrough();
    
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog-box">
        <div class="dialog-header">
          <span>${message}</span>
        </div>
        <input type="text" class="dialog-input" value="${defaultValue.replace(/"/g, '&quot;')}" autofocus>
        <div class="dialog-buttons">
          <button class="dialog-btn dialog-btn-cancel">Cancel</button>
          <button class="dialog-btn dialog-btn-confirm">OK</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    const input = overlay.querySelector('.dialog-input') as HTMLInputElement;
    const cancelBtn = overlay.querySelector('.dialog-btn-cancel') as HTMLButtonElement;
    const confirmBtn = overlay.querySelector('.dialog-btn-confirm') as HTMLButtonElement;
    
    input.focus();
    input.select();
    
    const cleanup = () => {
      isDialogOpen = false;
      document.body.removeChild(overlay);
      updateClickThrough();
    };
    
    const handleConfirm = () => {
      const value = input.value.trim();
      cleanup();
      resolve(value || null);
    };
    
    const handleCancel = () => {
      cleanup();
      resolve(null);
    };
    
    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
    
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    });
    
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        handleCancel();
      }
    });
  });
}

function showConfirmDialog(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    isDialogOpen = true;
    updateClickThrough();
    
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog-box">
        <div class="dialog-header">
          <span>${message}</span>
        </div>
        <div class="dialog-buttons">
          <button class="dialog-btn dialog-btn-cancel">Cancel</button>
          <button class="dialog-btn dialog-btn-confirm">Delete</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    const cancelBtn = overlay.querySelector('.dialog-btn-cancel') as HTMLButtonElement;
    const confirmBtn = overlay.querySelector('.dialog-btn-confirm') as HTMLButtonElement;
    
    confirmBtn.focus();
    
    const cleanup = () => {
      isDialogOpen = false;
      document.body.removeChild(overlay);
      updateClickThrough();
    };
    
    const handleConfirm = () => {
      cleanup();
      resolve(true);
    };
    
    const handleCancel = () => {
      cleanup();
      resolve(false);
    };
    
    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
    
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    });
    
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        handleCancel();
      }
    });
  });
}

// Update memory count
async function updateMemoryCount() {
  const count = await window.electronAPI.getMemoryCount();
  memoryCountEl.textContent = `${count} memories`;
}

// Update database selector button text
async function updateDatabaseSelector() {
  const activeMeta = await window.electronAPI.getActiveDatabase();
  activeDatabase = activeMeta;
  
  if (activeMeta) {
    // Clear the button first to prevent text overlap
    dbSelectorBtn.innerHTML = '';
    
    // Force a reflow to ensure the clear is applied
    void dbSelectorBtn.offsetHeight;
    
    // Set new content
    dbSelectorBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
      </svg>
      <span>${activeMeta.name}</span>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    `;
  }
}

// Render database list
async function renderDatabaseList() {
  const databases = await window.electronAPI.listDatabases();
  currentDatabases = databases;
  
  dbList.innerHTML = '';
  
  databases.forEach((db: any) => {
    const dbItem = document.createElement('div');
    dbItem.className = `db-item ${db.id === activeDatabase?.id ? 'active' : ''}`;
    
    dbItem.innerHTML = `
      <div class="db-item-info">
        <span class="db-name">${db.name}</span>
      </div>
      <div class="db-item-actions">
        ${databases.length > 1 ? `<button class="db-action-btn delete-btn" data-id="${db.id}" title="Delete">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>` : ''}
        <button class="db-action-btn rename-btn" data-id="${db.id}" title="Rename">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
      </div>
    `;
    
    // Click to switch database
    const infoDiv = dbItem.querySelector('.db-item-info') as HTMLDivElement;
    infoDiv.addEventListener('click', async () => {
      if (db.id !== activeDatabase?.id) {
        await switchToDatabase(db.id);
      }
      dbDropdown.classList.remove('visible');
    });
    
    // Delete button
    const deleteBtn = dbItem.querySelector('.delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const confirmed = await showConfirmDialog(`Delete database "${db.name}"?`);
        if (confirmed) {
          const result = await window.electronAPI.deleteDatabase(db.id);
          if (result.success) {
            await renderDatabaseList();
            await updateDatabaseSelector();
            await updateMemoryCount();
          }
        }
      });
    }
    
    // Rename button
    const renameBtn = dbItem.querySelector('.rename-btn');
    if (renameBtn) {
      renameBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const newName = await showPromptDialog(`Rename database "${db.name}" to:`, db.name);
        if (newName && newName !== db.name) {
          const result = await window.electronAPI.renameDatabase(db.id, newName);
          if (result.success) {
            await renderDatabaseList();
            await updateDatabaseSelector();
          }
        }
      });
    }
    
    dbList.appendChild(dbItem);
  });
}

// Switch to a database
async function switchToDatabase(id: string) {
  const result = await window.electronAPI.switchDatabase(id);
  if (result.success) {
    await updateDatabaseSelector();
    await updateMemoryCount();
    await renderDatabaseList();
    console.log('✅ Switched database successfully');
  } else {
    console.error('❌ Failed to switch database');
  }
}

// Listen for memory count updates
window.electronAPI.onMemoryCountUpdate((count: number) => {
  memoryCountEl.textContent = `${count} memories`;
});

// Listen for database switches
window.electronAPI.onDatabaseSwitched(async (metadata: any) => {
  activeDatabase = metadata;
  await updateDatabaseSelector();
  await renderDatabaseList();
});

// Initial updates
updateMemoryCount();
updateDatabaseSelector();
renderDatabaseList();
loadSettings();

// Don't enable click-through on startup - let the mouse enter/leave handlers manage it
// This ensures the app is clickable when first loaded

function showPopup() {
  console.log('👁️  UI: Showing chat popup...');
  chatPopup.classList.add('visible');
  if (hidePopupTimeout) {
    clearTimeout(hidePopupTimeout);
    hidePopupTimeout = null;
  }
  console.log('✅ UI: Chat popup is now visible');
}

function hidePopup() {
  chatPopup.classList.remove('visible');
}

function scheduleHidePopup() {
  if (hidePopupTimeout) {
    clearTimeout(hidePopupTimeout);
  }
  hidePopupTimeout = setTimeout(() => {
    hidePopup();
  }, 30000); // Hide after 30 seconds (increased from 15)
}

function addMessage(content: string, type: 'user' | 'assistant', isError: boolean = false) {
  showPopup();
  
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type}`;
  
  const labelDiv = document.createElement('div');
  labelDiv.className = 'message-label';
  labelDiv.textContent = type === 'user' ? 'You' : 'Assistant';
  
  const contentDiv = document.createElement('div');
  contentDiv.className = `message-content ${isError ? 'error-message' : ''}`;
  
  // For assistant messages, parse markdown and LaTeX; for user messages and errors, use plain text
  if (type === 'assistant' && !isError) {
    renderMarkdownWithLatex(content, contentDiv);
  } else {
    contentDiv.textContent = content;
  }
  
  messageDiv.appendChild(labelDiv);
  messageDiv.appendChild(contentDiv);
  chatMessages.appendChild(messageDiv);
  
  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
  
  // Keep popup visible for a while after new messages
  if (type === 'assistant') {
    scheduleHidePopup();
  }
}

function addThinkingIndicator(): HTMLDivElement {
  showPopup();
  
  const thinkingDiv = document.createElement('div');
  thinkingDiv.className = 'thinking-message';
  thinkingDiv.id = 'thinking-indicator';
  
  thinkingDiv.innerHTML = `
    <span>Thinking</span>
    <div class="thinking-dots">
      <span></span>
      <span></span>
      <span></span>
    </div>
  `;
  
  chatMessages.appendChild(thinkingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  
  return thinkingDiv;
}

function removeThinkingIndicator() {
  const thinkingIndicator = document.getElementById('thinking-indicator');
  if (thinkingIndicator) {
    thinkingIndicator.remove();
  }
}

function addMemoryInfo(memories: any[], totalCount: number) {
  // Memory info is now logged to trajectory file instead of displaying in UI
  // This improves user experience by not cluttering the chat
}

// Store accumulated streaming text
let streamingText = '';

// Create a streaming message element that gets updated with chunks
function createStreamingMessage(): HTMLDivElement {
  showPopup();
  
  // Reset streaming text
  streamingText = '';
  
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message assistant';
  messageDiv.id = 'streaming-message';
  
  const labelDiv = document.createElement('div');
  labelDiv.className = 'message-label';
  labelDiv.textContent = 'Assistant';
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content streaming';
  contentDiv.innerHTML = '';
  
  messageDiv.appendChild(labelDiv);
  messageDiv.appendChild(contentDiv);
  chatMessages.appendChild(messageDiv);
  
  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
  
  return messageDiv;
}

// Update the streaming message with a new chunk
function appendToStreamingMessage(chunk: string) {
  const streamingMessage = document.getElementById('streaming-message');
  if (streamingMessage) {
    const contentDiv = streamingMessage.querySelector('.message-content') as HTMLElement;
    if (contentDiv) {
      // Accumulate text
      streamingText += chunk;
      
      // Parse and render markdown with LaTeX
      renderMarkdownWithLatex(streamingText, contentDiv);
      
      // Scroll to bottom
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }
}

// Finalize the streaming message
function finalizeStreamingMessage() {
  const streamingMessage = document.getElementById('streaming-message');
  if (streamingMessage) {
    streamingMessage.id = '';
    const contentDiv = streamingMessage.querySelector('.message-content');
    if (contentDiv) {
      contentDiv.classList.remove('streaming');
    }
    scheduleHidePopup();
  }
  // Clear accumulated text
  streamingText = '';
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (isProcessing) {
    console.log('⚠️  Already processing a request, ignoring...');
    return;
  }
  
  const question = messageInput.value.trim();
  if (!question) {
    console.log('⚠️  Empty question, ignoring...');
    return;
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('📤 UI: User submitted question');
  console.log(`   Question: "${question}"`);
  console.log('='.repeat(70));
  
  // Add user message to UI
  console.log('📝 UI: Adding user message to chat...');
  addMessage(question, 'user');
  console.log('✅ UI: User message added');
  
  // Clear input
  messageInput.value = '';
  
  // Disable input while processing
  isProcessing = true;
  messageInput.disabled = true;
  sendButton.disabled = true;
  
  // Show thinking indicator
  console.log('🤔 UI: Showing thinking indicator...');
  addThinkingIndicator();
  
  try {
    console.log('🔄 UI: Sending question to main process via IPC...');
    const response = await window.electronAPI.askQuestion(question);
    console.log('📥 UI: Received initial response from main process');
    
    // Note: The actual answer will come via streaming events
    // The response here just indicates if the request was accepted
    
    if (!response.success && response.message) {
      // Handle immediate errors (like no memories)
      console.log('❌ UI: Response failed');
      console.log(`   Error message: ${response.message}`);
      removeThinkingIndicator();
      addMessage(response.message, 'assistant', true);
      console.log('⚠️  UI: Error message shown to user');
      
      // Re-enable input
      isProcessing = false;
      messageInput.disabled = false;
      sendButton.disabled = false;
      messageInput.focus();
    }
    
    console.log('='.repeat(70) + '\n');
  } catch (error) {
    console.error('\n❌ UI: EXCEPTION CAUGHT:');
    console.error('   Error:', error);
    console.error('   Stack:', error instanceof Error ? error.stack : 'N/A');
    removeThinkingIndicator();
    addMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'assistant', true);
    console.log('='.repeat(70) + '\n');
    
    // Re-enable input
    isProcessing = false;
    messageInput.disabled = false;
    sendButton.disabled = false;
    messageInput.focus();
  }
});

// Clear chat button handler
clearButton.addEventListener('click', () => {
  console.log('🗑️  Clear button clicked - clearing chat...');
  
  // Clear all messages from the chat
  chatMessages.innerHTML = '';
  
  // Hide the popup
  hidePopup();
  
  // Clear any pending hide timeout
  if (hidePopupTimeout) {
    clearTimeout(hidePopupTimeout);
    hidePopupTimeout = null;
  }
  
  console.log('✅ Chat cleared successfully');
});

// Focus input on load
messageInput.focus();

// Debug: Log that renderer has loaded
console.log('🎬 RENDERER.JS LOADED SUCCESSFULLY');
console.log('🎯 Form handler attached to:', chatForm);
console.log('🎯 Input element:', messageInput);
console.log('🎯 Send button:', sendButton);
console.log('🎯 Clear button:', clearButton);
console.log('🎯 Chat popup:', chatPopup);
console.log('🎯 electronAPI available:', typeof window.electronAPI !== 'undefined');

// Test form submission
chatForm.addEventListener('focus', () => {
  console.log('🎯 Form focused');
}, true);

messageInput.addEventListener('input', () => {
  console.log('⌨️  Input changed:', messageInput.value);
});

messageInput.addEventListener('keypress', (e) => {
  console.log('⌨️  Key pressed:', e.key);
});

// Smart click-through management
// CSS handles most of the work with pointer-events
// We only need to manage Electron window-level click-through
function updateClickThrough() {
  if (!isClickThroughEnabled) {
    // Fully disable click-through - window captures all clicks
    window.electronAPI.setIgnoreMouseEvents(false);
    return;
  }
  
  // If modal/dialog is open, disable click-through temporarily
  if (isDialogOpen || 
      settingsModal.classList.contains('visible') || 
      dbDropdown.classList.contains('visible')) {
    window.electronAPI.setIgnoreMouseEvents(false);
    return;
  }
  
  // Enable smart click-through - CSS pointer-events handles the rest
  window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
}

// Initial setup
updateClickThrough();

// Update on modal visibility changes
const modalObserver = new MutationObserver(() => {
  updateClickThrough();
});

modalObserver.observe(settingsModal, { 
  attributes: true, 
  attributeFilter: ['class'] 
});

modalObserver.observe(dbDropdown, { 
  attributes: true, 
  attributeFilter: ['class'] 
});

console.log('🖱️  Smart click-through enabled');

// Set up streaming event listeners
window.electronAPI.onAnswerStart((data) => {
  console.log('📡 UI: Streaming started');
  
  // Remove thinking indicator
  removeThinkingIndicator();
  
  // Add memory info if available
  if (data.relevantMemories && data.relevantMemories.length > 0) {
    console.log(`📋 UI: Adding ${data.relevantMemories.length} memory info items...`);
    addMemoryInfo(data.relevantMemories, data.totalMemories);
  }
  
  // Create the streaming message element
  console.log('💬 UI: Creating streaming message element...');
  createStreamingMessage();
});

window.electronAPI.onAnswerChunk((chunk) => {
  // Append chunk to the streaming message
  appendToStreamingMessage(chunk);
});

window.electronAPI.onAnswerComplete(() => {
  console.log('✅ UI: Streaming complete!');
  
  // Finalize the streaming message
  finalizeStreamingMessage();
  
  // Re-enable input
  console.log('🔓 UI: Re-enabling input...');
  isProcessing = false;
  messageInput.disabled = false;
  sendButton.disabled = false;
  messageInput.focus();
  console.log('✅ UI: Ready for next question\n');
});

window.electronAPI.onAnswerError((error) => {
  console.error('❌ UI: Streaming error:', error);
  
  // Remove thinking indicator and streaming message if any
  removeThinkingIndicator();
  const streamingMessage = document.getElementById('streaming-message');
  if (streamingMessage) {
    streamingMessage.remove();
  }
  
  // Show error message
  addMessage(error.message, 'assistant', true);
  
  // Re-enable input
  isProcessing = false;
  messageInput.disabled = false;
  sendButton.disabled = false;
  messageInput.focus();
});

console.log('📡 Streaming event listeners installed');

// Database selector toggle
dbSelectorBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  dbDropdown.classList.toggle('visible');
});

// Create new database
newDbBtn.addEventListener('click', async (e) => {
  e.stopPropagation();
  const name = await showPromptDialog('Enter a name for the new database:', 'New Database');
  if (name) {
    const result = await window.electronAPI.createDatabase(name);
    if (result.success) {
      await renderDatabaseList();
      // Optionally switch to the new database
      await switchToDatabase(result.id);
    }
  }
  dbDropdown.classList.remove('visible');
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (!dbSelectorBtn.contains(target) && !dbDropdown.contains(target)) {
    dbDropdown.classList.remove('visible');
  }
});

// Settings modal handlers
settingsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  settingsModal.classList.add('visible');
  loadSettings();
});

settingsClose.addEventListener('click', () => {
  settingsModal.classList.remove('visible');
});

// Close settings modal when clicking outside
settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) {
    settingsModal.classList.remove('visible');
  }
});

// Load current settings
async function loadSettings() {
  const settings = await window.electronAPI.getSettings();
  alwaysOnTopToggle.checked = settings.alwaysOnTop;
  clickThroughToggle.checked = settings.clickThrough;
  preventCaptureToggle.checked = settings.preventCapture;
  themeToggle.checked = settings.theme === 'light';
  isClickThroughEnabled = settings.clickThrough;
  
  // Apply theme
  applyTheme(settings.theme);
  
  // Load API settings
  await loadApiSettings();
}

// Load API settings
async function loadApiSettings() {
  const apiSettings = await window.electronAPI.getApiSettings();
  if (apiSettings) {
    apiProviderSelect.value = apiSettings.apiProvider;
    visionModelInput.value = apiSettings.models.vision;
    
    // Update base URL and API key based on provider
    updateApiFieldsForProvider(apiSettings.apiProvider, apiSettings);
  }
}

// Update API fields when provider changes
function updateApiFieldsForProvider(provider: string, settings?: any) {
  if (settings) {
    baseUrlInput.value = settings.baseUrls[provider];
    apiKeyInput.value = settings.apiKeys[provider] || '';
  }
}

// Save API settings
async function saveApiSettings() {
  const settings = {
    apiProvider: apiProviderSelect.value,
    apiKeys: {
      [apiProviderSelect.value]: apiKeyInput.value
    },
    models: {
      vision: visionModelInput.value,
      terminal: 'x-ai/grok-4-fast:free' // Keep default for now
    },
    baseUrls: {
      [apiProviderSelect.value]: baseUrlInput.value
    }
  };
  
  const result = await window.electronAPI.saveApiSettings(settings);
  
  if (result.success) {
    console.log('✅ API settings saved successfully');
    // Show success feedback
    saveApiSettingsBtn.textContent = 'Saved!';
    saveApiSettingsBtn.style.background = '#10a37f';
    setTimeout(() => {
      saveApiSettingsBtn.textContent = 'Save API Settings';
      saveApiSettingsBtn.style.background = '';
    }, 2000);
  } else {
    console.error('❌ Failed to save API settings:', result.message);
    // Show error feedback
    saveApiSettingsBtn.textContent = 'Error!';
    saveApiSettingsBtn.style.background = '#e74c3c';
    setTimeout(() => {
      saveApiSettingsBtn.textContent = 'Save API Settings';
      saveApiSettingsBtn.style.background = '';
    }, 2000);
  }
}

// API Settings handlers
apiProviderSelect.addEventListener('change', async () => {
  const apiSettings = await window.electronAPI.getApiSettings();
  if (apiSettings) {
    updateApiFieldsForProvider(apiProviderSelect.value, apiSettings);
  }
});

saveApiSettingsBtn.addEventListener('click', async () => {
  await saveApiSettings();
});

// Always on top toggle
alwaysOnTopToggle.addEventListener('change', async () => {
  await window.electronAPI.setAlwaysOnTop(alwaysOnTopToggle.checked);
});

// Click-through toggle
clickThroughToggle.addEventListener('change', async () => {
  isClickThroughEnabled = clickThroughToggle.checked;
  await window.electronAPI.setClickThrough(clickThroughToggle.checked);
  updateClickThrough();
});

// Prevent capture toggle
preventCaptureToggle.addEventListener('change', async () => {
  await window.electronAPI.setPreventCapture(preventCaptureToggle.checked);
});

// Theme toggle
function applyTheme(theme: 'dark' | 'light') {
  document.body.setAttribute('data-theme', theme);
}

themeToggle.addEventListener('change', async () => {
  const theme = themeToggle.checked ? 'light' : 'dark';
  applyTheme(theme);
  await window.electronAPI.setTheme(theme);
});

// Screenshot toggle button
async function updateScreenshotButton() {
  isCapturing = await window.electronAPI.getCaptureStatus();
  if (isCapturing) {
    screenshotToggleBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="6" y="6" width="12" height="12"></rect>
      </svg>
    `;
    screenshotToggleBtn.title = 'Stop Screenshots';
    screenshotToggleBtn.classList.add('active');
  } else {
    screenshotToggleBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
        <circle cx="12" cy="13" r="4"></circle>
      </svg>
    `;
    screenshotToggleBtn.title = 'Start Screenshots';
    screenshotToggleBtn.classList.remove('active');
  }
}

screenshotToggleBtn.addEventListener('click', async (e) => {
  e.stopPropagation();
  if (isCapturing) {
    await window.electronAPI.stopCapture();
  } else {
    await window.electronAPI.startCapture();
  }
  await updateScreenshotButton();
});

// Initialize screenshot button state
updateScreenshotButton();


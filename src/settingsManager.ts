import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Project root directory (one level up from dist)
const projectRoot = path.join(__dirname, '..');
const SETTINGS_FILE = path.join(projectRoot, 'user-settings.json');

export interface UserSettings {
  apiProvider: 'openrouter' | 'openai' | 'anthropic';
  apiKeys: {
    openrouter?: string;
    openai?: string;
    anthropic?: string;
  };
  models: {
    vision: string;
    terminal: string;
  };
  baseUrls: {
    openrouter: string;
    openai: string;
    anthropic: string;
  };
}

// Default settings
const DEFAULT_SETTINGS: UserSettings = {
  apiProvider: 'openrouter',
  apiKeys: {
    openrouter: '',
    openai: '',
    anthropic: '',
  },
  models: {
    vision: 'mistralai/pixtral-12b',
    terminal: 'x-ai/grok-4-fast:free',
  },
  baseUrls: {
    openrouter: 'https://openrouter.ai/api/v1',
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
  },
};

let cachedSettings: UserSettings | null = null;

/**
 * Load user settings from file
 * Falls back to environment variables and defaults if file doesn't exist
 */
export async function loadSettings(): Promise<UserSettings> {
  if (cachedSettings) {
    return cachedSettings;
  }

  try {
    // Try to load from file
    const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
    cachedSettings = JSON.parse(data);
    
    // Merge with defaults to ensure all fields exist
    cachedSettings = {
      ...DEFAULT_SETTINGS,
      ...cachedSettings,
      apiKeys: {
        ...DEFAULT_SETTINGS.apiKeys,
        ...(cachedSettings?.apiKeys || {}),
      },
      models: {
        ...DEFAULT_SETTINGS.models,
        ...(cachedSettings?.models || {}),
      },
      baseUrls: {
        ...DEFAULT_SETTINGS.baseUrls,
        ...(cachedSettings?.baseUrls || {}),
      },
    };
    
    return cachedSettings;
  } catch (err) {
    // File doesn't exist, try to load from .env
    console.log('📝 No user settings file found, checking environment variables...');
    
    const settings: UserSettings = { ...DEFAULT_SETTINGS };
    
    // Check for API keys in environment
    if (process.env.OPENROUTER_API_KEY) {
      settings.apiKeys.openrouter = process.env.OPENROUTER_API_KEY;
      settings.apiProvider = 'openrouter';
      console.log('✅ Found OPENROUTER_API_KEY in environment');
    }
    
    if (process.env.OPENAI_API_KEY) {
      settings.apiKeys.openai = process.env.OPENAI_API_KEY;
      console.log('✅ Found OPENAI_API_KEY in environment');
    }
    
    if (process.env.ANTHROPIC_API_KEY) {
      settings.apiKeys.anthropic = process.env.ANTHROPIC_API_KEY;
      console.log('✅ Found ANTHROPIC_API_KEY in environment');
    }
    
    // Save these settings to file for future use
    if (settings.apiKeys.openrouter || settings.apiKeys.openai || settings.apiKeys.anthropic) {
      await saveSettings(settings);
      console.log('💾 Saved environment settings to user-settings.json');
    }
    
    cachedSettings = settings;
    return settings;
  }
}

/**
 * Save user settings to file
 */
export async function saveSettings(settings: UserSettings): Promise<void> {
  try {
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
    cachedSettings = settings;
    console.log('💾 User settings saved successfully');
  } catch (err) {
    console.error('❌ Failed to save settings:', err);
    throw new Error('Failed to save settings');
  }
}

/**
 * Update specific settings fields
 */
export async function updateSettings(partial: Partial<UserSettings>): Promise<UserSettings> {
  const current = await loadSettings();
  const updated: UserSettings = {
    ...current,
    ...partial,
    apiKeys: {
      ...current.apiKeys,
      ...partial.apiKeys,
    },
    models: {
      ...current.models,
      ...partial.models,
    },
    baseUrls: {
      ...current.baseUrls,
      ...partial.baseUrls,
    },
  };
  
  await saveSettings(updated);
  return updated;
}

/**
 * Get the current API key for the active provider
 */
export async function getActiveApiKey(): Promise<string> {
  const settings = await loadSettings();
  const key = settings.apiKeys[settings.apiProvider];
  
  if (!key) {
    throw new Error(`No API key configured for provider: ${settings.apiProvider}`);
  }
  
  return key;
}

/**
 * Get the base URL for the active provider
 */
export async function getActiveBaseUrl(): Promise<string> {
  const settings = await loadSettings();
  return settings.baseUrls[settings.apiProvider];
}

/**
 * Check if settings are configured
 */
export async function isConfigured(): Promise<boolean> {
  try {
    const settings = await loadSettings();
    return !!settings.apiKeys[settings.apiProvider];
  } catch {
    return false;
  }
}

/**
 * Clear cache (useful after updates)
 */
export function clearCache(): void {
  cachedSettings = null;
}


import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Project root directory (one level up from dist)
const projectRoot = path.join(__dirname, '..');

interface Config {
  app: {
    name: string;
    version: string;
    description: string;
  };
  capture: {
    interval: number;
    processing_delay: number;
    output_directory: string;
    similarity_threshold: number;
  };
  ai: {
    openrouter: {
      base_url: string;
      vision_model: string;
      terminal_model: string;
      timeout: number;
      max_retries: number;
    };
    ollama: {
      model: string;
      base_url: string;
    };
  };
  rag: {
    top_k: number;
    min_similarity: number;
  };
  ui: {
    window: {
      width_percentage: number;
      height: number;
      position: string;
    };
    popup: {
      auto_hide: boolean;
      hide_delay: number;
      show_memory_count: boolean;
    };
    tray: {
      enabled: boolean;
      update_interval: number;
    };
  };
  shortcuts: {
    quit: string;
    escape: string;
  };
  debug: {
    enabled: boolean;
    verbose_logging: boolean;
    log_renderer_console: boolean;
  };
}

// Simple YAML parser for our config file
function parseYaml(content: string): any {
  const lines = content.split('\n');
  const result: any = {};
  let currentSection: any = result;
  const sectionStack: any[] = [result];
  const indentStack: number[] = [0];

  for (const line of lines) {
    // Skip comments and empty lines
    if (line.trim().startsWith('#') || line.trim() === '') {
      continue;
    }

    // Calculate indentation
    const indent = line.search(/\S/);
    if (indent === -1) continue;

    // Parse key-value
    const trimmed = line.trim();
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;

    const key = trimmed.substring(0, colonIndex).trim();
    let value: any = trimmed.substring(colonIndex + 1).trim();

    // Parse value types
    if (value === '') {
      value = {};
    } else if (value === 'true') {
      value = true;
    } else if (value === 'false') {
      value = false;
    } else if (!isNaN(Number(value)) && value !== '') {
      value = Number(value);
    } else if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    // Handle indentation levels
    while (indent <= (indentStack[indentStack.length - 1] ?? 0) && sectionStack.length > 1) {
      sectionStack.pop();
      indentStack.pop();
    }

    currentSection = sectionStack[sectionStack.length - 1];
    currentSection[key] = value;

    // If value is an object, prepare for nested properties
    if (typeof value === 'object' && !Array.isArray(value)) {
      sectionStack.push(value);
      indentStack.push(indent);
    }
  }

  return result;
}

let cachedConfig: Config | null = null;

export function loadConfig(): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = path.join(projectRoot, 'config.yml');
  
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    cachedConfig = parseYaml(content) as Config;
    return cachedConfig;
  } catch (err) {
    console.error('Failed to load config.yml, using defaults:', err);
    
    // Return default config
    return {
      app: {
        name: 'Memory Bench',
        version: '1.0.0',
        description: 'Screenshot Memory System with RAG'
      },
      capture: {
        interval: 3000,
        processing_delay: 1000,
        output_directory: 'tmp',
        similarity_threshold: 0.95
      },
      ai: {
        openrouter: {
          base_url: 'https://openrouter.ai/api/v1',
          vision_model: 'mistralai/pixtral-12b',
          terminal_model: 'x-ai/grok-4-fast:free',
          timeout: 60000,
          max_retries: 2
        },
        ollama: {
          model: 'embeddinggemma:latest',
          base_url: 'http://localhost:11434'
        }
      },
      rag: {
        top_k: 5,
        min_similarity: 0.0
      },
      ui: {
        window: {
          width_percentage: 100,
          height: 600,
          position: 'bottom'
        },
        popup: {
          auto_hide: true,
          hide_delay: 30000,
          show_memory_count: true
        },
        tray: {
          enabled: true,
          update_interval: 5000
        }
      },
      shortcuts: {
        quit: 'CommandOrControl+Q',
        escape: 'Escape'
      },
      debug: {
        enabled: false,
        verbose_logging: false,
        log_renderer_console: true
      }
    };
  }
}

export const config = loadConfig();


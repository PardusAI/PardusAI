export { config, loadConfig } from './config.js';
export { chatWithImage, chatStream } from './model.js';
export { 
  SCREENSHOT_DESCRIPTION_PROMPT, 
  generateQuestionAnswerPrompt, 
  formatImageContext, 
  NO_MEMORIES_MESSAGE 
} from './prompts.js';
export { authManager } from './auth.js';
# Changelog

## [Unreleased] - 2025-10-03

### Added
- **prompts.ts**: Centralized all AI prompts in a single file
  - `SCREENSHOT_DESCRIPTION_PROMPT`: For screenshot descriptions
  - `generateQuestionAnswerPrompt()`: For question answering with context
  - `formatImageContext()`: Helper for formatting image metadata
  - `NO_MEMORIES_MESSAGE`: Standard error message

- **config.yml**: Application configuration file
  - Screenshot capture settings (interval, delays, directories)
  - AI model configuration (OpenRouter, Ollama)
  - RAG settings (top_k, similarity thresholds)
  - UI settings (window size, popup behavior, tray icon)
  - Keyboard shortcuts configuration
  - Debug settings

- **docker-compose.yml**: Docker setup for easy deployment
  - Memory Bench service with Node.js
  - Ollama service for embeddings
  - Volume mounts for data persistence
  - Automatic model pulling on startup

- **CONTRIBUTING.md**: Comprehensive developer guide
  - Development setup instructions
  - Project architecture documentation
  - Code style guidelines
  - Debugging tips
  - Pull request process

- **QUICKSTART.md**: Fast-track setup guide for new users

### Changed
- **README.md**: Completely reorganized and enhanced
  - Added clear feature list with emojis
  - Improved quick start section
  - Added Docker instructions
  - Enhanced troubleshooting section
  - Better project structure documentation
  - Added configuration section

- **electron-main.ts**: Updated to use centralized prompts
  - Import prompts from `prompts.ts`
  - Use `SCREENSHOT_DESCRIPTION_PROMPT` constant
  - Use `generateQuestionAnswerPrompt()` function
  - Use `NO_MEMORIES_MESSAGE` constant

- **index.ts**: Updated to use centralized prompts
  - Same changes as electron-main.ts
  - Consistent prompt usage across all entry points

- **.gitignore**: Updated to keep `screenshot.png` while ignoring other PNG files

### Removed
- **ALL-FIXES-SUMMARY.md**: Content consolidated into README.md
- **CLICK-THROUGH-FIX.md**: Content consolidated into CONTRIBUTING.md
- **CRITICAL-FIXES.md**: Content consolidated into README.md
- **ENV-FIX.md**: Content consolidated into README.md and QUICKSTART.md
- **EPIPE-AND-TRAY-FIX.md**: Content consolidated into CONTRIBUTING.md
- **FINAL-TEST.md**: Content consolidated into CONTRIBUTING.md
- **FIXES.md**: Content consolidated into README.md
- **HOW-TO-QUIT.md**: Content consolidated into README.md
- **QUICK-START.md**: Replaced with QUICKSTART.md
- **RUN.md**: Content consolidated into README.md and QUICKSTART.md
- **SETUP.md**: Content consolidated into README.md and QUICKSTART.md
- **TESTING-GUIDE.md**: Content consolidated into CONTRIBUTING.md
- **TROUBLESHOOTING.md**: Content consolidated into README.md
- **URGENT-DEBUG.md**: Content consolidated into CONTRIBUTING.md
- **START-HERE.txt**: Content consolidated into QUICKSTART.md

### Benefits

**For Users:**
- Single README.md with all essential information
- Quick start guide for fast setup
- Clear configuration via YAML file
- Docker support for easy deployment
- Better organized documentation

**For Developers:**
- Centralized prompts make them easy to modify
- Clear development guidelines in CONTRIBUTING.md
- Configuration file for easy customization
- Better code organization and maintainability
- Reduced code duplication

**For Project:**
- Cleaner root directory (15 MD files → 4)
- Professional project structure
- Easier to navigate and maintain
- Better separation of concerns
- Scalable architecture as project grows

### Technical Details

**Files Created:**
- `src/prompts.ts` (47 lines)
- `config.yml` (85 lines)
- `docker-compose.yml` (43 lines)
- `CONTRIBUTING.md` (375 lines)
- `QUICKSTART.md` (134 lines)
- `CHANGELOG.md` (this file)

**Files Modified:**
- `README.md` (complete rewrite, 283 lines)
- `src/electron-main.ts` (added imports, replaced hardcoded prompts)
- `src/index.ts` (added imports, replaced hardcoded prompts)
- `.gitignore` (updated to keep screenshot.png)

**Files Deleted:**
- 15 documentation files (MD and TXT)

**Build Status:**
- ✅ TypeScript compilation successful
- ✅ No linter errors
- ✅ All imports resolved correctly
- ✅ Build output clean

---

## Migration Notes

If you were using the old documentation structure:

- **Setup instructions**: Now in README.md and QUICKSTART.md
- **Troubleshooting**: Now in README.md (Troubleshooting section)
- **Development guide**: Now in CONTRIBUTING.md
- **Quick start**: Now in QUICKSTART.md
- **Configuration**: Now in config.yml (not yet fully integrated into code)

## Future Improvements

Planned enhancements:
- [ ] Load configuration from config.yml at runtime
- [ ] Add config validation
- [ ] Add automated tests
- [ ] Add CI/CD pipeline
- [ ] Add more detailed examples
- [ ] Create wiki for advanced topics


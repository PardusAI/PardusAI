import screenshot from 'screenshot-desktop';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import readline from 'readline';
import OpenAI from 'openai';
import { chatWithImage } from './core/model.js';
import { retrieveTopK } from './utils/embeddings.js';
import { MemoryDatabase } from './database/database.js';
import { EmbeddingQueue } from './utils/embeddingQueue.js';
import { SCREENSHOT_DESCRIPTION_PROMPT, generateQuestionAnswerPrompt, formatImageContext } from './core/prompts.js';
import { config } from './core/config.js';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize database and embedding queue
const DB_PATH = path.join(__dirname, 'data', 'memories.json');
const db = new MemoryDatabase(DB_PATH);
const embeddingQueue = new EmbeddingQueue(db, 1000);

async function compareImages(img1: string, img2: string): Promise<boolean> {
  try {
    // Use ffmpeg to compare images (SSIM similarity)
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
    const filePath = path.join(__dirname, `${config.capture.output_directory}/${time}_screenshot.png`);

    await screenshot({ filename: filePath });

    if (previousPath) {
      const areSame = await compareImages(previousPath, filePath);
      if (areSame) {
        await fs.unlink(filePath);
        return previousPath; // Keep previous
      }
    }

    // Process screenshot asynchronously (generate description and add to queue)
    processScreenshot(filePath).catch(() => {
      // Silent error handling for background processing
    });
    
    return filePath;
  } catch (err) {
    // Silent error handling - don't spam console
    return previousPath;
  }
}

/**
 * Process a screenshot by generating a description and adding to embedding queue
 * The embedding will be generated later by the background queue
 */
async function processScreenshot(imagePath: string): Promise<void> {
  try {
    // Get summary from OpenRouter
    const description = await chatWithImage(
      SCREENSHOT_DESCRIPTION_PROMPT,
      imagePath
    );
    
    // Add to database (embedding will be done by the queue)
    await db.addMemory(imagePath, description);
  } catch (err) {
    // Silent error handling
  }
}

/**
 * Ask a question with multiple images sent to the model
 */
async function askWithImages(
  question: string, 
  topResults: Array<{ memory: any; similarity: number }>
): Promise<string> {
  // Build the prompt with image references
  const imageContext = formatImageContext(topResults);
  const prompt = generateQuestionAnswerPrompt(question, topResults.length, imageContext);

  // Read all images and create content array
  const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    { type: 'text', text: prompt }
  ];

  // Add all images
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

  // Send to OpenRouter with images
  const openrouter = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  const completion = await openrouter.chat.completions.create({
    model: config.ai.openrouter.terminal_model,
    messages: [
      {
        role: 'user',
        content: content as any
      }
    ],
  });

  return completion.choices[0]?.message?.content || 'No response';
}

/**
 * Continuous screenshot capture loop
 */
async function captureLoop(): Promise<void> {
  let lastSavedPath: string | null = null;
  let captureCount = 0;

  while (true) {
    try {
      captureCount++;
      lastSavedPath = await captureScreen(lastSavedPath);
      await new Promise(resolve => setTimeout(resolve, config.capture.interval));
    } catch (err) {
      console.error('Error in capture loop:', err);
      // Continue capturing even if there's an error
      await new Promise(resolve => setTimeout(resolve, config.capture.interval));
    }
  }
}

/**
 * Interactive Q&A loop - ask questions anytime
 * Runs concurrently with screenshot capture
 */
async function qaLoop(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const askQuestion = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, (answer) => {
        resolve(answer);
      });
    });
  };

  console.log('\n=== Memory Bench Q&A ===');
  console.log('📸 Screenshots are being captured continuously in the background');
  console.log('🔄 Embeddings are being processed one by one in the queue');
  console.log('💬 Ask questions anytime! Type "exit" to quit\n');

  while (true) {
    const question = await askQuestion('💭 Question: ');
    
    if (question.toLowerCase() === 'exit' || question.toLowerCase() === 'quit') {
      console.log('\n👋 Exiting...');
      rl.close();
      process.exit(0);
    }

    if (!question.trim()) {
      continue;
    }

    // Get database statistics
    const stats = db.getStats();
    
    if (stats.total === 0) {
      console.log('⏳ No memories yet. Capturing first screenshot... (ask again in a moment)\n');
      continue;
    }

    if (stats.embedded === 0) {
      console.log(`⏳ Processing embeddings... (${stats.pending} pending, ${stats.processing} processing)\n`);
      console.log('   Ask again in a moment once some embeddings are ready!\n');
      continue;
    }

    try {
      console.log(`🔍 Searching ${stats.embedded} embedded memories (${stats.pending} still pending)...\n`);
      
      // Retrieve top 3 relevant memories from database
      const topResults = await retrieveTopK(question, db, 3);
      
      if (topResults.length === 0) {
        console.log('⏳ No embedded memories available yet. Please wait...\n');
        continue;
      }
      
      console.log(`📋 Top ${topResults.length} relevant screenshots:`);
      topResults.forEach((result, idx) => {
        const date = new Date(result.memory.time).toLocaleString();
        console.log(`  ${idx + 1}. [${date}] Similarity: ${result.similarity.toFixed(3)}`);
        console.log(`     ${result.memory.description.substring(0, 120)}...`);
      });

      // Ask OpenRouter with actual images
      console.log('\n🤖 Analyzing images and generating answer...');
      const answer = await askWithImages(question, topResults);

      console.log('\n📝 Answer:');
      console.log(answer);
      console.log('\n' + '─'.repeat(60) + '\n');
    } catch (err) {
      console.error('❌ Error:', err);
      console.log('');
    }
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting Memory Bench\n');
  
  // Log config settings
  console.log('⚙️  Configuration loaded:');
  console.log(`   Screenshot interval: ${config.capture.interval}ms`);
  console.log(`   Processing delay: ${config.capture.processing_delay}ms`);
  console.log(`   Terminal model: ${config.ai.openrouter.terminal_model}`);
  console.log(`   Embedding model: ${config.ai.ollama.model}\n`);
  
  // Initialize database
  console.log('📂 Loading database...');
  await db.initialize();
  const stats = db.getStats();
  console.log(`   Found ${stats.total} existing memories (${stats.embedded} embedded, ${stats.pending} pending)\n`);
  
  // Start embedding queue
  console.log('🔄 Starting embedding queue...\n');
  embeddingQueue.start();
  
  // Run both loops concurrently
  // captureLoop runs silently in the background
  // qaLoop allows you to ask questions anytime
  await Promise.all([
    captureLoop(),
    qaLoop()
  ]);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down gracefully...');
  embeddingQueue.stop();
  const stats = db.getStats();
  console.log(`📊 Database statistics:`);
  console.log(`   Total memories: ${stats.total}`);
  console.log(`   Embedded: ${stats.embedded}`);
  console.log(`   Pending: ${stats.pending}`);
  console.log(`   Processing: ${stats.processing}`);
  console.log(`   Failed: ${stats.failed}`);
  process.exit(0);
});

main().catch(console.error);
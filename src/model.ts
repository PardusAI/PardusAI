import OpenAI from 'openai';
import fs from 'fs/promises';
import { config } from './config.js';

// Lazy initialization - only create client when first needed
// This ensures environment variables are loaded first
let openrouter: OpenAI | null = null;

function getOpenRouterClient(): OpenAI {
  if (!openrouter) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY not found in environment! Make sure you have a .env file with OPENROUTER_API_KEY=your-key');
    }
    
    openrouter = new OpenAI({
      baseURL: config.ai.openrouter.base_url,
      apiKey: apiKey,
      timeout: config.ai.openrouter.timeout,
      maxRetries: config.ai.openrouter.max_retries,
    });
  }
  
  return openrouter;
}

export interface ChatMessage {
  text: string;
  imagePath?: string;
}

/**
 * Send a message with optional image to OpenRouter using grok-4-fast:free model
 * @param message - The message object containing text and optional image path
 * @returns The response from the model
 */
export async function chat(message: ChatMessage): Promise<string> {
  try {
    const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
      { type: 'text', text: message.text }
    ];

    // If image path is provided, add it to the content
    if (message.imagePath) {
      // Read the image file and convert to base64
      const imageBuffer = await fs.readFile(message.imagePath);
      const base64Image = imageBuffer.toString('base64');
      const mimeType = message.imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
      
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${base64Image}`
        }
      });
    }

    // Get client (lazy initialization ensures env vars are loaded)
    const client = getOpenRouterClient();
    
    const completion = await client.chat.completions.create({
      model: config.ai.openrouter.vision_model,
      messages: [
        {
          role: 'user',
          content: content as any
        }
      ],
    });

    return completion.choices[0]?.message?.content || 'No response';
  } catch (error) {
    console.error('Error calling OpenRouter:', error);
    throw error;
  }
}

/**
 * Send a simple text-only message
 * @param text - The text message to send
 * @returns The response from the model
 */
export async function chatText(text: string): Promise<string> {
  return chat({ text });
}

/**
 * Send a message with an image
 * @param text - The text message to send
 * @param imagePath - Path to the image file
 * @returns The response from the model
 */
export async function chatWithImage(text: string, imagePath: string): Promise<string> {
  return chat({ text, imagePath });
}

/**
 * Stream a chat completion with optional image
 * @param message - The message object containing text and optional image path
 * @param onChunk - Callback function called for each chunk of the stream
 * @returns Promise that resolves when streaming is complete
 */
export async function chatStream(
  message: ChatMessage,
  onChunk: (chunk: string) => void
): Promise<void> {
  try {
    const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
      { type: 'text', text: message.text }
    ];

    // If image path is provided, add it to the content
    if (message.imagePath) {
      // Read the image file and convert to base64
      const imageBuffer = await fs.readFile(message.imagePath);
      const base64Image = imageBuffer.toString('base64');
      const mimeType = message.imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
      
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${base64Image}`
        }
      });
    }

    // Get client (lazy initialization ensures env vars are loaded)
    const client = getOpenRouterClient();
    
    const stream = await client.chat.completions.create({
      model: config.ai.openrouter.vision_model,
      messages: [
        {
          role: 'user',
          content: content as any
        }
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        onChunk(content);
      }
    }
  } catch (error) {
    console.error('Error calling OpenRouter:', error);
    throw error;
  }
}


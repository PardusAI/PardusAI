/**
 * Centralized prompts for AI interactions
 * All prompts used in the Memory Bench application
 */

/**
 * Prompt for generating screenshot descriptions
 * Used when processing each captured screenshot
 */
export const SCREENSHOT_DESCRIPTION_PROMPT = 
  `
    Please provide a detailed, descriptive summary of what is shown in this screenshot.
    Point out all the details in the screenshot. You should specifically metion the content, text and image on the screenshot.
    This would be used to retrival the screenshot when user ask a question.
  `;

/**
 * Generate prompt for answering questions with screenshots
 * @param question - The user's question
 * @param resultsCount - Number of screenshots being analyzed
 * @param imageContext - Formatted string with image metadata
 * @returns The complete prompt for the AI
 */
export function generateQuestionAnswerPrompt(
  question: string,
  resultsCount: number,
  imageContext: string
): string {
  return `
  I'm showing you ${resultsCount} screenshots from my computer activity. 
  Please analyze these images and answer the following question based on what you see in them.

Question: ${question}

Images shown:
${imageContext}

Please provide a detailed answer based on the actual content visible in the images.`;
}

/**
 * Format image context for display in prompts
 * @param results - Array of memory results with timestamp and similarity
 * @returns Formatted string with image metadata
 */
export function formatImageContext<T extends { time: number }>(
  results: Array<{ memory: T; similarity: number }>
): string {
  return results.map((result, idx) => {
    const date = new Date(result.memory.time).toLocaleString();
    return `Image ${idx + 1} (captured at ${date})`;
  }).join('\n');
}

/**
 * Error message when no memories are available
 */
export const NO_MEMORIES_MESSAGE = 
  'No memories captured yet. Please wait a moment for the first screenshot to be processed.';


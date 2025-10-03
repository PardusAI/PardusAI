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
    Provide a comprehensive and detailed description of the screenshot. Explicitly mention and describe:

  - **All visible text**: headings, labels, buttons, tooltips, body text, and any other written content.  
  - **Images, icons, logos, or graphics**: identify and describe them clearly.  
  - **Layout and structure**: menus, navigation bars, dialog boxes, pop-ups, or any interface components.  
  - **Visual details**: colors, formatting, highlights, emphasis, or unique elements that distinguish this screenshot.  

  The goal is to create a descriptive summary that makes this screenshot **easily retrievable** when a user asks a related question.
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
    You are given **${resultsCount} screenshots** from my computer activity.  
    Carefully analyze the visible content in these images and use it to answer the question below.

    **Question:**  
    ${question}

    **Screenshots provided:**  
    ${imageContext}

    **Instructions for your response:**  
    - Base your answer only on the actual content visible in the screenshots.  
    - Reference any relevant **text, images, icons, or layout details** from the screenshots.  
    - Provide a clear, detailed, and accurate explanation that directly addresses the question.
    - Use **markdown formatting** for better readability (bold, lists, code blocks, etc.).
    - **IMPORTANT**: For ANY mathematical expressions, equations, or formulas, you MUST wrap them in LaTeX delimiters:
      * Use $...$ for inline math (e.g., $E = mc^2$ or $\sigma \in \Gamma(X, \mathcal{O}_X(B))$)
      * Use $$...$$ for display/block math (e.g., $$x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}$$)
      * Never write raw LaTeX without delimiters

    `;
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


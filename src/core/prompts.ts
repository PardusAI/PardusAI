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
  - **You should ensure your content are in details. As detail as possible and as much as possible.
  - ** Be descriptive remember your job is just to detaily descrbe the image. 

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
    Your task is to **synthesize information across all screenshots** and use it to answer the question below.

    **Question:**
    ${question}

    **Screenshots provided:**
    ${imageContext}

    **Guidelines for your response:**

    * **Do not** describe or analyze each screenshot individually. Instead, integrate all visible information into a single, coherent answer.
    * Base your response **only** on the actual content visible in the screenshots.
    * Reference any relevant **text, images, icons, or layout details** that support your reasoning.
    * Provide a clear, detailed, and accurate explanation that directly addresses the question.
    * Use **markdown formatting** for readability (bold, lists, code blocks, etc.).
    * For **mathematical expressions, equations, or formulas**:

      * Use $...$ for inline math (e.g., $E = mc^2$ or $\sigma \in \Gamma(X, \mathcal{O}_X(B))$).
      * Use $$...$$ for block math (e.g., $$x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}$$).
      * Never write raw LaTeX without delimiters.
    * You should provide the URL / relative position for user to understand where to use the get back the information. 
    * You don't have to save based on the screenshot, instead just answer the question directly by saying based on the record.

    Your goal: Provide a **concise, synthesized explanation** that fully answers the question using only the evidence in the screenshots.
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


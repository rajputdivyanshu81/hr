import Groq from 'groq-sdk';
import { AgentPrompt } from './prompt_builder';

let groq: Groq;

function getGroqClient() {
    if (!groq) {
        groq = new Groq({
            apiKey: process.env.GROQ_API_KEY,
        });
    }
    return groq;
}

// We use a fast, capable model on Groq with better free tier rate limits
const DEFAULT_MODEL = 'llama-3.1-8b-instant';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

export interface AgentResponse {
    status: 'replied' | 'escalated';
    product_area: string;
    response: string;
    justification: string;
    request_type: string;
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validates the parsed response has all required fields with correct types.
 */
function validateResponse(parsed: any): AgentResponse {
    const status = ['replied', 'escalated'].includes(parsed?.status)
        ? parsed.status
        : 'escalated';

    return {
        status,
        product_area: typeof parsed?.product_area === 'string' ? parsed.product_area : 'unknown',
        response: typeof parsed?.response === 'string' ? parsed.response : '',
        justification: typeof parsed?.justification === 'string'
            ? parsed.justification
            : (status === 'escalated' ? 'Auto-escalated due to missing justification.' : ''),
        request_type: typeof parsed?.request_type === 'string' ? parsed.request_type : 'unknown'
    };
}

/**
 * Sends the prompt to the Groq API and parses the JSON response.
 * Includes retry logic with exponential backoff for rate limits and transient errors.
 */
export async function getLLMResponse(prompt: AgentPrompt): Promise<AgentResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const client = getGroqClient();
            const chatCompletion = await client.chat.completions.create({
                messages: [
                    { role: 'system', content: prompt.systemPrompt },
                    { role: 'user', content: prompt.userPrompt }
                ],
                model: DEFAULT_MODEL,
                temperature: 0,
                max_tokens: 1024,
                seed: 42, // deterministic outputs
                response_format: { type: 'json_object' }
            });

            const content = chatCompletion.choices[0]?.message?.content || '{}';
            const parsed = JSON.parse(content);
            return validateResponse(parsed);

        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            const errMsg = lastError.message || '';

            // Retry on rate limit (429) or server errors (5xx)
            if (errMsg.includes('429') || errMsg.includes('rate_limit') || errMsg.includes('503') || errMsg.includes('500')) {
                const delay = RETRY_DELAY_MS * attempt; // linear backoff
                console.warn(`  ⟳ Retry ${attempt}/${MAX_RETRIES} after ${delay}ms (${errMsg.substring(0, 80)}...)`);
                await sleep(delay);
                continue;
            }

            // Non-retryable error — break immediately
            break;
        }
    }

    // All retries exhausted or non-retryable error
    console.error("  ✗ LLM Error after retries:", lastError?.message?.substring(0, 100));
    return {
        status: 'escalated',
        product_area: 'system_error',
        response: '',
        justification: 'Escalated automatically due to LLM failure: ' + (lastError?.message || 'unknown'),
        request_type: 'unknown'
    };
}

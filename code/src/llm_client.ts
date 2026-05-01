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

export interface AgentResponse {
    status: 'replied' | 'escalated';
    product_area: string;
    response: string;
    justification: string;
    request_type: string;
}

/**
 * Sends the prompt to the Groq API and parses the JSON response.
 */
export async function getLLMResponse(prompt: AgentPrompt): Promise<AgentResponse> {
    try {
        const client = getGroqClient();
        const chatCompletion = await client.chat.completions.create({
            messages: [
                { role: 'system', content: prompt.systemPrompt },
                { role: 'user', content: prompt.userPrompt }
            ],
            model: DEFAULT_MODEL,
            temperature: 0.1, // low temperature for more deterministic JSON output
            max_tokens: 1024,
            response_format: { type: 'json_object' } // Enforce JSON object output natively
        });

        const content = chatCompletion.choices[0]?.message?.content || '{}';
        const parsed = JSON.parse(content) as AgentResponse;

        // Basic validation of required fields
        if (!parsed.status || !['replied', 'escalated'].includes(parsed.status)) {
            parsed.status = 'escalated'; // safe fallback
            parsed.justification = 'Fallback due to invalid JSON schema from LLM: ' + (parsed.justification || 'none');
        }

        return {
            status: parsed.status,
            product_area: parsed.product_area || 'unknown',
            response: parsed.response || '',
            justification: parsed.justification || 'No justification provided.',
            request_type: parsed.request_type || 'unknown'
        };

    } catch (error) {
        console.error("LLM Error:", error);
        // Safe fallback in case of API failure or parsing error
        return {
            status: 'escalated',
            product_area: 'system_error',
            response: '',
            justification: 'Escalated automatically due to LLM failure: ' + (error instanceof Error ? error.message : String(error)),
            request_type: 'unknown'
        };
    }
}

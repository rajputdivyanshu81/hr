import { SupportTicket } from './csv_handler';
import { AgentResponse } from './llm_client';

// Only escalate for truly dangerous situations that NO corpus can answer
// Note: "stolen" cards are an FAQ the Visa corpus CAN answer, so don't auto-escalate those
const CRITICAL_KEYWORDS = [
    'fraud', 'breach', 'sue', 'legal', 'lawsuit', 'lawyer',
    'hacked', 'unauthorized', 'phishing', 'scam'
];

const UNSURE_PHRASES = [
    'cannot provide a definitive answer',
    "couldn't find any specific information",
    'i do not have the information',
    'not explicitly mentioned',
    'unable to find relevant information'
];

const ALLOWED_REQUEST_TYPES = ['product_issue', 'feature_request', 'bug', 'invalid'];

/**
 * Pre-LLM safety check. If a ticket contains highly sensitive keywords,
 * it should bypass the LLM and escalate immediately.
 */
export function requiresImmediateEscalation(ticket: SupportTicket): boolean {
    const text = `${ticket.subject} ${ticket.issue}`.toLowerCase();
    for (const keyword of CRITICAL_KEYWORDS) {
        if (text.includes(keyword)) {
            return true;
        }
    }
    return false;
}

/**
 * Normalizes the request_type from the LLM to one of the four allowed values.
 */
function normalizeRequestType(rawType: string): string {
    const lower = rawType.toLowerCase().trim();

    // Direct matches
    if (ALLOWED_REQUEST_TYPES.includes(lower)) return lower;

    // Map common LLM outputs to allowed values
    if (lower.includes('bug') || lower.includes('outage') || lower.includes('down') || lower.includes('error')) return 'bug';
    if (lower.includes('feature') || lower.includes('enhancement') || lower.includes('request')) return 'feature_request';
    if (lower.includes('invalid') || lower.includes('spam') || lower.includes('irrelevant') || lower.includes('out_of_scope') || lower.includes('off_topic')) return 'invalid';

    // Default: most tickets are product issues
    return 'product_issue';
}

/**
 * Post-LLM safety check. Validates the LLM's response to ensure it isn't
 * pretending to reply while actually just telling the user to contact support.
 * Also normalizes request_type to allowed values.
 */
export function enforceEscalationSafety(response: AgentResponse): AgentResponse {
    // Always normalize request_type
    const normalizedType = normalizeRequestType(response.request_type);

    // If it's already escalated, just normalize and return
    if (response.status === 'escalated') {
        return { ...response, request_type: normalizedType };
    }

    const responseText = response.response.toLowerCase();
    const justificationText = response.justification.toLowerCase();

    // Check if the LLM's "reply" is actually an unsure answer
    for (const phrase of UNSURE_PHRASES) {
        if (responseText.includes(phrase) || justificationText.includes(phrase)) {
            return {
                ...response,
                status: 'escalated',
                response: '',
                justification: `Safety Layer Override: Model indicated uncertainty ("${phrase}"). Escalated to human.`,
                request_type: normalizedType
            };
        }
    }

    return { ...response, request_type: normalizedType };
}

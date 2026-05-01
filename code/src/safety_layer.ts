import { SupportTicket } from './csv_handler';
import { AgentResponse } from './llm_client';

const CRITICAL_KEYWORDS = [
    'fraud', 'stolen', 'breach', 'sue', 'legal', 'lawsuit', 'lawyer',
    'hacked', 'unauthorized', 'phishing', 'scam'
];

const UNSURE_PHRASES = [
    'cannot provide a definitive answer',
    "couldn't find any specific information",
    'please contact support',
    'reach out to your account manager',
    'contact us at',
    'i do not have the information',
    'not explicitly mentioned',
    'further assistance'
];

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
 * Post-LLM safety check. Validates the LLM's response to ensure it isn't
 * pretending to reply while actually just telling the user to contact support.
 */
export function enforceEscalationSafety(response: AgentResponse): AgentResponse {
    // If it's already escalated, it's safe.
    if (response.status === 'escalated') {
        return response;
    }

    const responseText = response.response.toLowerCase();
    const justificationText = response.justification.toLowerCase();

    // Check if the LLM's "reply" is actually an unsure answer or a redirection to human support
    for (const phrase of UNSURE_PHRASES) {
        if (responseText.includes(phrase) || justificationText.includes(phrase)) {
            return {
                ...response,
                status: 'escalated',
                response: '', // Don't send a fake reply to the user
                justification: `Safety Layer Override: Model attempted to reply but indicated uncertainty or redirected to support ("${phrase}"). Escalated to human.`
            };
        }
    }

    return response;
}

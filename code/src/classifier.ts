import { SupportTicket } from './csv_handler';

export type Domain = 'hackerrank' | 'claude' | 'visa' | 'unknown';

const DOMAIN_KEYWORDS: Record<Domain, string[]> = {
    hackerrank: [
        'hackerrank', 'test', 'assessment', 'code', 'coding', 'compiler', 
        'interview', 'candidate', 'community', 'challenge', 'score', 'ide'
    ],
    claude: [
        'claude', 'anthropic', 'prompt', 'model', 'tokens', 'bedrock', 
        'sonnet', 'opus', 'haiku', 'api', 'conversation', 'chat'
    ],
    visa: [
        'visa', 'card', 'payment', 'stolen', 'cheque', 'bank', 
        'transaction', 'credit', 'debit', 'merchant', 'atm'
    ],
    unknown: []
};

/**
 * Classifies the domain of a support ticket.
 * If the company field is provided and valid, it uses that.
 * Otherwise, it infers the domain based on keyword matching in the issue and subject.
 */
export function classifyDomain(ticket: SupportTicket): Domain {
    // 1. Check explicit company field
    const companyStr = ticket.company?.toLowerCase().trim();
    if (companyStr === 'hackerrank') return 'hackerrank';
    if (companyStr === 'claude') return 'claude';
    if (companyStr === 'visa') return 'visa';

    // 2. Infer from text if company is "none", missing, or unknown
    const textToAnalyze = `${ticket.subject} ${ticket.issue}`.toLowerCase();
    
    let bestDomain: Domain = 'unknown';
    let maxMatches = 0;

    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
        if (domain === 'unknown') continue;
        
        let matches = 0;
        for (const keyword of keywords) {
            // Use regex to match whole words where possible
            const regex = new RegExp(`\\b${keyword}\\b`, 'g');
            const found = textToAnalyze.match(regex);
            if (found) {
                matches += found.length;
            }
        }

        if (matches > maxMatches) {
            maxMatches = matches;
            bestDomain = domain as Domain;
        }
    }

    // Require at least a strong signal, else remain unknown
    if (maxMatches > 0) {
        return bestDomain;
    }

    return 'unknown';
}

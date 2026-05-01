import { SupportTicket } from './csv_handler';
import { RetrievedDocument } from './retriever';
import { Domain } from './classifier';

export interface AgentPrompt {
    systemPrompt: string;
    userPrompt: string;
}

export function buildPrompt(ticket: SupportTicket, domain: Domain, contextDocs: RetrievedDocument[]): AgentPrompt {
    const domainName = domain === 'unknown' ? 'Multiple/Unknown' : 
                       domain === 'hackerrank' ? 'HackerRank' :
                       domain === 'claude' ? 'Claude' : 'Visa';

    let contextString = "No relevant context found.";
    if (contextDocs.length > 0) {
        contextString = contextDocs.map((doc, i) => `
--- Document ${i + 1} ---
Title: ${doc.title}
URL: ${doc.url}
Content:
${doc.content.substring(0, 1500)}${doc.content.length > 1500 ? '... [truncated]' : ''}
`).join('\n');
    }

    const systemPrompt = `You are an expert Support Triage Agent for ${domainName}.
Your job is to analyze incoming support tickets and decide whether to automatically reply to them or escalate them to a human agent.
You must use ONLY the provided knowledge base (corpus documents) to answer. If the answer cannot be confidently and safely derived from the knowledge base, you MUST escalate the ticket.

Output your response STRICTLY as a JSON object with the following schema:
{
  "status": "replied" or "escalated",
  "product_area": "string — the most relevant support category or domain area (e.g., screen, privacy, community, travel_support, general_support, conversation_management)",
  "response": "string — your reply to the user if status is 'replied'. If status is 'escalated', leave this as an empty string.",
  "justification": "string — a concise explanation of your routing decision and which corpus docs you used",
  "request_type": "string — MUST be exactly one of: product_issue, feature_request, bug, invalid"
}

CRITICAL RULES:
1. Do NOT hallucinate or invent information. Rely solely on the provided context documents.
2. If the ticket is about a real product issue or question that the corpus can answer, use request_type "product_issue".
3. If the ticket asks for a new feature or capability, use request_type "feature_request".
4. If the ticket reports a system bug, outage, or malfunction, use request_type "bug".
5. If the ticket is irrelevant, off-topic, spam, or not a real support request, use request_type "invalid".
6. If the corpus provides a clear answer to the question, set status to "replied" and provide a helpful, corpus-grounded response.
7. If the issue is too complex, involves account-specific actions requiring admin access, or the corpus doesn't have a clear answer, set status to "escalated".
8. For lost/stolen card reports where the corpus provides emergency contact numbers, you SHOULD reply with those numbers — that IS an answerable FAQ.
9. Return ONLY valid JSON. Do not include markdown formatting.`;

    const userPrompt = `Incoming Support Ticket:
Subject: ${ticket.subject}
Issue: ${ticket.issue}
Company/Domain Hint: ${ticket.company || 'None'}

Retrieved Knowledge Base Context:
${contextString}

Analyze the ticket and generate the JSON response.`;

    return { systemPrompt, userPrompt };
}

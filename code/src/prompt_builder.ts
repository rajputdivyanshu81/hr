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
  "status": "replied" | "escalated",
  "product_area": "string (the general category of the issue)",
  "response": "string (your reply to the user if status is 'replied', or an internal note if 'escalated')",
  "justification": "string (reasoning for why you chose to reply or escalate)",
  "request_type": "string (e.g., 'billing_issue', 'technical_support', 'general_inquiry')"
}

CRITICAL RULES:
1. Do not hallucinate or invent information. Rely solely on the provided context.
2. For sensitive topics (e.g., fraud, major security breaches, complex billing disputes that aren't FAQs), choose "escalated".
3. Return ONLY valid JSON. Do not include markdown formatting like \`\`\`json.`;

    const userPrompt = `Incoming Support Ticket:
Subject: ${ticket.subject}
Issue: ${ticket.issue}
Company/Domain Hint: ${ticket.company || 'None'}

Retrieved Knowledge Base Context:
${contextString}

Analyze the ticket and generate the JSON response.`;

    return { systemPrompt, userPrompt };
}

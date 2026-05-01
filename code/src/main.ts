import * as dotenv from 'dotenv';
import * as path from 'path';
import { readTickets, writeOutput, OutputTicket } from './csv_handler';
import { loadCorpus } from './corpus_loader';
import { CorpusRetriever } from './retriever';
import { classifyDomain } from './classifier';
import { buildPrompt } from './prompt_builder';
import { getLLMResponse, AgentResponse } from './llm_client';
import { requiresImmediateEscalation, enforceEscalationSafety } from './safety_layer';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Rate-limit helper: wait between API calls to stay within free tier
function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log("Starting HackerRank Orchestrate Support Agent...");
    
    // Ensure API key is present
    if (!process.env.GROQ_API_KEY) {
        console.error("Error: GROQ_API_KEY is missing from .env file.");
        process.exit(1);
    }

    // ── Step 1: Load corpus ──────────────────────────────────────────────
    console.log("[1/4] Loading support corpus...");
    const dataDir = path.resolve(__dirname, '../../data');
    const corpus = await loadCorpus(dataDir);
    console.log(`  → Loaded ${corpus.length} documents.`);

    // ── Step 2: Build BM25 index ─────────────────────────────────────────
    console.log("[2/4] Building retrieval index...");
    const retriever = new CorpusRetriever();
    retriever.indexCorpus(corpus);

    // ── Step 3: Read tickets ─────────────────────────────────────────────
    console.log("[3/4] Reading support tickets...");
    const inputCsvPath = path.resolve(__dirname, '../../support_tickets/support_tickets.csv');
    const tickets = await readTickets(inputCsvPath);
    console.log(`  → Loaded ${tickets.length} tickets.`);

    // ── Step 4: Process each ticket ──────────────────────────────────────
    console.log("[4/4] Processing tickets...");
    const outputTickets: OutputTicket[] = [];
    const startTime = Date.now();

    for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        const pct = Math.round(((i + 1) / tickets.length) * 100);
        const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
        process.stdout.write(`\r  [${bar}] ${pct}% (${i + 1}/${tickets.length})`);
        console.log('');
        console.log(`\n── Ticket ${i + 1}/${tickets.length} ──────────────────────────────`);
        console.log(`  Subject: ${ticket.subject}`);
        console.log(`  Company: ${ticket.company}`);

        // 4a. Classify domain
        const domain = classifyDomain(ticket);
        console.log(`  Domain:  ${domain}`);

        // 4b. Pre-LLM safety check
        if (requiresImmediateEscalation(ticket)) {
            console.log(`  ⚠ IMMEDIATE ESCALATION (sensitive keywords detected)`);
            outputTickets.push({
                status: 'escalated',
                product_area: domain === 'unknown' ? 'general_support' : `${domain}_support`,
                response: '',
                justification: 'Ticket contains sensitive keywords (fraud, hacked, etc.) and requires human review.',
                request_type: 'product_issue'
            });
            continue;
        }

        // 4c. Retrieve relevant context
        const query = `${ticket.subject} ${ticket.issue}`;
        const domainFilter = domain === 'unknown' ? undefined : domain;
        const contextDocs = retriever.search(query, 3, domainFilter);
        console.log(`  Retrieved ${contextDocs.length} docs (top: ${contextDocs[0]?.title?.substring(0, 40) || 'N/A'})`);

        // 4d. Build prompt and call LLM
        const prompt = buildPrompt(ticket, domain, contextDocs);
        let llmResponse: AgentResponse;
        try {
            llmResponse = await getLLMResponse(prompt);
        } catch (err) {
            console.error(`  ✗ LLM call failed: ${err}`);
            llmResponse = {
                status: 'escalated',
                product_area: 'system_error',
                response: '',
                justification: 'LLM call failed, escalating for human review.',
                request_type: 'product_issue'
            };
        }

        // 4e. Post-LLM safety check
        const safeResponse = enforceEscalationSafety(llmResponse);
        console.log(`  Status:  ${safeResponse.status}`);
        console.log(`  Area:    ${safeResponse.product_area}`);
        console.log(`  Type:    ${safeResponse.request_type}`);

        outputTickets.push({
            status: safeResponse.status,
            product_area: safeResponse.product_area,
            response: safeResponse.response,
            justification: safeResponse.justification,
            request_type: safeResponse.request_type
        });

        // Rate-limit: wait 2 seconds between API calls for free tier
        if (i < tickets.length - 1) {
            await sleep(2000);
        }
    }

    // ── Step 5: Write output CSV ─────────────────────────────────────────
    const outputPath = path.resolve(__dirname, '../../support_tickets/output.csv');
    await writeOutput(outputPath, outputTickets);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Done! Processed ${outputTickets.length} tickets in ${elapsed}s → ${outputPath}`);
    
    // Summary
    const replied = outputTickets.filter(t => t.status === 'replied').length;
    const escalated = outputTickets.filter(t => t.status === 'escalated').length;
    console.log(`   Replied: ${replied} | Escalated: ${escalated}`);
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});

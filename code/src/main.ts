import * as dotenv from 'dotenv';
import * as path from 'path';
import { readTickets, writeOutput } from './csv_handler';
import { loadCorpus } from './corpus_loader';
import { CorpusRetriever } from './retriever';
import { classifyDomain } from './classifier';
import { buildPrompt } from './prompt_builder';
import { getLLMResponse, AgentResponse } from './llm_client';
import { requiresImmediateEscalation, enforceEscalationSafety } from './safety_layer';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
    console.log("Starting HackerRank Orchestrate Support Agent...");
    
    // Ensure API key is present
    if (!process.env.GROQ_API_KEY) {
        console.error("Error: GROQ_API_KEY is missing from .env file.");
        process.exit(1);
    }
    
    console.log("Agent setup complete. Reading support tickets...");
    
    const sampleCsvPath = path.resolve(__dirname, '../../support_tickets/sample_support_tickets.csv');
    const outputPath = path.resolve(__dirname, '../../support_tickets/output.csv');
    try {
        const tickets = await readTickets(sampleCsvPath);
        console.log(`Successfully loaded ${tickets.length} tickets from ${sampleCsvPath}`);
        
        // Test CSV writing with dummy data matching the required schema
        console.log("Testing CSV writer...");
        await writeOutput(outputPath, [
            {
                status: 'replied',
                product_area: 'general_support',
                response: 'This is a test response.',
                justification: 'This is a test justification.',
                request_type: 'product_issue'
            }
        ]);
        console.log(`Successfully wrote test output to ${outputPath}`);
        
        // Test Corpus Loader
        console.log("Loading corpus...");
        const dataDir = path.resolve(__dirname, '../../data');
        const corpus = await loadCorpus(dataDir);
        console.log(`Successfully loaded ${corpus.length} documents from the corpus.`);
        if (corpus.length > 0) {
            console.log("Sample corpus document:");
            console.log(`Title: ${corpus[0].title}`);
            console.log(`Domain: ${corpus[0].domain}`);
            console.log(`Content length: ${corpus[0].content.length} chars`);
        }

        // Test Retriever
        console.log("Testing Retriever...");
        const retriever = new CorpusRetriever();
        retriever.indexCorpus(corpus);
        
        const sampleQuery = "How do I add extra time for a candidate assessment?";
        console.log(`Searching for: "${sampleQuery}"`);
        const results = retriever.search(sampleQuery, 2, 'hackerrank');
        console.log(`Found ${results.length} results.`);
        if (results.length > 0) {
            console.log(`Top result: ${results[0].title} (Score: ${results[0].score.toFixed(2)})`);
        }

        // Test Classifier and Prompt Builder
        console.log("Testing Classifier and Prompt Builder...");
        if (tickets.length > 0) {
            const ticketToClassify = tickets[0];
            console.log(`Ticket: "${ticketToClassify.issue.substring(0, 50)}..."`);
            const domain = classifyDomain(ticketToClassify);
            console.log(`Classified Domain: ${domain}`);

            // Retrieve context for this ticket
            const query = `${ticketToClassify.subject} ${ticketToClassify.issue}`;
            const contextDocs = retriever.search(query, 2, domain === 'unknown' ? undefined : domain);
            
            // Test pre-LLM safety check
            if (requiresImmediateEscalation(ticketToClassify)) {
                console.log("--- Safety Layer: Immediate Escalation Triggered ---");
                console.log("Issue contains highly sensitive keywords.");
                return;
            }

            // Build Prompt
            const prompt = buildPrompt(ticketToClassify, domain, contextDocs);
            console.log("--- Generated System Prompt ---");
            console.log(prompt.systemPrompt.substring(0, 100) + "...");
            
            // Test Groq LLM API
            console.log("Sending prompt to Groq API...");
            const rawLlmResponse = await getLLMResponse(prompt);
            
            // Post-LLM safety check
            const finalResponse = enforceEscalationSafety(rawLlmResponse);

            console.log("--- Final LLM Response ---");
            console.log(JSON.stringify(finalResponse, null, 2));
        }

    } catch (error) {
        console.error("Failed to process CSV:", error);
    }
}

if (require.main === module) {
    main().catch(err => {
        console.error("Fatal error:", err);
        process.exit(1);
    });
}

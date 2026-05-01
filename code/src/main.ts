import * as dotenv from 'dotenv';
import * as path from 'path';
import { readTickets, writeOutput } from './csv_handler';
import { loadCorpus } from './corpus_loader';

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

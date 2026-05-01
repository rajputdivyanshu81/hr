import * as dotenv from 'dotenv';
import * as path from 'path';
import { readTickets } from './csv_handler';

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
    try {
        const tickets = await readTickets(sampleCsvPath);
        console.log(`Successfully loaded ${tickets.length} tickets from ${sampleCsvPath}`);
        if (tickets.length > 0) {
            console.log("First ticket sample:");
            console.log(JSON.stringify(tickets[0], null, 2));
        }
    } catch (error) {
        console.error("Failed to read CSV:", error);
    }
}

if (require.main === module) {
    main().catch(err => {
        console.error("Fatal error:", err);
        process.exit(1);
    });
}

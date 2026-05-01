import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
    console.log("Starting HackerRank Orchestrate Support Agent...");
    
    // Ensure API key is present
    if (!process.env.GROQ_API_KEY) {
        console.error("Error: GROQ_API_KEY is missing from .env file.");
        process.exit(1);
    }
    
    console.log("Agent setup complete. Ready to process tickets.");
}

if (require.main === module) {
    main().catch(err => {
        console.error("Fatal error:", err);
        process.exit(1);
    });
}

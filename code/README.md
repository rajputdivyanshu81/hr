# Multi-Domain Support Triage Agent

A terminal-based AI agent that triages support tickets across **HackerRank**, **Claude**, and **Visa** ecosystems using the **Groq API** with RAG (Retrieval Augmented Generation).

## Approach Overview

This agent implements a robust **RAG (Retrieval-Augmented Generation)** pipeline designed for high accuracy and safety. Key design decisions include:

1.  **Local BM25 Retrieval**: Uses the `wink-bm25-text-search` engine to index the provided support corpus. This ensures that the agent's knowledge is strictly grounded in the official documentation, avoiding hallucinations from the model's internal training data.
2.  **Domain-Aware Classification**: A keyword-based heuristic classifier identifies the product ecosystem (HackerRank, Claude, or Visa) to filter the search space and improve retrieval precision.
3.  **Multi-Layered Safety**: 
    *   **Pre-LLM**: Keywords like `fraud` or `hacked` trigger immediate escalation to human agents.
    *   **Post-LLM**: A secondary validation layer scans model responses for uncertainty phrases or "contact support" redirects, overriding them to `escalated` to prevent unhelpful automated loops.
4.  **Structured JSON Output**: Utilizes Groq's native JSON mode to ensure the agent outputs data exactly matching the required schema for automated evaluation.
5.  **Deterministic Reasoning**: LLM parameters are set to zero temperature with a fixed seed to ensure consistent, reproducible triage across different runs.

## Architecture

```
tickets.csv → [CSV Reader] → [Domain Classifier] → [BM25 Retriever] → [Prompt Builder] → [Groq LLM] → [Safety Layer] → output.csv
```

### Modules

| Module             | File                  | Description                                                        |
| ------------------ | --------------------- | ------------------------------------------------------------------ |
| CSV Handler        | `src/csv_handler.ts`  | Reads input tickets and writes structured output CSV               |
| Corpus Loader      | `src/corpus_loader.ts`| Loads & parses markdown support docs from `data/` directory        |
| BM25 Retriever     | `src/retriever.ts`    | Indexes corpus and retrieves relevant docs via keyword search      |
| Domain Classifier  | `src/classifier.ts`   | Classifies tickets into hackerrank/claude/visa/unknown             |
| Prompt Builder     | `src/prompt_builder.ts`| Constructs system + user prompts with retrieved context           |
| LLM Client         | `src/llm_client.ts`   | Calls Groq API with retry logic and output validation              |
| Safety Layer       | `src/safety_layer.ts` | Pre-LLM and post-LLM escalation checks for sensitive content      |
| Pipeline           | `src/main.ts`         | End-to-end orchestration with progress display                     |

## Setup

```bash
cd code
npm install
```

Create a `.env` file:
```
GROQ_API_KEY=your_groq_api_key_here
```

## Run

```bash
npm start
```

This will:
1. Load the support corpus (774 markdown documents)
2. Build a BM25 search index
3. Read tickets from `support_tickets/support_tickets.csv`
4. For each ticket: classify → retrieve → prompt → safety-check → output
5. Write results to `support_tickets/output.csv`

## Output Schema

| Column         | Type   | Description                                    |
| -------------- | ------ | ---------------------------------------------- |
| `status`       | string | `replied` or `escalated`                       |
| `product_area` | string | General category of the issue                  |
| `response`     | string | Agent reply (empty if escalated)               |
| `justification`| string | Reasoning for the decision                     |
| `request_type` | string | One of: `product_issue`, `feature_request`, `bug`, `invalid` |

## Safety & Escalation

- **Pre-LLM**: Tickets with critical keywords (fraud, stolen, hacked, etc.) are immediately escalated without calling the LLM
- **Post-LLM**: If the LLM's reply contains uncertainty phrases or redirects to human support, the response is overridden to `escalated`
- **API Failures**: Any LLM error triggers automatic escalation with a clear justification

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **LLM**: Groq API (`llama-3.1-8b-instant`)
- **Retrieval**: wink-bm25-text-search + wink-nlp
- **Parsing**: gray-matter (markdown frontmatter), csv-parser, fast-csv

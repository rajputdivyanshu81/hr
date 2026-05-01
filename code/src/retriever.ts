const winkNLP = require('wink-nlp');
const model = require('wink-eng-lite-web-model');
const BM25Vectorizer = require('wink-bm25-text-search');
import { Document } from './corpus_loader';

export interface RetrievedDocument extends Document {
    score: number;
}

export class CorpusRetriever {
    private nlp: any;
    private bm25: any;
    private corpusMap: Map<string, Document>;

    constructor() {
        this.nlp = winkNLP(model);
        this.bm25 = BM25Vectorizer();
        this.corpusMap = new Map();

        // Define how to extract tokens from the document
        this.bm25.defineConfig({
            fldWeights: {
                title: 2, // Title has higher weight
                content: 1
            }
        });
        
        // Custom prep task using wink-nlp
        const prepTask = (text: string) => {
            const tokens: string[] = [];
            if (!text) return tokens;
            this.nlp.readDoc(text).tokens()
                .filter((t: any) => t.out(this.nlp.its.type) === 'word' && !t.out(this.nlp.its.stopWordFlag))
                .each((t: any) => tokens.push(t.out(this.nlp.its.lemma)));
            return tokens;
        };

        this.bm25.definePrepTasks([prepTask]);
    }

    /**
     * Initializes the BM25 index with the given corpus.
     * @param documents Array of Document objects.
     */
    public indexCorpus(documents: Document[]) {
        console.log(`Indexing ${documents.length} documents...`);
        for (const doc of documents) {
            this.corpusMap.set(doc.id, doc);
            this.bm25.addDoc({
                title: doc.title,
                content: doc.content
            }, doc.id);
        }
        this.bm25.consolidate();
        console.log("BM25 Indexing complete.");
    }

    /**
     * Searches the corpus for the most relevant documents.
     * @param query The search query string.
     * @param limit The maximum number of documents to return.
     * @param domainFilter Optional domain to restrict the search to ('hackerrank', 'claude', 'visa').
     * @returns Array of RetrievedDocument sorted by relevance.
     */
    public search(query: string, limit: number = 3, domainFilter?: string): RetrievedDocument[] {
        const results = this.bm25.search(query);
        const retrieved: RetrievedDocument[] = [];

        for (const result of results) {
            const doc = this.corpusMap.get(result[0] as string);
            if (doc) {
                // If domain filter is applied, skip documents outside the domain
                if (domainFilter && doc.domain !== domainFilter) {
                    continue;
                }
                retrieved.push({
                    ...doc,
                    score: result[1] as number
                });
            }
            if (retrieved.length >= limit) {
                break;
            }
        }

        return retrieved;
    }
}

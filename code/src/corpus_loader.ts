import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';

export interface Document {
    id: string; // The file name or path as a unique ID
    domain: string; // 'hackerrank', 'claude', or 'visa'
    title: string;
    content: string;
    rawContent: string;
    url: string;
    breadcrumbs: string[];
}

/**
 * Recursively gets all markdown files in a directory.
 */
function getMarkdownFiles(dir: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            getMarkdownFiles(filePath, fileList);
        } else if (filePath.endsWith('.md')) {
            fileList.push(filePath);
        }
    }
    return fileList;
}

/**
 * Loads and parses the entire support corpus from the data/ folder.
 * @param dataDir The root path of the data directory.
 * @returns A promise resolving to an array of Document objects.
 */
export async function loadCorpus(dataDir: string): Promise<Document[]> {
    const documents: Document[] = [];
    const domains = ['hackerrank', 'claude', 'visa'];

    for (const domain of domains) {
        const domainDir = path.join(dataDir, domain);
        if (!fs.existsSync(domainDir)) {
            console.warn(`Warning: Domain directory not found: ${domainDir}`);
            continue;
        }

        const mdFiles = getMarkdownFiles(domainDir);
        for (const filePath of mdFiles) {
            try {
                const rawFileContent = fs.readFileSync(filePath, 'utf8');
                const parsed = matter(rawFileContent);
                
                documents.push({
                    id: filePath.replace(dataDir, '').replace(/\\/g, '/'),
                    domain: domain,
                    title: parsed.data.title || path.basename(filePath, '.md'),
                    content: parsed.content.trim(),
                    rawContent: rawFileContent,
                    url: parsed.data.source_url || '',
                    breadcrumbs: parsed.data.breadcrumbs || []
                });
            } catch (error) {
                console.error(`Failed to parse markdown file ${filePath}:`, error);
            }
        }
    }

    return documents;
}

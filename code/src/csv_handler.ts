import * as fs from 'fs';
import csvParser from 'csv-parser';

export interface SupportTicket {
    issue: string;
    subject: string;
    company: string;
    // Additional fields for sample tickets
    response?: string;
    product_area?: string;
    status?: string;
    request_type?: string;
}

/**
 * Reads support tickets from a CSV file.
 * @param filePath The path to the CSV file.
 * @returns A promise that resolves to an array of SupportTicket objects.
 */
export async function readTickets(filePath: string): Promise<SupportTicket[]> {
    return new Promise((resolve, reject) => {
        const tickets: SupportTicket[] = [];
        
        fs.createReadStream(filePath)
            .pipe(csvParser({
                mapHeaders: ({ header }) => header.trim().toLowerCase().replace(' ', '_')
            }))
            .on('data', (data) => {
                // Ensure required fields are present even if empty
                tickets.push({
                    issue: data.issue || '',
                    subject: data.subject || '',
                    company: data.company || '',
                    response: data.response,
                    product_area: data.product_area,
                    status: data.status,
                    request_type: data.request_type
                });
            })
            .on('end', () => {
                resolve(tickets);
            })
            .on('error', (error) => {
                reject(error);
            });
    });
}

const pdfParse = require('pdf-parse');
import Papa from 'papaparse';
import * as xlsx from 'xlsx';

export interface ExtractedData {
    companyName: string;
    revenue: number;
    netProfit: number;
    totalDebt: number;
    cashFlow: number;
    totalAssets: number;
    liabilities: number;
    gstTurnover: number;
    bankDeposits: number;
    circularTransactions: number;
    extractionConfidence: 'high' | 'medium' | 'low';
    rawTextLength: number;
}

const zeroData = (): ExtractedData => ({
    companyName: 'Uploaded Company',
    revenue: 0,
    netProfit: 0,
    totalDebt: 0,
    cashFlow: 0,
    totalAssets: 0,
    liabilities: 0,
    gstTurnover: 0,
    bankDeposits: 0,
    circularTransactions: 0,
    extractionConfidence: 'low',
    rawTextLength: 0,
});

export async function extractData(files: File[]): Promise<ExtractedData> {
    const data = zeroData();
    let allText = '';

    for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const fileName = file.name.toLowerCase();

        try {
            if (fileName.endsWith('.pdf')) {
                const pdfData = await pdfParse(buffer);
                allText += pdfData.text + '\n';
                console.log(`[PDF] Extracted ${pdfData.text.length} chars from ${file.name}`);

            } else if (fileName.endsWith('.csv')) {
                const csvText = buffer.toString('utf-8');
                allText += csvText + '\n';

                // Parse ALL CSVs for financial keywords
                const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
                const rows = parsed.data as Record<string, string>[];

                let deposits = 0;
                let revenue = 0;
                let netProfit = 0;
                let totalDebt = 0;
                let assets = 0;
                let liabilities = 0;
                const amounts: number[] = [];

                for (const row of rows) {
                    // Normalize keys to lowercase
                    const keys = Object.keys(row);
                    for (const key of keys) {
                        const k = key.toLowerCase().trim();
                        const raw = (row[key] || '').replace(/[,₹$\s]/g, '');
                        const val = parseFloat(raw);
                        if (isNaN(val) || val <= 0) continue;

                        if (/credit|deposit|inflow/.test(k)) { deposits += val; amounts.push(val); }
                        else if (/revenue|turnover|sales/.test(k)) revenue += val;
                        else if (/net.?profit|net.?income/.test(k)) netProfit += val;
                        else if (/debt|loan|borrowing/.test(k)) totalDebt += val;
                        else if (/total.?asset|fixed.?asset/.test(k)) assets += val;
                        else if (/liability|liabilities/.test(k)) liabilities += val;
                        else if (/amount/.test(k) && val > 0) { amounts.push(val); deposits += val; }
                    }
                }

                if (deposits > 0) data.bankDeposits = (data.bankDeposits || 0) + deposits;
                if (revenue > 0) data.revenue = (data.revenue || 0) + revenue;
                if (netProfit > 0) data.netProfit = (data.netProfit || 0) + netProfit;
                if (totalDebt > 0) data.totalDebt = (data.totalDebt || 0) + totalDebt;
                if (assets > 0) data.totalAssets = (data.totalAssets || 0) + assets;
                if (liabilities > 0) data.liabilities = (data.liabilities || 0) + liabilities;

                // Circular transaction detection (same large amount appears 3+ times)
                const amountCounts = amounts.reduce((acc, val) => {
                    if (val > 10000) acc[val] = (acc[val] || 0) + 1;
                    return acc;
                }, {} as Record<number, number>);
                data.circularTransactions += Object.values(amountCounts).filter((v: any) => v >= 3).length;

            } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
                const workbook = xlsx.read(buffer, { type: 'buffer' });

                for (const sheetName of workbook.SheetNames) {
                    const worksheet = workbook.Sheets[sheetName];
                    const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
                    // Stringify for regex extraction
                    const sheetText = rows.map(r => r.join('\t')).join('\n');
                    allText += sheetText + '\n';

                    // Also try header-based column scan
                    const jsonRows = xlsx.utils.sheet_to_json(worksheet) as Record<string, any>[];
                    let deposits = 0;

                    for (const row of jsonRows) {
                        for (const [key, val] of Object.entries(row)) {
                            const k = String(key).toLowerCase().trim();
                            const v = parseFloat(String(val).replace(/[,₹$\s]/g, ''));
                            if (isNaN(v) || v <= 0) continue;

                            if (/credit|deposit|inflow/.test(k)) deposits += v;
                            else if (/revenue|turnover|sales/.test(k)) data.revenue = (data.revenue || 0) + v;
                            else if (/net.?profit|net.?income/.test(k)) data.netProfit = (data.netProfit || 0) + v;
                            else if (/debt|loan|borrowing/.test(k)) data.totalDebt = (data.totalDebt || 0) + v;
                            else if (/total.?asset/.test(k)) data.totalAssets = (data.totalAssets || 0) + v;
                            else if (/liabilit/.test(k)) data.liabilities = (data.liabilities || 0) + v;
                        }
                    }
                    if (deposits > 0) data.bankDeposits = (data.bankDeposits || 0) + deposits;
                }
            }
        } catch (e) {
            console.error(`[Extractor] Failed to parse ${file.name}:`, e);
        }
    }

    data.rawTextLength = allText.length;
    return applyRegexExtraction(allText, data);
}

/**
 * Apply regex patterns to the concatenated text from all files.
 * Only overwrites a field if regex finds a value AND the current value is still 0.
 */
function applyRegexExtraction(text: string, data: ExtractedData): ExtractedData {
    const extractNum = (regex: RegExp): number | null => {
        const match = text.match(regex);
        if (match && match[1]) {
            // Strip commas/currency symbols
            const cleaned = match[1].replace(/[,₹$\s]/g, '');
            const val = parseFloat(cleaned);
            return isNaN(val) ? null : val;
        }
        return null;
    };

    // Company name - always try to extract
    const nameMatch = text.match(/(?:company\s+name|entity\s+name|firm\s+name|taxpayer\s+name)[:\s]+([A-Za-z0-9\s&.,()-]{3,60})/i);
    if (nameMatch) data.companyName = nameMatch[1].trim().replace(/\s+/g, ' ');

    // Only fill in zeros from text — don't overwrite values already found via column parsing
    const patterns: Array<[keyof ExtractedData, RegExp[]]> = [
        ['revenue', [
            /(?:total\s+)?revenue\s*[:\s₹$]+([\d,]+(?:\.\d+)?)/i,
            /(?:net\s+)?(?:sales|turnover)\s*[:\s₹$]+([\d,]+(?:\.\d+)?)/i,
            /(?:gross\s+)?income\s*[:\s₹$]+([\d,]+(?:\.\d+)?)/i,
        ]],
        ['netProfit', [
            /net\s+profit\s*(?:after\s+tax)?\s*[:\s₹$]+([\d,]+(?:\.\d+)?)/i,
            /profit\s+(?:after\s+tax|for\s+the\s+year)\s*[:\s₹$]+([\d,]+(?:\.\d+)?)/i,
            /pat\s*[:\s₹$]+([\d,]+(?:\.\d+)?)/i,
        ]],
        ['totalDebt', [
            /total\s+(?:outstanding\s+)?(?:debt|loan|borrowing)\s*[:\s₹$]+([\d,]+(?:\.\d+)?)/i,
            /(?:secured|unsecured)\s+loan\s*[:\s₹$]+([\d,]+(?:\.\d+)?)/i,
        ]],
        ['cashFlow', [
            /(?:net\s+)?cash\s+(?:flow|generated)\s*[:\s₹$]+([\d,]+(?:\.\d+)?)/i,
            /ebitda\s*[:\s₹$]+([\d,]+(?:\.\d+)?)/i,
        ]],
        ['totalAssets', [
            /total\s+assets\s*[:\s₹$]+([\d,]+(?:\.\d+)?)/i,
            /fixed\s+assets\s*[:\s₹$]+([\d,]+(?:\.\d+)?)/i,
        ]],
        ['liabilities', [
            /total\s+liabilities\s*[:\s₹$]+([\d,]+(?:\.\d+)?)/i,
            /current\s+liabilities\s*[:\s₹$]+([\d,]+(?:\.\d+)?)/i,
        ]],
        ['gstTurnover', [
            /gst\s+(?:turnover|taxable\s+turnover|outward\s+supplies)\s*[:\s₹$]+([\d,]+(?:\.\d+)?)/i,
            /total\s+taxable\s+value\s*[:\s₹$]+([\d,]+(?:\.\d+)?)/i,
        ]],
        ['bankDeposits', [
            /(?:total\s+)?(?:bank\s+)?deposits?\s*[:\s₹$]+([\d,]+(?:\.\d+)?)/i,
            /credit\s+(?:total|sum)\s*[:\s₹$]+([\d,]+(?:\.\d+)?)/i,
        ]],
    ];

    for (const [field, regexList] of patterns) {
        if ((data[field] as number) === 0) {
            for (const regex of regexList) {
                const found = extractNum(regex);
                if (found !== null && found > 0) {
                    (data as any)[field] = found;
                    break;
                }
            }
        }
    }

    // GST turnover fallback: if still 0, use revenue
    if (data.gstTurnover === 0 && data.revenue > 0) {
        data.gstTurnover = data.revenue;
    }

    // Bank deposits fallback: if still 0, use 90% of revenue (conservative estimate)
    if (data.bankDeposits === 0 && data.revenue > 0) {
        data.bankDeposits = data.revenue * 0.9;
    }

    // Liabilities fallback: estimate from debt if missing
    if (data.liabilities === 0 && data.totalDebt > 0) {
        data.liabilities = data.totalDebt * 1.2; // conservative
    }

    // Set confidence based on how many fields were populated
    const filledFields = ['revenue', 'netProfit', 'totalDebt', 'cashFlow', 'totalAssets', 'liabilities']
        .filter(f => (data as any)[f] > 0).length;

    if (filledFields >= 5) data.extractionConfidence = 'high';
    else if (filledFields >= 3) data.extractionConfidence = 'medium';
    else data.extractionConfidence = 'low';

    return data;
}

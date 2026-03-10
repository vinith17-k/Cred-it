import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const pdfParse = require('pdf-parse');
import Papa from 'papaparse';
import * as xlsx from 'xlsx';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// ─── Document Text Extraction ───────────────────────────────────────────────

async function extractTextFromFile(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const name = file.name.toLowerCase();

    try {
        if (name.endsWith('.pdf')) {
            const pdfData = await pdfParse(buffer);
            return `[FILE: ${file.name}]\n${pdfData.text}\n`;
        }

        if (name.endsWith('.csv')) {
            const text = buffer.toString('utf-8');
            const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
            const rows = parsed.data as Record<string, string>[];
            const sample = rows.slice(0, 200).map(r => Object.entries(r).map(([k, v]) => `${k}: ${v}`).join(', ')).join('\n');
            return `[FILE: ${file.name}]\n${sample}\n`;
        }

        if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
            const workbook = xlsx.read(buffer, { type: 'buffer' });
            let text = `[FILE: ${file.name}]\n`;
            for (const sheetName of workbook.SheetNames) {
                const sheet = workbook.Sheets[sheetName];
                const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
                text += `[Sheet: ${sheetName}]\n`;
                text += rows.slice(0, 200).map(r => r.join('\t')).join('\n') + '\n';
            }
            return text;
        }
    } catch (err) {
        console.error(`[analyze] Failed to parse ${file.name}:`, err);
    }

    return `[FILE: ${file.name}] (could not parse)\n`;
}

// ─── OpenAI Analysis ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior financial risk analyst at a bank performing credit evaluation for a business loan.
You will be given raw text extracted from company documents: GST returns, bank statements, annual reports, and financial statements.
Analyze the documents carefully and return your analysis as a strict JSON object.

Return ONLY the following JSON structure with NO markdown, NO code fences, NO explanation:

{
  "companyName": "string — extracted company name or 'Unknown Company'",
  "financialData": {
    "revenue": 0,
    "netProfit": 0,
    "totalDebt": 0,
    "cashFlow": 0,
    "gstTurnover": 0,
    "totalAssets": 0,
    "netWorth": 0,
    "liabilities": 0,
    "bankDeposits": 0,
    "promoterExperience": 0
  },
  "riskScore": {
    "character": 0,
    "capacity": 0,
    "capital": 0,
    "collateral": 0,
    "conditions": 0,
    "overall": 0
  },
  "fraudAlerts": [
    { "type": "danger|warning", "title": "string", "description": "string" }
  ],
  "loanDecision": {
    "status": "APPROVED|CONDITIONAL|REJECTED",
    "amount": 0,
    "interestRate": 0,
    "riskLevel": "Very Low Risk|Low Risk|Moderate Risk|High Risk|Very High Risk",
    "reasoning": "string"
  },
  "newsInsights": [
    { "title": "string", "sentiment": "positive|neutral|negative", "source": "string", "date": "string" }
  ],
  "riskInsights": ["string", "string"]
}

Rules:
- All monetary values must be in INR (numbers only, no currency symbols or commas)
- Five Cs scores are 0–100 integers. Overall = weighted average: character(20%) + capacity(25%) + capital(20%) + collateral(15%) + conditions(20%)
- If data for a field is missing from documents, use 0 for numbers and make reasonable inferences
- fraudAlerts: identify real anomalies like GST vs bank deposit mismatches, circular transactions, extreme leverage, negative profit. Empty array if none found.
- newsInsights: 3–5 key AI-generated insights about the company's financial health and risk signals
- riskInsights: 3–5 short bullet-point strings summarizing key risk factors
- loanDecision.amount: recommended loan amount in INR based on net worth and assets
- loanDecision.reasoning: 2–3 sentence explanation of the decision
`;

// ─── API Route ───────────────────────────────────────────────────────────────

export async function POST(req: Request) {
    try {
        if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your-openai-api-key-here') {
            return NextResponse.json(
                { success: false, error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your environment variables.' },
                { status: 500 }
            );
        }

        const formData = await req.formData();
        const files: File[] = [];

        for (const [, value] of Array.from(formData.entries())) {
            if (value instanceof File && value.size > 0) {
                files.push(value);
            }
        }

        if (files.length === 0) {
            return NextResponse.json({ success: false, error: 'No files uploaded' }, { status: 400 });
        }

        console.log(`[AI] Processing ${files.length} file(s): ${files.map(f => f.name).join(', ')}`);

        // 1. Extract text from all documents
        const textParts = await Promise.all(files.map(extractTextFromFile));
        let combinedText = textParts.join('\n\n');

        // Truncate to ~12,000 chars to stay within token limits
        if (combinedText.length > 12000) {
            combinedText = combinedText.slice(0, 12000) + '\n\n[... content truncated for analysis ...]';
        }

        console.log(`[AI] Total extracted text: ${combinedText.length} chars`);

        // 2. Call OpenAI
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            temperature: 0.2,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                {
                    role: 'user',
                    content: `Analyze the following company documents and return your credit risk analysis as JSON:\n\n${combinedText}`,
                },
            ],
        });

        const rawJson = completion.choices[0]?.message?.content ?? '{}';
        console.log(`[AI] Raw OpenAI response length: ${rawJson.length}`);

        let analysis: any;
        try {
            analysis = JSON.parse(rawJson);
        } catch {
            console.error('[AI] Failed to parse OpenAI JSON:', rawJson);
            return NextResponse.json(
                { success: false, error: 'AI returned invalid response. Please try again.' },
                { status: 500 }
            );
        }

        // 3. Normalize and validate
        const today = new Date().toISOString().split('T')[0];

        const financialData = {
            companyName: analysis.companyName || 'Unknown Company',
            revenue: Number(analysis.financialData?.revenue) || 0,
            netProfit: Number(analysis.financialData?.netProfit) || 0,
            totalDebt: Number(analysis.financialData?.totalDebt) || 0,
            cashFlow: Number(analysis.financialData?.cashFlow) || 0,
            gstTurnover: Number(analysis.financialData?.gstTurnover) || 0,
            totalAssets: Number(analysis.financialData?.totalAssets) || 0,
            netWorth: Number(analysis.financialData?.netWorth) || 0,
            liabilities: Number(analysis.financialData?.liabilities) || 0,
            bankDeposits: Number(analysis.financialData?.bankDeposits) || 0,
            promoterExperience: Number(analysis.financialData?.promoterExperience) || 0,
        };

        const riskScore = {
            character: Math.min(100, Math.max(0, Number(analysis.riskScore?.character) || 50)),
            capacity: Math.min(100, Math.max(0, Number(analysis.riskScore?.capacity) || 50)),
            capital: Math.min(100, Math.max(0, Number(analysis.riskScore?.capital) || 50)),
            collateral: Math.min(100, Math.max(0, Number(analysis.riskScore?.collateral) || 50)),
            conditions: Math.min(100, Math.max(0, Number(analysis.riskScore?.conditions) || 50)),
            overall: Math.min(100, Math.max(0, Number(analysis.riskScore?.overall) || 50)),
        };

        const loanDecision = {
            status: (['APPROVED', 'CONDITIONAL', 'REJECTED'].includes(analysis.loanDecision?.status)
                ? analysis.loanDecision.status
                : 'CONDITIONAL') as 'APPROVED' | 'CONDITIONAL' | 'REJECTED',
            amount: Math.max(0, Number(analysis.loanDecision?.amount) || 0),
            interestRate: Number(analysis.loanDecision?.interestRate) || 12,
            riskLevel: analysis.loanDecision?.riskLevel || 'Moderate Risk',
            reasoning: analysis.loanDecision?.reasoning || 'Analysis complete.',
        };

        const fraudAlerts = (Array.isArray(analysis.fraudAlerts) ? analysis.fraudAlerts : [])
            .filter((a: any) => a && a.title && a.description)
            .map((a: any) => ({
                type: a.type === 'danger' ? 'danger' : 'warning' as 'danger' | 'warning',
                title: String(a.title),
                description: String(a.description),
            }));

        const newsInsights = (Array.isArray(analysis.newsInsights) ? analysis.newsInsights : [])
            .filter((n: any) => n && n.title)
            .map((n: any) => ({
                title: String(n.title),
                sentiment: (['positive', 'neutral', 'negative'].includes(n.sentiment) ? n.sentiment : 'neutral') as 'positive' | 'neutral' | 'negative',
                source: String(n.source || 'AI Analysis Engine'),
                date: String(n.date || today),
            }));

        const riskInsights: string[] = (Array.isArray(analysis.riskInsights) ? analysis.riskInsights : [])
            .filter((r: any) => typeof r === 'string' && r.trim().length > 0)
            .map((r: any) => String(r));

        // Determine extraction confidence based on how many financial fields are non-zero
        const nonZeroFields = ['revenue', 'netProfit', 'totalDebt', 'cashFlow', 'totalAssets', 'liabilities']
            .filter(f => (financialData as any)[f] > 0).length;
        const extractionConfidence: 'high' | 'medium' | 'low' =
            nonZeroFields >= 5 ? 'high' : nonZeroFields >= 3 ? 'medium' : 'low';

        console.log(`[AI] Confidence: ${extractionConfidence} | Score: ${riskScore.overall} | Decision: ${loanDecision.status}`);

        return NextResponse.json({
            success: true,
            extractionConfidence,
            financialData,
            riskScore,
            loanDecision,
            fraudAlerts,
            newsInsights,
            riskInsights,
        });

    } catch (error: any) {
        console.error('[AI] Fatal error:', error?.message || error);
        return NextResponse.json(
            {
                success: false,
                error: 'AI analysis failed. Please check your API key and try again.',
                detail: error?.message || 'Unknown error',
            },
            { status: 500 }
        );
    }
}

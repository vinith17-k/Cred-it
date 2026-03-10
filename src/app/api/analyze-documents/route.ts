import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import Papa from 'papaparse';
import * as xlsx from 'xlsx';

// ─── OpenAI client (lazy, inside route to avoid module-level crashes) ────────

function getOpenAI() {
    const key = process.env.OPENAI_API_KEY;
    if (!key || key === 'your-openai-api-key-here') {
        throw new Error('OPENAI_API_KEY is not configured. Please add it to your environment variables.');
    }
    return new OpenAI({ apiKey: key });
}

// ─── Document Text Extraction ────────────────────────────────────────────────

async function extractTextFromFile(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const name = file.name.toLowerCase();

    try {
        if (name.endsWith('.pdf')) {
            // Require inside function to avoid module-level filesystem access issues on Vercel
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const pdfParse = require('pdf-parse/lib/pdf-parse');
            const pdfData = await pdfParse(buffer);
            return `[FILE: ${file.name}]\n${pdfData.text}\n`;
        }

        if (name.endsWith('.csv')) {
            const text = buffer.toString('utf-8');
            const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
            const rows = parsed.data as Record<string, string>[];
            const lines = rows.slice(0, 300).map(r =>
                Object.entries(r).map(([k, v]) => `${k}: ${v}`).join(', ')
            ).join('\n');
            return `[FILE: ${file.name}]\n${lines}\n`;
        }

        if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
            const workbook = xlsx.read(buffer, { type: 'buffer' });
            let text = `[FILE: ${file.name}]\n`;
            for (const sheetName of workbook.SheetNames) {
                const sheet = workbook.Sheets[sheetName];
                const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
                text += `[Sheet: ${sheetName}]\n`;
                text += rows.slice(0, 300).map(r => r.join('\t')).join('\n') + '\n';
            }
            return text;
        }

        // Fallback: try to read as plain text
        return `[FILE: ${file.name}]\n${buffer.toString('utf-8').slice(0, 3000)}\n`;

    } catch (err: any) {
        console.error(`[analyze] Failed to parse ${file.name}:`, err?.message);
        return `[FILE: ${file.name}] (parse failed: ${err?.message})\n`;
    }
}

// ─── AI Prompt ──────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior financial risk analyst at a bank performing credit evaluation for a business loan.
You will be given raw text extracted from company documents: GST returns, bank statements, annual reports, and financial statements.
Analyze the documents carefully and return ONLY a valid JSON object — no markdown, no code fences, no explanation.

Return EXACTLY this JSON structure (fill all fields, use 0 for unknown numbers):

{
  "companyName": "string",
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
    "character": 70,
    "capacity": 65,
    "capital": 60,
    "collateral": 55,
    "conditions": 70,
    "overall": 65
  },
  "fraudAlerts": [
    { "type": "warning", "title": "string", "description": "string" }
  ],
  "loanDecision": {
    "status": "CONDITIONAL",
    "amount": 0,
    "interestRate": 12.5,
    "riskLevel": "Moderate Risk",
    "reasoning": "string"
  },
  "newsInsights": [
    { "title": "string", "sentiment": "neutral", "source": "AI Analysis", "date": "2026-03-10" }
  ],
  "riskInsights": ["string"]
}

Rules:
- All monetary values in INR as plain numbers (no symbols, no commas)
- Five Cs scores: integers 0–100. Overall = character*0.20 + capacity*0.25 + capital*0.20 + collateral*0.15 + conditions*0.20
- status must be exactly: APPROVED, CONDITIONAL, or REJECTED
- sentiment must be exactly: positive, neutral, or negative
- type must be exactly: danger or warning
- fraudAlerts: empty array [] if no issues found
- riskInsights: 3–5 short bullet strings summarizing key findings
- newsInsights: 3–4 AI-generated observations about financial health`;

// ─── API Route ───────────────────────────────────────────────────────────────

export async function POST(req: Request) {
    try {
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

        // Trim to ~10,000 chars to stay well within token limits and avoid timeouts
        if (combinedText.length > 10000) {
            combinedText = combinedText.slice(0, 10000) + '\n\n[... content truncated for analysis ...]';
        }

        console.log(`[AI] Total extracted text: ${combinedText.length} chars. Calling OpenAI...`);

        // 2. Call OpenAI
        const openai = getOpenAI();
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            temperature: 0.1,
            max_tokens: 1500,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                {
                    role: 'user',
                    content: `Analyze the following extracted document text and return your credit risk analysis as a JSON object:\n\n${combinedText}`,
                },
            ],
        });

        const rawJson = completion.choices[0]?.message?.content ?? '';
        console.log(`[AI] OpenAI response: ${rawJson.length} chars`);

        if (!rawJson || rawJson.trim().length === 0) {
            return NextResponse.json(
                { success: false, error: 'AI returned an empty response. Please try again.' },
                { status: 500 }
            );
        }

        let analysis: any;
        try {
            analysis = JSON.parse(rawJson);
        } catch (parseErr) {
            console.error('[AI] JSON parse error. Raw:', rawJson.slice(0, 500));
            return NextResponse.json(
                { success: false, error: 'AI returned malformed JSON. Please try again.' },
                { status: 500 }
            );
        }

        // 3. Normalize response
        const today = new Date().toISOString().split('T')[0];

        const financialData = {
            companyName: String(analysis.companyName || 'Uploaded Company'),
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

        const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(Number(n) || 50)));
        const riskScore = {
            character: clamp(analysis.riskScore?.character),
            capacity: clamp(analysis.riskScore?.capacity),
            capital: clamp(analysis.riskScore?.capital),
            collateral: clamp(analysis.riskScore?.collateral),
            conditions: clamp(analysis.riskScore?.conditions),
            overall: clamp(analysis.riskScore?.overall),
        };

        const validStatuses = ['APPROVED', 'CONDITIONAL', 'REJECTED'];
        const loanDecision = {
            status: (validStatuses.includes(analysis.loanDecision?.status)
                ? analysis.loanDecision.status
                : 'CONDITIONAL') as 'APPROVED' | 'CONDITIONAL' | 'REJECTED',
            amount: Math.max(0, Number(analysis.loanDecision?.amount) || 0),
            interestRate: Number(analysis.loanDecision?.interestRate) || 12.5,
            riskLevel: String(analysis.loanDecision?.riskLevel || 'Moderate Risk'),
            reasoning: String(analysis.loanDecision?.reasoning || 'Analysis complete.'),
        };

        const fraudAlerts = (Array.isArray(analysis.fraudAlerts) ? analysis.fraudAlerts : [])
            .filter((a: any) => a?.title && a?.description)
            .map((a: any) => ({
                type: (a.type === 'danger' ? 'danger' : 'warning') as 'danger' | 'warning',
                title: String(a.title),
                description: String(a.description),
            }));

        const validSentiments = ['positive', 'neutral', 'negative'];
        const newsInsights = (Array.isArray(analysis.newsInsights) ? analysis.newsInsights : [])
            .filter((n: any) => n?.title)
            .map((n: any) => ({
                title: String(n.title),
                sentiment: (validSentiments.includes(n.sentiment) ? n.sentiment : 'neutral') as 'positive' | 'neutral' | 'negative',
                source: String(n.source || 'AI Analysis Engine'),
                date: String(n.date || today),
            }));

        const riskInsights: string[] = (Array.isArray(analysis.riskInsights) ? analysis.riskInsights : [])
            .filter((r: any) => typeof r === 'string' && r.trim().length > 0)
            .map(String);

        const nonZeroCount = ['revenue', 'netProfit', 'totalDebt', 'cashFlow', 'totalAssets', 'liabilities']
            .filter(f => (financialData as any)[f] > 0).length;
        const extractionConfidence: 'high' | 'medium' | 'low' =
            nonZeroCount >= 5 ? 'high' : nonZeroCount >= 3 ? 'medium' : 'low';

        console.log(`[AI] Done. Confidence: ${extractionConfidence} | Score: ${riskScore.overall} | Decision: ${loanDecision.status}`);

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
        // Always return valid JSON so the frontend can parse it
        return NextResponse.json(
            {
                success: false,
                error: error?.message || 'AI analysis failed. Please check your API key and try again.',
            },
            { status: 500 }
        );
    }
}

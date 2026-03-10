import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import Papa from 'papaparse';
import * as xlsx from 'xlsx';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// ─── Lightweight PDF text extractor (no external deps) ──────────────────────
// Extracts readable ASCII text directly from a PDF buffer without pdf-parse.
// Works for text-based PDFs (not scanned images).
function extractPdfText(buffer: Buffer): string {
    const str = buffer.toString('latin1');
    const chunks: string[] = [];

    // Method 1: Extract text inside BT...ET blocks (standard PDF text content)
    const btEtRegex = /BT([\s\S]*?)ET/g;
    let match: RegExpExecArray | null;
    while ((match = btEtRegex.exec(str)) !== null) {
        const block = match[1];
        // Extract strings inside parentheses: (text)Tj  or [(text)]TJ
        const strRegex = /\(([^)]{1,300})\)/g;
        let strMatch: RegExpExecArray | null;
        while ((strMatch = strRegex.exec(block)) !== null) {
            const text = strMatch[1]
                .replace(/\\n/g, '\n')
                .replace(/\\r/g, ' ')
                .replace(/\\t/g, ' ')
                .replace(/\\\\/g, '\\')
                .replace(/\\\(/g, '(')
                .replace(/\\\)/g, ')')
                // Keep only printable ASCII
                .replace(/[^\x20-\x7E\n]/g, ' ')
                .trim();
            if (text.length > 2) chunks.push(text);
        }
    }

    // Method 2: Fallback — grab all readable strings >= 4 chars from the raw buffer
    if (chunks.length < 10) {
        const readableRegex = /[ -~]{4,}/g;
        const fallbackMatches = str.match(readableRegex) || [];
        // Filter out PDF internals junk
        const useful = fallbackMatches.filter(s =>
            !/^(obj|endobj|stream|endstream|xref|startxref|trailer|BT|ET|Tf|Td|Tm|Tj|TJ|Tc|Tw|Tz)$/.test(s.trim()) &&
            s.includes(' ') &&
            !/^[0-9\s.]+$/.test(s)
        );
        chunks.push(...useful.slice(0, 500));
    }

    return chunks.join(' ').replace(/\s+/g, ' ').trim().slice(0, 8000);
}

// ─── Document Text Extraction ────────────────────────────────────────────────

async function extractTextFromFile(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const name = file.name.toLowerCase();

    try {
        if (name.endsWith('.pdf')) {
            const text = extractPdfText(buffer);
            console.log(`[PDF] Extracted ${text.length} chars from ${file.name}`);
            return `[FILE: ${file.name} - PDF]\n${text}\n`;
        }

        if (name.endsWith('.csv')) {
            const text = buffer.toString('utf-8');
            const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
            const rows = parsed.data as Record<string, string>[];
            const lines = rows.slice(0, 300)
                .map(r => Object.entries(r).map(([k, v]) => `${k}: ${v}`).join(' | '))
                .join('\n');
            return `[FILE: ${file.name} - CSV]\n${lines}\n`;
        }

        if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
            const workbook = xlsx.read(buffer, { type: 'buffer' });
            let text = `[FILE: ${file.name} - Excel]\n`;
            for (const sheetName of workbook.SheetNames.slice(0, 5)) {
                const sheet = workbook.Sheets[sheetName];
                const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
                text += `[Sheet: ${sheetName}]\n`;
                text += rows.slice(0, 200)
                    .map(r => r.filter(Boolean).join('\t'))
                    .filter(r => r.trim())
                    .join('\n') + '\n';
            }
            return text;
        }

        // Fallback: plain text
        return `[FILE: ${file.name}]\n${buffer.toString('utf-8').slice(0, 5000)}\n`;

    } catch (err: any) {
        console.error(`[extract] Error on ${file.name}:`, err?.message);
        return `[FILE: ${file.name}] (parse error: ${err?.message})\n`;
    }
}

// ─── System Prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior financial risk analyst at a bank performing credit evaluation for a business loan.
You receive extracted text from company documents including GST returns, bank statements, financial statements, and annual reports.

Return ONLY a valid JSON object — no markdown, no code fences, no explanation outside the JSON.

Required JSON structure:
{
  "companyName": "detected company name or 'Unknown Company'",
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
  "fraudAlerts": [],
  "loanDecision": {
    "status": "CONDITIONAL",
    "amount": 5000000,
    "interestRate": 12.5,
    "riskLevel": "Moderate Risk",
    "reasoning": "Analysis based on provided documents."
  },
  "newsInsights": [
    { "title": "Analysis insight", "sentiment": "neutral", "source": "AI Analysis", "date": "2026-03-10" }
  ],
  "riskInsights": ["Key insight 1", "Key insight 2"]
}

Rules:
- All monetary values in INR as plain numbers only (no currency symbols, commas, or formatting)
- Five Cs scores are integers 0–100; overall = weighted average (char 20%, cap 25%, capital 20%, coll 15%, cond 20%)
- status: APPROVED, CONDITIONAL, or REJECTED only
- sentiment: positive, neutral, or negative only
- fraudAlerts type: danger or warning only
- If data is missing from documents, use reasonable defaults based on context
- riskInsights: 3–5 concise bullet strings about key financial signals
- newsInsights: 3–4 specific observations about this company's financial health`;

// ─── API Route ────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
    try {
        // Parse multipart form data
        let formData: FormData;
        try {
            formData = await req.formData();
        } catch (e: any) {
            return NextResponse.json(
                { success: false, error: 'Failed to parse uploaded files. Please try again.' },
                { status: 400 }
            );
        }

        const files: File[] = [];
        for (const [, value] of Array.from(formData.entries())) {
            if (value instanceof File && value.size > 0) {
                files.push(value);
            }
        }

        if (files.length === 0) {
            return NextResponse.json(
                { success: false, error: 'No files uploaded. Please select at least one document.' },
                { status: 400 }
            );
        }

        console.log(`[AI] Processing ${files.length} file(s): ${files.map(f => f.name).join(', ')}`);

        // Extract text from all documents
        const textParts = await Promise.all(files.map(extractTextFromFile));
        let combinedText = textParts.join('\n\n');

        // Cap at 10,000 chars to stay within token limits
        if (combinedText.length > 10000) {
            combinedText = combinedText.slice(0, 10000) + '\n\n[... truncated ...]';
        }

        console.log(`[AI] Extracted ${combinedText.length} total chars. Calling OpenAI...`);

        // Initialize OpenAI
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey || apiKey.includes('your-openai-api-key')) {
            return NextResponse.json(
                { success: false, error: 'OpenAI API key not configured.' },
                { status: 500 }
            );
        }

        const openai = new OpenAI({ apiKey });

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            temperature: 0.1,
            max_tokens: 1200,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                {
                    role: 'user',
                    content: `Analyze these company documents and return credit risk JSON:\n\n${combinedText}`,
                },
            ],
        });

        const rawJson = completion.choices[0]?.message?.content ?? '';
        console.log(`[AI] Response: ${rawJson.length} chars`);

        if (!rawJson.trim()) {
            return NextResponse.json(
                { success: false, error: 'AI returned empty response. Please try again.' },
                { status: 500 }
            );
        }

        let analysis: any;
        try {
            analysis = JSON.parse(rawJson);
        } catch {
            console.error('[AI] JSON parse failed. Raw:', rawJson.slice(0, 300));
            return NextResponse.json(
                { success: false, error: 'AI returned invalid JSON. Please try again.' },
                { status: 500 }
            );
        }

        // ── Normalize & validate ─────────────────────────────────────────────
        const today = new Date().toISOString().split('T')[0];
        const n = (v: any) => Math.max(0, Number(v) || 0);
        const clamp = (v: any) => Math.min(100, Math.max(0, Math.round(Number(v) || 50)));

        const financialData = {
            companyName: String(analysis.companyName || 'Uploaded Company'),
            revenue: n(analysis.financialData?.revenue),
            netProfit: n(analysis.financialData?.netProfit),
            totalDebt: n(analysis.financialData?.totalDebt),
            cashFlow: n(analysis.financialData?.cashFlow),
            gstTurnover: n(analysis.financialData?.gstTurnover),
            totalAssets: n(analysis.financialData?.totalAssets),
            netWorth: n(analysis.financialData?.netWorth),
            liabilities: n(analysis.financialData?.liabilities),
            bankDeposits: n(analysis.financialData?.bankDeposits),
            promoterExperience: n(analysis.financialData?.promoterExperience),
        };

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
                ? analysis.loanDecision.status : 'CONDITIONAL') as 'APPROVED' | 'CONDITIONAL' | 'REJECTED',
            amount: n(analysis.loanDecision?.amount),
            interestRate: Number(analysis.loanDecision?.interestRate) || 12.5,
            riskLevel: String(analysis.loanDecision?.riskLevel || 'Moderate Risk'),
            reasoning: String(analysis.loanDecision?.reasoning || 'Analysis complete.'),
        };

        const fraudAlerts = (Array.isArray(analysis.fraudAlerts) ? analysis.fraudAlerts : [])
            .filter((a: any) => a?.title).map((a: any) => ({
                type: (a.type === 'danger' ? 'danger' : 'warning') as 'danger' | 'warning',
                title: String(a.title),
                description: String(a.description || ''),
            }));

        const validSentiments = ['positive', 'neutral', 'negative'];
        const newsInsights = (Array.isArray(analysis.newsInsights) ? analysis.newsInsights : [])
            .filter((n: any) => n?.title).map((n: any) => ({
                title: String(n.title),
                sentiment: (validSentiments.includes(n.sentiment) ? n.sentiment : 'neutral') as 'positive' | 'neutral' | 'negative',
                source: String(n.source || 'AI Analysis Engine'),
                date: String(n.date || today),
            }));

        const riskInsights: string[] = (Array.isArray(analysis.riskInsights) ? analysis.riskInsights : [])
            .filter((r: any) => typeof r === 'string').map(String);

        const nonZero = ['revenue', 'netProfit', 'totalDebt', 'cashFlow', 'totalAssets', 'liabilities']
            .filter(f => (financialData as any)[f] > 0).length;
        const extractionConfidence: 'high' | 'medium' | 'low' =
            nonZero >= 5 ? 'high' : nonZero >= 3 ? 'medium' : 'low';

        console.log(`[AI] ✅ Score: ${riskScore.overall} | Decision: ${loanDecision.status} | Confidence: ${extractionConfidence}`);

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
            { success: false, error: error?.message || 'Analysis failed. Please try again.' },
            { status: 500 }
        );
    }
}

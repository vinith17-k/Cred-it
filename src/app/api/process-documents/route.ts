import { NextResponse } from 'next/server';
import { extractData } from '@/lib/extractors';

type FraudAlertType = 'warning' | 'danger';
type DecisionStatus = 'APPROVED' | 'CONDITIONAL' | 'REJECTED';

interface FraudAlert {
    type: FraudAlertType;
    title: string;
    description: string;
}

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

        console.log(`[API] Processing ${files.length} files: ${files.map(f => f.name).join(', ')}`);

        // ── 1. PARSE FILES ──────────────────────────────────────────────────────────
        const extracted = await extractData(files);
        console.log(`[API] Extraction confidence: ${extracted.extractionConfidence} | raw text: ${extracted.rawTextLength} chars`);
        console.log(`[API] Extracted values:`, JSON.stringify({
            revenue: extracted.revenue,
            netProfit: extracted.netProfit,
            totalDebt: extracted.totalDebt,
            totalAssets: extracted.totalAssets,
            liabilities: extracted.liabilities,
            bankDeposits: extracted.bankDeposits,
            gstTurnover: extracted.gstTurnover,
        }));

        // ── 2. COMPUTE RATIOS ───────────────────────────────────────────────────────
        const netWorth = Math.max(extracted.totalAssets - extracted.liabilities, 0);
        const debtToAssetRatio = extracted.totalAssets > 0 ? extracted.totalDebt / extracted.totalAssets : 0;
        const profitMargin = extracted.revenue > 0 ? extracted.netProfit / extracted.revenue : 0;
        const cashFlowRatio = extracted.totalDebt > 0 ? extracted.cashFlow / extracted.totalDebt : 0;
        const debtToEquity = netWorth > 0 ? extracted.totalDebt / netWorth : 999;
        const currentCoverage = extracted.liabilities > 0 ? extracted.totalAssets / extracted.liabilities : 0;

        // ── 3. FRAUD DETECTION ──────────────────────────────────────────────────────
        const fraudAlerts: FraudAlert[] = [];

        // Rule 1: GST turnover significantly exceeds bank deposits
        if (extracted.gstTurnover > 0 && extracted.bankDeposits > 0) {
            const gstBankRatio = extracted.gstTurnover / extracted.bankDeposits;
            if (gstBankRatio > 1.5) {
                fraudAlerts.push({
                    type: 'danger',
                    title: 'Revenue Inflation Risk',
                    description: `GST turnover is ${(gstBankRatio * 100 - 100).toFixed(0)}% higher than bank deposits. Likely discrepancy between reported and actual sales.`,
                });
            } else if (gstBankRatio > 1.2) {
                fraudAlerts.push({
                    type: 'warning',
                    title: 'Moderate GST vs Bank Mismatch',
                    description: `GST turnover exceeds bank deposits by ${(gstBankRatio * 100 - 100).toFixed(0)}%. Recommend statement reconciliation.`,
                });
            }
        }

        // Rule 2: Cash flow mismatch with revenue
        if (extracted.revenue > 0 && extracted.bankDeposits > 0 && extracted.bankDeposits < extracted.revenue * 0.35) {
            fraudAlerts.push({
                type: 'warning',
                title: 'Cash Flow Mismatch',
                description: `Bank deposits are only ${((extracted.bankDeposits / extracted.revenue) * 100).toFixed(0)}% of reported revenue—significantly below expected range.`,
            });
        }

        // Rule 3: Circular transactions detected in CSVs
        if (extracted.circularTransactions > 0) {
            fraudAlerts.push({
                type: 'danger',
                title: 'Circular Transaction Pattern',
                description: `${extracted.circularTransactions} repeated high-value transaction pattern(s) detected—possible circular trading or layering.`,
            });
        }

        // Rule 4: Negative profit margin
        if (extracted.revenue > 0 && extracted.netProfit < 0) {
            fraudAlerts.push({
                type: 'warning',
                title: 'Negative Net Profit',
                description: `Company reported a net loss. Debt serviceability is at risk.`,
            });
        }

        // Rule 5: Extreme leverage
        if (debtToEquity > 3 && netWorth > 0) {
            fraudAlerts.push({
                type: 'danger',
                title: 'Over-Leveraged Balance Sheet',
                description: `Debt-to-Equity ratio of ${debtToEquity.toFixed(2)} indicates extremely high leverage. Risk of insolvency.`,
            });
        }

        // ── 4. FIVE Cs CREDIT SCORING ────────────────────────────────────────────────
        // CHARACTER — based on fraud indicators
        let character: number;
        const dangerAlerts = fraudAlerts.filter(a => a.type === 'danger').length;
        const warningAlerts = fraudAlerts.filter(a => a.type === 'warning').length;
        if (dangerAlerts >= 2) character = 20;
        else if (dangerAlerts === 1) character = 40;
        else if (warningAlerts >= 2) character = 55;
        else if (warningAlerts === 1) character = 70;
        else character = 85;

        // CAPACITY — ability to repay from cash flow
        let capacity: number;
        if (cashFlowRatio > 0.6) capacity = 90;
        else if (cashFlowRatio > 0.4) capacity = 75;
        else if (cashFlowRatio > 0.2) capacity = 55;
        else capacity = 35;
        // Adjust for profit margin
        if (profitMargin > 0.15) capacity = Math.min(100, capacity + 10);
        else if (profitMargin > 0.08) capacity = Math.min(100, capacity + 5);
        else if (profitMargin < 0) capacity = Math.max(0, capacity - 20);

        // CAPITAL — net worth vs debt
        let capital: number;
        if (debtToEquity < 0.5) capital = 95;
        else if (debtToEquity < 1.0) capital = 80;
        else if (debtToEquity < 2.0) capital = 65;
        else if (debtToEquity < 3.0) capital = 45;
        else capital = 20;

        // COLLATERAL — asset coverage
        let collateral: number;
        if (currentCoverage > 2.5) collateral = 90;
        else if (currentCoverage > 1.5) collateral = 75;
        else if (currentCoverage > 1.0) collateral = 55;
        else collateral = 30;
        if (debtToAssetRatio < 0.3) collateral = Math.min(100, collateral + 10);

        // CONDITIONS — macro/industry (static baseline + extraction confidence boost)
        let conditions = 70;
        if (extracted.extractionConfidence === 'high') conditions = 78;
        else if (extracted.extractionConfidence === 'medium') conditions = 72;

        const overall = Math.round(
            character * 0.20 +
            capacity * 0.25 +
            capital * 0.20 +
            collateral * 0.15 +
            conditions * 0.20
        );

        const riskScore = { character, capacity, capital, collateral, conditions, overall };

        // ── 5. RISK LEVEL ────────────────────────────────────────────────────────────
        let riskLevel: string;
        if (overall >= 80) riskLevel = 'Very Low Risk';
        else if (overall >= 65) riskLevel = 'Low Risk';
        else if (overall >= 50) riskLevel = 'Moderate Risk';
        else if (overall >= 35) riskLevel = 'High Risk';
        else riskLevel = 'Very High Risk';

        // ── 6. LOAN DECISION ENGINE ──────────────────────────────────────────────────
        let decisionStatus: DecisionStatus;
        let recommendedAmount: number;
        let interestRate: number;

        if (overall >= 75 && dangerAlerts === 0) {
            decisionStatus = 'APPROVED';
            recommendedAmount = Math.min(netWorth * 0.6, extracted.totalAssets * 0.4);
            interestRate = 10.5;
        } else if (overall >= 50) {
            decisionStatus = 'CONDITIONAL';
            recommendedAmount = Math.min(netWorth * 0.3, extracted.totalAssets * 0.2);
            interestRate = overall >= 65 ? 12.5 : 14.5;
        } else {
            decisionStatus = 'REJECTED';
            recommendedAmount = 0;
            interestRate = 0;
        }

        // Build a detailed reasoning string
        const reasoningParts: string[] = [
            `Credit score: ${overall}/100 (${riskLevel}).`,
            `Profit margin: ${(profitMargin * 100).toFixed(1)}%.`,
            `D/E ratio: ${debtToEquity > 100 ? 'N/A' : debtToEquity.toFixed(2)}.`,
            `Asset coverage: ${currentCoverage.toFixed(2)}x.`,
        ];
        if (dangerAlerts > 0) reasoningParts.push(`${dangerAlerts} critical fraud flag(s) detected.`);
        if (warningAlerts > 0) reasoningParts.push(`${warningAlerts} warning(s) flagged.`);
        if (decisionStatus === 'APPROVED') reasoningParts.push('Strong financials support approval.');
        if (decisionStatus === 'CONDITIONAL') reasoningParts.push('Sanction subject to additional collateral/guarantees.');
        if (decisionStatus === 'REJECTED') reasoningParts.push('Risk profile exceeds acceptable threshold.');

        const loanDecision = {
            status: decisionStatus,
            amount: Math.max(Math.round(recommendedAmount / 100000) * 100000, 0), // Round to nearest lakh
            interestRate,
            riskLevel,
            reasoning: reasoningParts.join(' '),
        };

        // ── 7. INSIGHTS based on document data ──────────────────────────────────────
        const today = new Date().toISOString().split('T')[0];
        const newsInsights = [
            {
                title: profitMargin > 0.1
                    ? 'Company shows healthy profit margin above 10%'
                    : profitMargin > 0
                        ? 'Company is profitable but with thin margins—monitor closely'
                        : 'Company reported a net loss—financial stress indicated',
                sentiment: profitMargin > 0.1 ? 'positive' : profitMargin > 0 ? 'neutral' : 'negative',
                source: 'IntelliCredit Analysis Engine',
                date: today,
            },
            {
                title: debtToEquity < 1
                    ? 'Low leverage: company assets significantly exceed debt'
                    : debtToEquity < 2.5
                        ? 'Moderate leverage: within acceptable banking parameters'
                        : 'High leverage: debt significantly exceeds equity—caution advised',
                sentiment: debtToEquity < 1 ? 'positive' : debtToEquity < 2.5 ? 'neutral' : 'negative',
                source: 'Balance Sheet Analysis',
                date: today,
            },
            {
                title: fraudAlerts.length === 0
                    ? 'No fraud indicators found in uploaded documents'
                    : `${fraudAlerts.length} risk signal(s) flagged—review before sanctioning`,
                sentiment: fraudAlerts.length === 0 ? 'positive' : 'negative',
                source: 'Fraud Detection Engine',
                date: today,
            },
        ];

        // ── 8. FINAL RESPONSE ─────────────────────────────────────────────────────────
        return NextResponse.json({
            success: true,
            extractionConfidence: extracted.extractionConfidence,
            financialData: {
                companyName: extracted.companyName,
                revenue: extracted.revenue,
                netProfit: extracted.netProfit,
                totalDebt: extracted.totalDebt,
                cashFlow: extracted.cashFlow,
                gstTurnover: extracted.gstTurnover,
                totalAssets: extracted.totalAssets,
                liabilities: extracted.liabilities,
                netWorth,
                bankDeposits: extracted.bankDeposits,
                promoterExperience: 0,
                // Derived ratios (useful for display)
                debtToAssetRatio: parseFloat((debtToAssetRatio * 100).toFixed(1)),
                profitMarginPct: parseFloat((profitMargin * 100).toFixed(1)),
                debtToEquity: parseFloat(debtToEquity.toFixed(2)),
            },
            fraudAlerts,
            riskScore,
            loanDecision,
            newsInsights,
        });

    } catch (error: any) {
        console.error('[API] Document processing error:', error?.message || error);
        return NextResponse.json({
            success: false,
            error: 'Document processing failed. Please check the file format and try again.',
            detail: error?.message || 'Unknown error',
        }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export async function POST(req: Request) {
    try {
        const data = await req.json();
        const { financialData, riskScore, loanDecision, fraudAlerts } = data;

        // Create a new PDFDocument
        const pdfDoc = await PDFDocument.create();
        const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
        const timesBoldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

        const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
        const { width, height } = page.getSize();
        let y = height - 50;

        const drawText = (text: string, size: number, font = timesRomanFont, color = rgb(0, 0, 0)) => {
            page.drawText(text, { x: 50, y, size, font, color });
            y -= size + 10;
        };

        const drawSectionHeader = (text: string) => {
            y -= 10;
            drawText(text, 16, timesBoldFont, rgb(0, 0.2, 0.6));
            // Draw underline
            page.drawLine({
                start: { x: 50, y: y + 8 },
                end: { x: width - 50, y: y + 8 },
                thickness: 1,
                color: rgb(0.8, 0.8, 0.8),
            });
            y -= 5;
        };

        // Header
        drawText('CREDIT APPRAISAL MEMO (CAM)', 20, timesBoldFont, rgb(0, 0.2, 0.5));
        y -= 10;
        drawText(`Date: ${new Date().toLocaleDateString()}`, 12);

        // Company Overview
        drawSectionHeader('1. Company Overview');
        drawText(`Company Name: ${financialData?.companyName || 'N/A'}`, 12);
        drawText(`Sector: Manufacturing / Trading (Inferred)`, 12);

        // Financial Analysis
        drawSectionHeader('2. Financial Analysis (Extracted)');
        const formatCurrency = (val: number) => `INR ${(val || 0).toLocaleString('en-IN')}`;
        drawText(`Total Revenue: ${formatCurrency(financialData?.revenue)}`, 12);
        drawText(`Net Profit: ${formatCurrency(financialData?.netProfit)}`, 12);
        drawText(`Total Debt: ${formatCurrency(financialData?.totalDebt)}`, 12);
        drawText(`Total Assets: ${formatCurrency(financialData?.totalAssets)}`, 12);
        drawText(`Net Worth: ${formatCurrency(financialData?.netWorth)}`, 12);

        // Fraud Indicators
        drawSectionHeader('3. Risk & Fraud Indicators');
        if (fraudAlerts && fraudAlerts.length > 0) {
            fraudAlerts.forEach((alert: any) => {
                drawText(`• [${alert.type.toUpperCase()}] ${alert.title}: ${alert.description}`, 11, timesRomanFont, rgb(0.8, 0.1, 0.1));
            });
        } else {
            drawText('• No major fraud indicators detected.', 12, timesRomanFont, rgb(0.1, 0.6, 0.1));
        }

        // Five Cs Evaluation
        drawSectionHeader('4. Five Cs of Credit Evaluation');
        drawText(`Character Score: ${riskScore?.character}/100`, 12);
        drawText(`Capacity Score: ${riskScore?.capacity}/100`, 12);
        drawText(`Capital Score: ${riskScore?.capital}/100`, 12);
        drawText(`Collateral Score: ${riskScore?.collateral}/100`, 12);
        drawText(`Conditions Score: ${riskScore?.conditions}/100`, 12);
        drawText(`FINAL RISK SCORE: ${riskScore?.overall}/100 (${loanDecision?.riskLevel})`, 14, timesBoldFont);

        // Final Recommendation
        drawSectionHeader('5. Final Loan Recommendation');
        drawText(`Decision Status: ${loanDecision?.status}`, 14, timesBoldFont, loanDecision?.status === 'REJECTED' ? rgb(0.8, 0, 0) : rgb(0, 0.6, 0));
        drawText(`Recommended Amount: ${formatCurrency(loanDecision?.amount)}`, 12, timesBoldFont);
        drawText(`Suggested Interest Rate: ${loanDecision?.interestRate}% p.a.`, 12);

        page.drawText('System Generated Report - IntelliCredit AI', {
            x: 50,
            y: 30,
            size: 10,
            font: timesRomanFont,
            color: rgb(0.5, 0.5, 0.5),
        });

        const pdfBytes = await pdfDoc.save();

        return new NextResponse(Buffer.from(pdfBytes), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="CAM_${financialData?.companyName?.replace(/\s+/g, '_') || 'Report'}.pdf"`,
            },
        });

    } catch (error) {
        console.error('Failed to generate CAM report:', error);
        return NextResponse.json({ success: false, error: 'Failed to generate PDF' }, { status: 500 });
    }
}

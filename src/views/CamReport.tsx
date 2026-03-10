"use client";

import { useCreditStore } from "@/store/CreditContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent, getRiskCategory } from "@/lib/credit-utils";
import { FileText, ShieldCheck, AlertTriangle, Download, ArrowUpRight, ArrowDownRight, Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import jsPDF from "jspdf";
import { motion } from "framer-motion"; // Keep motion for fadeUp

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] as const },
});

export default function CamReport() {
  const { isAnalyzed, financialData, riskScore, loanDecision, fraudAlerts, newsInsights, officerNotes } = useCreditStore();
  const router = useRouter();

  if (!isAnalyzed || !financialData || !riskScore || !loanDecision) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <h1 className="text-3xl font-bold font-display text-foreground mb-3">No Data Available</h1>
        <p className="text-muted-foreground mb-8">Please upload documents and run the analysis first to generate a CAM report.</p>
        <Button onClick={() => router.push("/upload")} size="lg" className="rounded-xl gradient-primary font-medium hover:opacity-90 shadow-soft">
          Go to Upload
        </Button>
      </div>
    );
  }

  const category = getRiskCategory(riskScore.overall);

  const exportPDF = () => {
    const doc = new jsPDF();
    let y = 20;
    const lm = 20;
    const pw = 170;

    const addTitle = (text: string) => {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(text, lm, y);
      y += 8;
    };
    const addSubtitle = (text: string) => {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(text, lm, y);
      y += 6;
    };
    const addText = (text: string) => {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(text, pw);
      doc.text(lines, lm, y);
      y += lines.length * 5 + 3;
    };
    const addLine = () => {
      doc.setDrawColor(200);
      doc.line(lm, y, lm + pw, y);
      y += 5;
    };
    const checkPage = () => {
      if (y > 270) { doc.addPage(); y = 20; }
    };

    addTitle("CREDIT APPRAISAL MEMO (CAM)");
    addText(`Generated: ${new Date().toLocaleDateString("en-IN")}`);
    addLine();

    addSubtitle("1. Company Overview");
    addText(`Company: ${financialData.companyName}`);
    addText(`Promoter Experience: ${financialData.promoterExperience} years`);
    addText(`Total Assets: ${formatCurrency(financialData.totalAssets)} | Net Worth: ${formatCurrency(financialData.netWorth)}`);
    checkPage();
    addLine();

    addSubtitle("2. Financial Analysis");
    addText(`Revenue: ${formatCurrency(financialData.revenue)}`);
    addText(`Net Profit: ${formatCurrency(financialData.netProfit)} (Margin: ${((financialData.netProfit / financialData.revenue) * 100).toFixed(1)}%)`);
    addText(`Total Debt: ${formatCurrency(financialData.totalDebt)} | D/E Ratio: ${(financialData.totalDebt / financialData.netWorth).toFixed(2)}`);
    addText(`Cash Flow: ${formatCurrency(financialData.cashFlow)}`);
    addText(`GST Turnover: ${formatCurrency(financialData.gstTurnover)} | Bank Deposits: ${formatCurrency(financialData.bankDeposits)}`);
    checkPage();
    addLine();

    addSubtitle("3. Promoter Background");
    addText(`Experience: ${financialData.promoterExperience} years in the industry.`);
    addText("Character Score: " + riskScore.character + "/100 - Based on promoter track record, compliance history, and management quality.");
    checkPage();
    addLine();

    addSubtitle("4. Industry Analysis");
    newsInsights.forEach((n) => addText(`[${n.sentiment.toUpperCase()}] ${n.title} – ${n.source} (${n.date})`));
    checkPage();
    addLine();

    addSubtitle("5. Risk Factors");
    fraudAlerts.forEach((a) => addText(`⚠ ${a.title}: ${a.description}`));
    if (officerNotes) { addText(`Officer Notes: ${officerNotes}`); }
    checkPage();
    addLine();

    addSubtitle("6. Five Cs Evaluation");
    addText(`Character: ${riskScore.character}/100 | Capacity: ${riskScore.capacity}/100 | Capital: ${riskScore.capital}/100`);
    addText(`Collateral: ${riskScore.collateral}/100 | Conditions: ${riskScore.conditions}/100`);
    addText(`Overall Score: ${riskScore.overall}/100 – ${category.label}`);
    checkPage();
    addLine();

    addSubtitle("7. Final Recommendation");
    addText(`Decision: ${loanDecision.status}`);
    addText(`Recommended Loan Amount: ${formatCurrency(loanDecision.amount)}`);
    addText(`Interest Rate: ${loanDecision.interestRate}%`);
    addText(`Risk Level: ${loanDecision.riskLevel}`);
    addText(`Reasoning: ${loanDecision.reasoning}`);

    doc.save(`CAM_Report_${financialData.companyName.replace(/\s+/g, "_")}.pdf`);
  };

  const sections = [
    {
      title: "1. Company Overview",
      content: (
        <div className="space-y-2 text-sm">
          <p><strong>Company:</strong> {financialData.companyName}</p>
          <p><strong>Promoter Experience:</strong> {financialData.promoterExperience} years</p>
          <p><strong>Total Assets:</strong> {formatCurrency(financialData.totalAssets)}</p>
          <p><strong>Net Worth:</strong> {formatCurrency(financialData.netWorth)}</p>
        </div>
      ),
    },
    {
      title: "2. Financial Analysis",
      content: (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <p><strong>Revenue:</strong> {formatCurrency(financialData.revenue)}</p>
          <p><strong>Net Profit:</strong> {formatCurrency(financialData.netProfit)}</p>
          <p><strong>Total Debt:</strong> {formatCurrency(financialData.totalDebt)}</p>
          <p><strong>Cash Flow:</strong> {formatCurrency(financialData.cashFlow)}</p>
          <p><strong>GST Turnover:</strong> {formatCurrency(financialData.gstTurnover)}</p>
          <p><strong>Bank Deposits:</strong> {formatCurrency(financialData.bankDeposits)}</p>
          <p><strong>Profit Margin:</strong> {((financialData.netProfit / financialData.revenue) * 100).toFixed(1)}%</p>
          <p><strong>D/E Ratio:</strong> {(financialData.totalDebt / financialData.netWorth).toFixed(2)}</p>
        </div>
      ),
    },
    {
      title: "3. Promoter Background",
      content: (
        <div className="text-sm space-y-1">
          <p>{financialData.promoterExperience} years of industry experience. Character score: {riskScore.character}/100.</p>
          <p className="text-muted-foreground">Based on promoter track record, compliance history, and management quality assessment.</p>
        </div>
      ),
    },
    {
      title: "4. Industry Analysis",
      content: (
        <div className="space-y-2">
          {newsInsights.map((n, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <Badge variant="outline" className={`text-[10px] shrink-0 rounded-lg ${n.sentiment === "positive" ? "border-success/40 text-success bg-success/5" : n.sentiment === "negative" ? "border-destructive/40 text-destructive bg-destructive/5" : "bg-muted/40"}`}>{n.sentiment}</Badge>
              <span>{n.title} – <span className="text-muted-foreground">{n.source}</span></span>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: "5. Risk Factors",
      content: (
        <div className="space-y-2">
          {fraudAlerts.map((a, i) => (
            <div key={i} className={`p-3 rounded-xl text-sm ${a.type === "danger" ? "bg-destructive/5 border border-destructive/20" : "bg-warning/5 border border-warning/20"}`}>
              <span className={`font-semibold ${a.type === "danger" ? "text-destructive" : "text-warning"}`}>⚠ {a.title}:</span> {a.description}
            </div>
          ))}
          {officerNotes && <p className="text-sm text-muted-foreground italic mt-2">Officer Notes: "{officerNotes}"</p>}
        </div>
      ),
    },
    {
      title: "6. Five Cs Evaluation",
      content: (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          {[
            { label: "Character", value: riskScore.character },
            { label: "Capacity", value: riskScore.capacity },
            { label: "Capital", value: riskScore.capital },
            { label: "Collateral", value: riskScore.collateral },
            { label: "Conditions", value: riskScore.conditions },
            { label: "Overall", value: riskScore.overall },
          ].map((item) => {
            const cat = getRiskCategory(item.value);
            return (
              <div key={item.label} className="p-4 bg-muted/40 rounded-xl border border-border/30">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className={`text-lg font-bold ${cat.color}`}>{item.value}<span className="text-xs text-muted-foreground">/100</span></p>
              </div>
            );
          })}
        </div>
      ),
    },
    {
      title: "7. Final Recommendation",
      content: (
        <div className={`p-5 rounded-xl border-2 ${loanDecision.status === "APPROVED" ? "border-success/20 bg-success/5" : "border-destructive/20 bg-destructive/5"}`}>
          <div className="flex flex-wrap gap-4 items-center mb-3">
            <Badge className={`rounded-lg px-3 py-1 ${loanDecision.status === "APPROVED" ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}`}>
              Loan Decision: {loanDecision.status}
            </Badge>
            <span className="text-sm"><strong>Amount:</strong> {formatCurrency(loanDecision.amount)}</span>
            <span className="text-sm"><strong>Interest:</strong> {loanDecision.interestRate}%</span>
            <span className="text-sm"><strong>Risk:</strong> {loanDecision.riskLevel}</span>
          </div>
          <p className="text-sm text-muted-foreground italic">"{loanDecision.reasoning}"</p>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <motion.div {...fadeUp()} className="flex items-center justify-between">
        <div className="rounded-2xl gradient-primary p-6 shadow-soft flex-1 mr-4">
          <h1 className="text-2xl font-bold font-display text-primary-foreground flex items-center gap-2">
            <FileText className="h-6 w-6" /> Credit Appraisal Memo
          </h1>
          <p className="text-sm text-primary-foreground/70 mt-1">{financialData.companyName}</p>
        </div>
        <Button onClick={exportPDF} className="gradient-primary text-primary-foreground hover:opacity-90 rounded-xl shadow-soft shrink-0">
          <Download className="h-4 w-4 mr-2" /> Export PDF
        </Button>
      </motion.div>

      {sections.map((section, i) => (
        <motion.div key={i} {...fadeUp(0.05 * (i + 1))}>
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display font-semibold text-foreground">{section.title}</CardTitle>
            </CardHeader>
            <CardContent>{section.content}</CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

"use client";

import { useCreditStore } from "@/store/CreditContext";
import { formatCurrency } from "@/lib/credit-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] as const },
});

export default function CreditAnalysis() {
  const { isAnalyzed, financialData, riskScore, loanDecision, newsInsights } = useCreditStore();
  const router = useRouter();

  if (!isAnalyzed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <h1 className="text-3xl font-bold font-display text-foreground mb-3">No Data Available</h1>
        <p className="text-muted-foreground mb-8">Please upload documents and run the analysis first to view financial insights.</p>
        <Button onClick={() => router.push("/upload")} size="lg" className="rounded-xl gradient-primary font-medium hover:opacity-90 shadow-soft">
          Go to Upload
        </Button>
      </div>
    );
  }

  const radarData = riskScore ? [
    { metric: "Character", value: riskScore.character, fullMark: 100 },
    { metric: "Capacity", value: riskScore.capacity, fullMark: 100 },
    { metric: "Capital", value: riskScore.capital, fullMark: 100 },
    { metric: "Collateral", value: riskScore.collateral, fullMark: 100 },
    { metric: "Conditions", value: riskScore.conditions, fullMark: 100 },
  ] : [];

  const financialMetrics = financialData ? [
    { label: "Revenue", value: financialData.revenue },
    { label: "Net Profit", value: financialData.netProfit },
    { label: "Total Debt", value: financialData.totalDebt },
    { label: "Cash Flow", value: financialData.cashFlow },
    { label: "GST Turnover", value: financialData.gstTurnover },
    { label: "Total Assets", value: financialData.totalAssets },
    { label: "Net Worth", value: financialData.netWorth },
    { label: "Bank Deposits", value: financialData.bankDeposits },
  ] : [];

  const comparisonData = financialData ? [
    { name: "GST Turnover", amount: financialData.gstTurnover / 10000000 },
    { name: "Bank Deposits", amount: financialData.bankDeposits / 10000000 },
    { name: "Revenue", amount: financialData.revenue / 10000000 },
  ] : [];

  return (
    <div className="space-y-6">
      <motion.div {...fadeUp()}>
        <div className="rounded-2xl gradient-primary p-6 shadow-soft">
          <h1 className="text-2xl font-bold font-display text-primary-foreground">Credit Analysis</h1>
          <p className="text-sm text-primary-foreground/70 mt-1">{financialData?.companyName} – AI-Powered Financial Analysis</p>
        </div>
      </motion.div>

      {/* Financial Metrics Grid */}
      <motion.div {...fadeUp(0.1)}>
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">Extracted Financial Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {financialMetrics.map((m) => (
                <div key={m.label} className="p-4 rounded-xl bg-muted/40 border border-border/30">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{m.label}</p>
                  <p className="text-lg font-bold font-display mt-1.5">{formatCurrency(m.value)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div {...fadeUp(0.2)}>
          <Card className="glass-card h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground">GST vs Bank Deposit Comparison (₹ Cr)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,15%,90%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(220, 10%, 46%)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(220, 10%, 46%)" }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(222, 15%, 90%)" }} />
                  <Bar dataKey="amount" fill="url(#barGrad2)" radius={[8, 8, 0, 0]} />
                  <defs>
                    <linearGradient id="barGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(231, 60%, 68%)" />
                      <stop offset="100%" stopColor="hsl(264, 52%, 72%)" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div {...fadeUp(0.25)}>
          <Card className="glass-card h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground">Five Cs of Credit – Radar</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(222,15%,90%)" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: "hsl(220, 10%, 46%)" }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
                  <Radar name="Score" dataKey="value" stroke="hsl(231,60%,68%)" fill="hsl(231,60%,68%)" fillOpacity={0.2} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* AI Research / News */}
      <motion.div {...fadeUp(0.3)}>
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">AI Research Agent – News & Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {newsInsights.map((n, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                  <Badge variant="outline" className={`shrink-0 text-[10px] rounded-lg ${n.sentiment === "positive" ? "border-success/40 text-success bg-success/5" : n.sentiment === "negative" ? "border-destructive/40 text-destructive bg-destructive/5" : "bg-muted/40"}`}>
                    {n.sentiment}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-foreground">{n.title}</p>
                    <p className="text-[10px] text-muted-foreground">{n.source} • {n.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Loan Decision */}
      {loanDecision && (
        <motion.div {...fadeUp(0.35)}>
          <Card className={`glass-card border-2 ${loanDecision.status === "APPROVED" ? "border-success/20" : "border-destructive/20"}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-foreground">Decision Engine Output</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-4 items-center">
                <Badge className={`rounded-lg px-3 py-1 ${loanDecision.status === "APPROVED" ? "bg-success text-success-foreground" : "bg-destructive"}`}>
                  {loanDecision.status}
                </Badge>
                <span className="text-sm"><strong>Amount:</strong> {formatCurrency(loanDecision.amount)}</span>
                <span className="text-sm"><strong>Interest:</strong> {loanDecision.interestRate}%</span>
                <span className="text-sm"><strong>Risk:</strong> {loanDecision.riskLevel}</span>
              </div>
              <p className="text-sm text-muted-foreground italic">"{loanDecision.reasoning}"</p>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

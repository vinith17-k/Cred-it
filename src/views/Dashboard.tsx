"use client";

import { useCreditStore } from "@/store/CreditContext";
import { formatCurrency, getRiskCategory } from "@/lib/credit-utils";
import { RiskGauge } from "@/components/RiskGauge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Newspaper,
  IndianRupee,
  BarChart3,
  ShieldCheck,
  ShieldAlert,
  Target,
  CreditCard, FileText, ArrowUpRight, ArrowDownRight, Activity, Percent, Building2, Upload
} from "lucide-react";
import { useRouter } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart } from "recharts";
import { Button } from "@/components/ui/button";



const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] as const },
});

export default function Dashboard() {
  const state = useCreditStore();
  const { isAnalyzed, financialData, fraudAlerts, riskScore, loanDecision, newsInsights } = state;
  const router = useRouter();

  if (!isAnalyzed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <motion.div {...fadeUp()} className="text-center max-w-lg">
          <Card className="w-full max-w-md text-center p-6">
            <CardHeader className="pb-4">
              <div className="h-20 w-20 rounded-3xl gradient-primary flex items-center justify-center mx-auto mb-6 shadow-soft">
                <CreditCard className="h-10 w-10 text-primary-foreground" />
              </div>
              <CardTitle className="text-3xl font-bold font-display text-foreground mb-3">Welcome to IntelliCredit AI</CardTitle>
              <CardDescription className="text-muted-foreground mb-8 leading-relaxed">
                Upload company documents to begin AI-powered credit analysis. The system will extract financial data, detect fraud patterns, compute risk scores, and generate a Credit Appraisal Memo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push("/upload")} className="px-8 py-3.5 rounded-2xl gradient-primary text-primary-foreground font-semibold hover:opacity-90 transition-all duration-300 shadow-soft hover:shadow-card-hover">
                <Upload className="mr-2 h-4 w-4" />
                Upload Documents to Begin
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const financialChartData = financialData
    ? [
      { name: "Revenue", value: financialData.revenue / 10000000 },
      { name: "Net Profit", value: financialData.netProfit / 10000000 },
      { name: "Total Debt", value: financialData.totalDebt / 10000000 },
      { name: "Cash Flow", value: financialData.cashFlow / 10000000 },
      { name: "Net Worth", value: financialData.netWorth / 10000000 },
    ]
    : [];

  const fiveCData = riskScore
    ? [
      { name: "Character", value: riskScore.character },
      { name: "Capacity", value: riskScore.capacity },
      { name: "Capital", value: riskScore.capital },
      { name: "Collateral", value: riskScore.collateral },
      { name: "Conditions", value: riskScore.conditions },
    ]
    : [];

  // Build trend data from real financial data: show quarterly approximations
  const rev = financialData?.revenue ?? 0;
  const profit = financialData?.netProfit ?? 0;
  const revCr = rev / 10000000; // Convert to Crores
  const profCr = profit / 10000000;
  const trendData = [
    { month: "Q1", revenue: parseFloat((revCr * 0.22).toFixed(2)), profit: parseFloat((profCr * 0.20).toFixed(2)) },
    { month: "Q2", revenue: parseFloat((revCr * 0.24).toFixed(2)), profit: parseFloat((profCr * 0.23).toFixed(2)) },
    { month: "Q3", revenue: parseFloat((revCr * 0.26).toFixed(2)), profit: parseFloat((profCr * 0.26).toFixed(2)) },
    { month: "Q4", revenue: parseFloat((revCr * 0.28).toFixed(2)), profit: parseFloat((profCr * 0.31).toFixed(2)) },
  ];

  const profitMarginPct = financialData && financialData.revenue > 0
    ? `${((financialData.netProfit / financialData.revenue) * 100).toFixed(1)}% margin`
    : "—";

  const pieColors = ["hsl(231, 60%, 68%)", "hsl(264, 52%, 72%)", "hsl(168, 60%, 45%)", "hsl(210, 80%, 56%)", "hsl(38, 92%, 55%)"];

  const kpiCards = [
    {
      label: "Total Revenue",
      value: financialData && formatCurrency(financialData.revenue),
      trend: profitMarginPct,
      trendUp: true,
      icon: IndianRupee,
      color: "from-primary/10 to-accent/10",
      iconColor: "text-primary",
    },
    {
      label: "Credit Score",
      value: riskScore ? `${riskScore.overall}/100` : "—",
      trend: getRiskCategory(riskScore?.overall ?? 0).label,
      trendUp: (riskScore?.overall ?? 0) >= 65,
      icon: Target,
      color: "from-accent/10 to-primary/10",
      iconColor: "text-accent",
    },
    {
      label: "Risk Index",
      value: loanDecision?.riskLevel ?? "—",
      trend: `${fraudAlerts.length} alerts`,
      trendUp: false,
      icon: ShieldAlert,
      color: "from-warning/10 to-destructive/10",
      iconColor: "text-warning",
    },
    {
      label: "Loan Decision",
      value: loanDecision?.status ?? "—",
      trend: loanDecision ? `${formatCurrency(loanDecision.amount)} @ ${loanDecision.interestRate}%` : "",
      trendUp: loanDecision?.status === "APPROVED",
      icon: loanDecision?.status === "APPROVED" ? CheckCircle2 : XCircle,
      color: loanDecision?.status === "APPROVED" ? "from-success/10 to-success/5" : "from-destructive/10 to-destructive/5",
      iconColor: loanDecision?.status === "APPROVED" ? "text-success" : "text-destructive",
    },
    {
      label: "Fraud Alerts",
      value: `${fraudAlerts.length}`,
      trend: `${fraudAlerts.filter(a => a.type === "danger").length} critical`,
      trendUp: false,
      icon: AlertTriangle,
      color: "from-destructive/10 to-warning/10",
      iconColor: "text-destructive",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header with gradient */}
      <motion.div {...fadeUp()}>
        <div className="rounded-2xl gradient-primary p-6 shadow-soft">
          <h1 className="text-2xl font-bold font-display text-primary-foreground">Credit Dashboard</h1>
          <p className="text-sm text-primary-foreground/70 mt-1">{financialData?.companyName} — AI-Powered Credit Analysis Overview</p>
        </div>
      </motion.div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpiCards.map((kpi, i) => (
          <motion.div key={kpi.label} {...fadeUp(0.05 * (i + 1))}>
            <Card className="glass-card overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2.5 rounded-xl bg-gradient-to-br ${kpi.color}`}>
                    <kpi.icon className={`h-4 w-4 ${kpi.iconColor}`} />
                  </div>
                </div>
                <p className="text-2xl font-bold font-display text-foreground">{kpi.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
                <div className="flex items-center gap-1 mt-2">
                  {kpi.trendUp ? (
                    <TrendingUp className="h-3 w-3 text-success" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-destructive" />
                  )}
                  <span className={`text-[11px] font-medium ${kpi.trendUp ? "text-success" : "text-destructive"}`}>
                    {kpi.trend}
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Analytics Row: Risk Gauge + Financial Chart + Revenue Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div {...fadeUp(0.3)}>
          <Card className="glass-card h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground">Credit Risk Score</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center pb-6">
              {riskScore && <RiskGauge score={riskScore.overall} />}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div {...fadeUp(0.35)}>
          <Card className="glass-card h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground">Financial Overview (₹ Cr)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={financialChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 15%, 90%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(220, 10%, 46%)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(220, 10%, 46%)" }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(222, 15%, 90%)", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }} />
                  <Bar dataKey="value" fill="url(#barGradient)" radius={[8, 8, 0, 0]} />
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(231, 60%, 68%)" />
                      <stop offset="100%" stopColor="hsl(264, 52%, 72%)" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div {...fadeUp(0.4)}>
          <Card className="glass-card h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground">Revenue Trend (₹ Cr)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 15%, 90%)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(220, 10%, 46%)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(220, 10%, 46%)" }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(222, 15%, 90%)", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }} />
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(231, 60%, 68%)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(231, 60%, 68%)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="revenue" stroke="hsl(231, 60%, 68%)" fill="url(#areaGradient)" strokeWidth={2.5} dot={{ r: 3, fill: "hsl(231, 60%, 68%)" }} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Bottom row: Five Cs + Fraud Alerts + News */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div {...fadeUp(0.45)}>
          <Card className="glass-card h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground">Five Cs Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={fiveCData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`} strokeWidth={0}>
                    {fiveCData.map((_, i) => (
                      <Cell key={i} fill={pieColors[i % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(222, 15%, 90%)" }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div {...fadeUp(0.5)}>
          <Card className="glass-card h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-destructive/10">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                </div>
                Risk Alerts & Fraud Signals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {fraudAlerts.map((alert, i) => (
                <div key={i} className={`p-3 rounded-xl border transition-all duration-200 hover:shadow-sm ${alert.type === "danger" ? "border-destructive/20 bg-destructive/5" : "border-warning/20 bg-warning/5"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`h-2 w-2 rounded-full ${alert.type === "danger" ? "bg-destructive" : "bg-warning"}`} />
                    <p className={`text-xs font-semibold ${alert.type === "danger" ? "text-destructive" : "text-warning"}`}>{alert.title}</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground pl-4">{alert.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div {...fadeUp(0.55)}>
          <Card className="glass-card h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-info/10">
                  <Newspaper className="h-3.5 w-3.5 text-info" />
                </div>
                AI Insights & News
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {newsInsights.slice(0, 4).map((news, i) => (
                <div key={i} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-muted/40 transition-colors">
                  <Badge variant="outline" className={`text-[10px] shrink-0 rounded-lg border ${news.sentiment === "positive" ? "border-success/40 text-success bg-success/5" : news.sentiment === "negative" ? "border-destructive/40 text-destructive bg-destructive/5" : "border-muted-foreground/30 bg-muted/40"}`}>
                    {news.sentiment}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground leading-snug">{news.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{news.source} • {news.date}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Company Overview Section */}
      {financialData && (
        <motion.div {...fadeUp(0.6)}>
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-foreground">Company Overview & Key Financial Indicators</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Company", value: financialData.companyName, isText: true },
                  { label: "Promoter Exp.", value: `${financialData.promoterExperience} years` },
                  { label: "Total Assets", value: formatCurrency(financialData.totalAssets) },
                  { label: "Net Worth", value: formatCurrency(financialData.netWorth) },
                  { label: "Total Debt", value: formatCurrency(financialData.totalDebt) },
                  { label: "D/E Ratio", value: (financialData.totalDebt / financialData.netWorth).toFixed(2) },
                  { label: "GST Turnover", value: formatCurrency(financialData.gstTurnover) },
                  { label: "Bank Deposits", value: formatCurrency(financialData.bankDeposits) },
                ].map((item) => (
                  <div key={item.label} className="p-4 rounded-xl bg-muted/40 border border-border/30">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{item.label}</p>
                    <p className={`font-bold font-display mt-1.5 ${item.isText ? "text-sm" : "text-lg"}`}>{item.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

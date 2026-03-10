"use client";

import { useState } from "react";
import { useCreditStore } from "@/store/CreditContext";
import { getRiskCategory } from "@/lib/credit-utils";
import { RiskGauge } from "@/components/RiskGauge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { AlertTriangle, ShieldAlert, AlertCircle, FileWarning, ArrowUpRight, TrendingUp, Wallet, ShieldCheck, Download, AlertOctagon, Info, MessageSquare } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";


const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] as const },
});

export default function RiskDashboard() {
  const { isAnalyzed, fraudAlerts, riskScore, officerNotes, setOfficerNotes, setRiskScore } = useCreditStore();
  const [localNotes, setLocalNotes] = useState(officerNotes);
  const router = useRouter();

  if (!isAnalyzed || !riskScore) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <h1 className="text-3xl font-bold font-display text-foreground mb-3">No Data Available</h1>
        <p className="text-muted-foreground mb-8">Please upload documents and run the analysis first to view risk insights.</p>
        <Button onClick={() => router.push("/upload")} size="lg" className="rounded-xl gradient-primary font-medium hover:opacity-90 shadow-soft">
          Go to Upload
        </Button>
      </div>
    );
  }

  const fiveCItems = [
    { key: "character" as const, label: "Character", desc: "Promoter credibility, track record, industry experience" },
    { key: "capacity" as const, label: "Capacity", desc: "Cash flow strength, ability to service debt" },
    { key: "capital" as const, label: "Capital", desc: "Net worth, equity investment, skin in the game" },
    { key: "collateral" as const, label: "Collateral", desc: "Asset coverage, collateral quality and liquidity" },
    { key: "conditions" as const, label: "Conditions", desc: "Industry outlook, market conditions, regulatory environment" },
  ];

  const category = getRiskCategory(riskScore.overall);

  const handleNotesSubmit = () => {
    setOfficerNotes(localNotes);
    const negativeWords = ["low capacity", "risk", "loss", "fraud", "concern", "weak", "declining"];
    const hasNegative = negativeWords.some((w) => localNotes.toLowerCase().includes(w));
    if (hasNegative && riskScore) {
      const adjusted = { ...riskScore, overall: Math.max(0, riskScore.overall - 5) };
      setRiskScore(adjusted);
      toast.info("Risk score adjusted by -5 points based on officer observations.");
    } else {
      toast.success("Officer notes saved successfully.");
    }
  };

  return (
    <div className="space-y-6">
      <motion.div {...fadeUp()}>
        <div className="rounded-2xl gradient-primary p-6 shadow-soft">
          <h1 className="text-2xl font-bold font-display text-primary-foreground">Risk Dashboard</h1>
          <p className="text-sm text-primary-foreground/70 mt-1">Five Cs Credit Risk Assessment & Fraud Analysis</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div {...fadeUp(0.1)}>
          <Card className="glass-card h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground">Overall Risk Score</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center pb-6">
              <RiskGauge score={riskScore.overall} size={220} />
              <Badge className="mt-4 rounded-lg px-3 py-1" style={{ backgroundColor: `${category.color.includes("success") ? "hsl(168,60%,45%)" : category.color.includes("info") ? "hsl(210,80%,56%)" : category.color.includes("warning") ? "hsl(38,92%,55%)" : "hsl(0,72%,55%)"}`, color: "white" }}>
                {category.label}
              </Badge>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div {...fadeUp(0.15)} className="lg:col-span-2">
          <Card className="glass-card h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-foreground">Five Cs Evaluation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {fiveCItems.map((item) => {
                const score = riskScore[item.key];
                const cat = getRiskCategory(score);
                return (
                  <div key={item.key}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-sm font-semibold text-foreground">{item.label}</span>
                        <span className="text-xs text-muted-foreground ml-2 hidden md:inline">{item.desc}</span>
                      </div>
                      <span className={`text-sm font-bold ${cat.color}`}>{score}/100</span>
                    </div>
                    <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{
                          background: score >= 80
                            ? "linear-gradient(90deg, hsl(168,60%,45%), hsl(168,60%,55%))"
                            : score >= 65
                              ? "linear-gradient(90deg, hsl(210,80%,56%), hsl(231,60%,68%))"
                              : score >= 40
                                ? "linear-gradient(90deg, hsl(38,92%,55%), hsl(38,80%,60%))"
                                : "linear-gradient(90deg, hsl(0,72%,55%), hsl(0,60%,60%))",
                        }}
                        initial={{ width: 0 }}
                        animate={{ width: `${score}%` }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Fraud Alerts */}
      <motion.div {...fadeUp(0.25)}>
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-warning/10">
                <AlertTriangle className="h-4 w-4 text-warning" />
              </div>
              Fraud Detection Engine
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {fraudAlerts.map((alert, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className={`p-4 rounded-xl border transition-all duration-200 hover:shadow-sm ${alert.type === "danger" ? "border-destructive/20 bg-destructive/5" : "border-warning/20 bg-warning/5"}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`h-2 w-2 rounded-full ${alert.type === "danger" ? "bg-destructive" : "bg-warning"}`} />
                    <p className={`text-sm font-semibold ${alert.type === "danger" ? "text-destructive" : "text-warning"}`}>{alert.title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground pl-4">{alert.description}</p>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Officer Notes */}
      <motion.div {...fadeUp(0.3)}>
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <MessageSquare className="h-4 w-4 text-primary" />
              </div>
              Credit Officer Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">Add qualitative observations. Negative keywords may adjust the risk score.</p>
            <Textarea
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              placeholder='e.g., "Factory operating at 40% capacity. Promoter has diversified into unrelated sectors."'
              rows={4}
              className="rounded-xl border-border/50 focus:ring-primary/30"
            />
            <Button onClick={handleNotesSubmit} className="gradient-primary text-primary-foreground hover:opacity-90 rounded-xl shadow-soft">
              Save Notes & Recalculate
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

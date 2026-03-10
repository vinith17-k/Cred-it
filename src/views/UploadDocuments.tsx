"use client";

import { useState } from "react";
import { useCreditStore } from "@/store/CreditContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, FileSpreadsheet, Loader2, CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] as const },
});

const docTypes = [
  { label: "GST Return", icon: FileText, accept: ".pdf,.csv", hint: "GSTR-3B, GSTR-1 exports" },
  { label: "Bank Statement", icon: FileSpreadsheet, accept: ".pdf,.csv,.xlsx", hint: "CSV with Credit/Debit columns" },
  { label: "Annual Report", icon: FileText, accept: ".pdf", hint: "Balance sheet, P&L statement" },
  { label: "Financial Statement", icon: FileSpreadsheet, accept: ".pdf,.csv,.xlsx", hint: "Any structured financial data" },
];

type AnalysisStep = "idle" | "uploading" | "parsing" | "scoring" | "done" | "error";

const stepLabels: Record<AnalysisStep, string> = {
  idle: "",
  uploading: "Uploading documents...",
  parsing: "Parsing financial data (PDF/CSV/Excel)...",
  scoring: "Computing risk score & loan decision...",
  done: "Analysis complete!",
  error: "Processing failed",
};

export default function UploadDocuments() {
  const {
    setUploadedFiles,
    setIsAnalyzed,
    setFinancialData,
    setFraudAlerts,
    setRiskScore,
    setLoanDecision,
    setNewsInsights,
    setExtractionConfidence,
  } = useCreditStore();

  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [step, setStep] = useState<AnalysisStep>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();

  const handleFile = (docType: string, file: File | null) => {
    if (file) setFiles((prev) => ({ ...prev, [docType]: file }));
  };

  const uploadedCount = Object.values(files).filter(Boolean).length;

  const handleAnalyze = async () => {
    if (uploadedCount === 0) {
      toast.error("Please upload at least one document first.");
      return;
    }

    setStep("uploading");
    setErrorMsg("");

    const formData = new FormData();
    Object.values(files).forEach((file) => {
      if (file) formData.append("files", file);
    });

    try {
      setStep("parsing");
      const resp = await fetch("/api/process-documents", {
        method: "POST",
        body: formData,
      });

      setStep("scoring");
      const result = await resp.json();

      if (!resp.ok || !result.success) {
        throw new Error(result.error || `Server returned ${resp.status}`);
      }

      // Store all real data from the API into global context
      setFinancialData(result.financialData);
      setFraudAlerts(result.fraudAlerts);
      setRiskScore(result.riskScore);
      setLoanDecision(result.loanDecision);
      setNewsInsights(result.newsInsights);
      setUploadedFiles(Object.keys(files).filter((k) => files[k] !== null));
      setExtractionConfidence(result.extractionConfidence || "medium");
      setIsAnalyzed(true);

      setStep("done");
      toast.success(
        `Analysis complete! Extraction confidence: ${result.extractionConfidence?.toUpperCase() || "MEDIUM"}`,
        { duration: 4000 }
      );

      setTimeout(() => router.push("/analysis"), 800);

    } catch (err: any) {
      console.error("[Upload] Error:", err);
      setErrorMsg(err.message || "Unexpected error. Please try again.");
      setStep("error");
      toast.error(err.message || "Failed to process documents.");
    }
  };

  const isProcessing = step === "uploading" || step === "parsing" || step === "scoring";

  return (
    <div className="space-y-6 max-w-4xl">
      <motion.div {...fadeUp()}>
        <div className="rounded-2xl gradient-primary p-6 shadow-soft mb-6">
          <h1 className="text-2xl font-bold font-display text-primary-foreground">Upload Documents</h1>
          <p className="text-sm text-primary-foreground/70 mt-1">
            Upload company financial documents. The AI engine will extract real financial data and compute a credit score.
          </p>
        </div>
      </motion.div>

      {/* Document type info */}
      <motion.div {...fadeUp(0.05)}>
        <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20 text-sm text-muted-foreground">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p>
            <strong className="text-foreground">Supported formats:</strong> PDF (text-based), CSV (with labelled columns), Excel (.xlsx/.xls with header rows).
            For best results, ensure documents contain labelled financial rows like "Revenue:", "Net Profit:", "Total Debt:", etc.
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {docTypes.map((doc, i) => {
          const file = files[doc.label];
          return (
            <motion.div key={doc.label} {...fadeUp(0.05 * (i + 1))}>
              <Card className={`glass-card transition-all ${file ? "ring-2 ring-success/30" : ""}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <div className="p-2 rounded-xl bg-primary/10">
                      <doc.icon className="h-4 w-4 text-primary" />
                    </div>
                    {doc.label}
                    {file && <CheckCircle2 className="h-4 w-4 text-success ml-auto" />}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {file ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground p-3 rounded-xl bg-success/5 border border-success/20">
                      <FileText className="h-3.5 w-3.5 text-success" />
                      <span className="truncate flex-1">{file.name}</span>
                      <button
                        onClick={() => setFiles((p) => ({ ...p, [doc.label]: null }))}
                        className="text-destructive text-[11px] font-medium hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-border/60 rounded-xl p-8 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all duration-300">
                      <Upload className="h-7 w-7 text-muted-foreground/60 mb-3" />
                      <span className="text-xs font-medium text-muted-foreground">Click to upload or drag & drop</span>
                      <span className="text-[10px] text-muted-foreground/50 mt-1">{doc.hint}</span>
                      <input
                        type="file"
                        className="hidden"
                        accept={doc.accept}
                        onChange={(e) => handleFile(doc.label, e.target.files?.[0] || null)}
                      />
                    </label>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Processing status */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center gap-3"
          >
            <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">{stepLabels[step]}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {step === "parsing" && "Reading PDF text, CSV columns, and Excel rows..."}
                {step === "scoring" && "Running fraud detection and Five Cs credit model..."}
                {step === "uploading" && "Sending files to processing server..."}
              </p>
            </div>
          </motion.div>
        )}

        {step === "error" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 flex items-start gap-3"
          >
            <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-destructive">Processing Failed</p>
              <p className="text-xs text-muted-foreground mt-1">{errorMsg}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 text-xs"
                onClick={() => setStep("idle")}
              >
                Try Again
              </Button>
            </div>
          </motion.div>
        )}

        {step === "done" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 rounded-xl bg-success/5 border border-success/20 flex items-center gap-3"
          >
            <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
            <p className="text-sm font-medium text-success">Analysis complete — redirecting to dashboard...</p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div {...fadeUp(0.3)} className="flex items-center gap-4">
        <Button
          onClick={handleAnalyze}
          disabled={isProcessing || uploadedCount === 0 || step === "done"}
          className="gradient-primary text-primary-foreground hover:opacity-90 px-8 py-3 rounded-xl shadow-soft"
        >
          {isProcessing ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {stepLabels[step]}</>
          ) : step === "done" ? (
            <><CheckCircle2 className="h-4 w-4 mr-2" /> Analysis Complete</>
          ) : (
            <>Run AI Analysis ({uploadedCount} file{uploadedCount !== 1 ? "s" : ""})</>
          )}
        </Button>

        {step === "done" && (
          <Button onClick={() => router.push("/analysis")} variant="outline" size="sm">
            View Results →
          </Button>
        )}
      </motion.div>
    </div>
  );
}

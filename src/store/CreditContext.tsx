"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

export interface FinancialData {
  companyName: string;
  revenue: number;
  netProfit: number;
  totalDebt: number;
  cashFlow: number;
  gstTurnover: number;
  totalAssets: number;
  netWorth: number;
  liabilities: number;
  bankDeposits: number;
  promoterExperience: number;
}

export interface FraudAlert {
  type: "warning" | "danger";
  title: string;
  description: string;
}

export interface RiskScore {
  character: number;
  capacity: number;
  capital: number;
  collateral: number;
  conditions: number;
  overall: number;
}

export interface LoanDecision {
  status: "APPROVED" | "CONDITIONAL" | "REJECTED";
  amount: number;
  interestRate: number;
  riskLevel: string;
  reasoning: string;
}

export interface NewsInsight {
  title: string;
  sentiment: "positive" | "neutral" | "negative";
  source: string;
  date: string;
}

export interface CreditState {
  isAnalyzed: boolean;
  extractionConfidence: 'high' | 'medium' | 'low';
  financialData: FinancialData | null;
  fraudAlerts: FraudAlert[];
  riskScore: RiskScore | null;
  loanDecision: LoanDecision | null;
  newsInsights: NewsInsight[];
  uploadedFiles: string[];
  officerNotes: string;
  setFinancialData: (data: FinancialData) => void;
  setFraudAlerts: (alerts: FraudAlert[]) => void;
  setRiskScore: (score: RiskScore) => void;
  setLoanDecision: (decision: LoanDecision) => void;
  setNewsInsights: (insights: NewsInsight[]) => void;
  setUploadedFiles: (files: string[]) => void;
  setOfficerNotes: (notes: string) => void;
  setIsAnalyzed: (v: boolean) => void;
  setExtractionConfidence: (c: 'high' | 'medium' | 'low') => void;
}

const CreditContext = createContext<CreditState | undefined>(undefined);

export function useCreditStore() {
  const ctx = useContext(CreditContext);
  if (!ctx) throw new Error("useCreditStore must be used within CreditProvider");
  return ctx;
}

export function CreditProvider({ children }: { children: ReactNode }) {
  const [isAnalyzed, setIsAnalyzed] = useState(false);
  const [extractionConfidence, setExtractionConfidence] = useState<'high' | 'medium' | 'low'>('low');
  const [financialData, setFinancialData] = useState<FinancialData | null>(null);
  const [fraudAlerts, setFraudAlerts] = useState<FraudAlert[]>([]);
  const [riskScore, setRiskScore] = useState<RiskScore | null>(null);
  const [loanDecision, setLoanDecision] = useState<LoanDecision | null>(null);
  const [newsInsights, setNewsInsights] = useState<NewsInsight[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [officerNotes, setOfficerNotes] = useState("");

  return (
    <CreditContext.Provider
      value={{
        isAnalyzed, extractionConfidence, financialData, fraudAlerts, riskScore, loanDecision, newsInsights,
        uploadedFiles, officerNotes,
        setFinancialData, setFraudAlerts, setRiskScore, setLoanDecision, setNewsInsights,
        setUploadedFiles, setOfficerNotes, setIsAnalyzed, setExtractionConfidence,
      }}
    >
      {children}
    </CreditContext.Provider>
  );
}

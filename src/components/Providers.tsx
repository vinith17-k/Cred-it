"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CreditProvider } from "@/store/CreditContext";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient());

    return (
        <QueryClientProvider client={queryClient}>
            <TooltipProvider>
                <CreditProvider>
                    {children}
                </CreditProvider>
            </TooltipProvider>
        </QueryClientProvider>
    );
}

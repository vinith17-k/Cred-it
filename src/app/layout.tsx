import "../index.css";
import { Providers } from "@/components/Providers";
import { AppLayout } from "@/components/AppLayout";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

export const metadata = {
    title: "Credit Insight AI",
    description: "AI-Powered Credit Analysis & Fraud Detection",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body>
                <Providers>
                    <AppLayout>
                        {children}
                    </AppLayout>
                    <Toaster />
                    <Sonner />
                </Providers>
            </body>
        </html>
    );
}

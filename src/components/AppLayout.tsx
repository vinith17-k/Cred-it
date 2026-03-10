"use client";

import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Search, Bell, User } from "lucide-react";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 flex items-center border-b border-border/50 bg-card/80 backdrop-blur-sm px-6 sticky top-0 z-30">
            <SidebarTrigger className="mr-4" />
            <div className="flex-1 flex items-center gap-4">
              <h2 className="text-sm font-semibold text-foreground hidden md:block">IntelliCredit AI</h2>
              <span className="text-xs text-muted-foreground hidden md:block">Digital Credit Manager</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="pl-9 pr-4 py-2 text-sm bg-muted/50 border border-border/50 rounded-xl w-64 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all placeholder:text-muted-foreground"
                />
              </div>
              <button className="relative p-2.5 rounded-xl hover:bg-muted/60 transition-colors">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive" />
              </button>
              <div className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground text-sm font-semibold cursor-pointer hover:opacity-90 transition-opacity">
                CO
              </div>
            </div>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

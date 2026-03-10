"use client";

import {
  LayoutDashboard,
  Upload,
  BarChart3,
  ShieldAlert,
  FileText,
  Home,
  Menu,
} from "lucide-react";
import { useState } from "react";
import { NavLink } from "@/components/NavLink";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Upload Documents", url: "/upload", icon: Upload },
  { title: "Credit Analysis", url: "/analysis", icon: BarChart3 },
  { title: "Risk Dashboard", url: "/risk", icon: ShieldAlert },
  { title: "CAM Report", url: "/cam", icon: FileText },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50 bg-card">
      <SidebarContent className="pt-6">
        <div className={`px-4 pb-8 ${collapsed ? "px-2" : ""}`}>
          {!collapsed ? (
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl gradient-primary flex items-center justify-center shadow-soft">
                <span className="text-sm font-bold text-primary-foreground">IC</span>
              </div>
              <div>
                <h1 className="text-sm font-bold text-foreground font-display tracking-tight">IntelliCredit</h1>
                <p className="text-[10px] text-muted-foreground">AI Credit Manager</p>
              </div>
            </div>
          ) : (
            <div className="h-10 w-10 rounded-2xl gradient-primary flex items-center justify-center mx-auto shadow-soft">
              <span className="text-sm font-bold text-primary-foreground">IC</span>
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground/60 text-[10px] uppercase tracking-widest font-medium px-4">
            {!collapsed && "Navigation"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="px-2 space-y-1">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      href={item.url}
                      end={item.url === "/"}
                      className="rounded-xl px-3 py-2.5 transition-all duration-200"
                    >
                      <item.icon className="h-4 w-4 mr-3 shrink-0" />
                      {!collapsed && <span className="text-sm">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

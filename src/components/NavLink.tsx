"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavLinkProps {
  href: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  end?: boolean;
}

export function NavLink({ href, icon, children, className, end }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = end ? pathname === href : pathname.startsWith(href);

  return (
    <Button
      variant={isActive ? "secondary" : "ghost"}
      className={cn(
        "w-full justify-start",
        isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground",
        className
      )}
      asChild
    >
      <Link href={href}>
        {icon && <span className="mr-2 h-4 w-4">{icon}</span>}
        {children}
      </Link>
    </Button>
  );
}

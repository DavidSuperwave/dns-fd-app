"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useScanContext } from "./dashboard-layout";
import {
  Globe,
  Users,
  CreditCard,
  Settings,
  BookOpen,
  BarChart3,
  Calendar,
  UserCheck,
  FolderKanban,
  Mail,
  LayoutDashboard
} from "lucide-react";

interface SidebarItemProps {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  icon?: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

function SidebarItem({ href, children, active, icon, className, onClick }: SidebarItemProps) {
  const { scanInProgress } = useScanContext();

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center px-3 py-2.5 text-sm rounded-lg transition-colors group",
        active
          ? "bg-primary/10 text-primary font-medium"
          : className || "text-muted-foreground hover:bg-muted hover:text-foreground",
        "relative"
      )}
    >
      {icon && <span className="mr-3 h-5 w-5 flex-shrink-0">{icon}</span>}
      <span className="flex-1">{children}</span>
      {scanInProgress && href !== "/domains" && (
        <span
          className="ml-2 w-2 h-2 rounded-full bg-yellow-500 animate-pulse"
          title="Scan in progress"
        />
      )}
    </Link>
  );
}

interface SidebarProps {
  isAdmin?: boolean;
}

export function Sidebar({ isAdmin }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 flex h-screen w-64 flex-col border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/overview" className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="Superwave"
            width={120}
            height={24}
            className="h-6 w-auto"
          />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto space-y-1 p-4 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
        {/* User Navigation */}
        <div className="space-y-1">
          <SidebarItem
            href="/overview"
            active={pathname === "/overview"}
            icon={<LayoutDashboard />}
          >
            Overview
          </SidebarItem>

          <SidebarItem
            href="/projects"
            active={pathname?.startsWith("/projects")}
            icon={<FolderKanban />}
          >
            Projects
          </SidebarItem>

          <SidebarItem
            href="/leads"
            active={pathname === "/leads"}
            icon={<Mail />}
          >
            Leads
          </SidebarItem>

          <SidebarItem
            href="/domains"
            active={pathname === "/domains"}
            icon={<Globe />}
          >
            Domains
          </SidebarItem>

          <SidebarItem
            href="/community"
            active={pathname === "/community"}
            icon={<Users />}
          >
            Community
          </SidebarItem>

          <SidebarItem
            href="/billing"
            active={pathname === "/billing"}
            icon={<CreditCard />}
          >
            Billing
          </SidebarItem>

          <SidebarItem
            href="/settings"
            active={pathname === "/settings"}
            icon={<Settings />}
          >
            Settings
          </SidebarItem>

          <SidebarItem
            href="/manual"
            icon={<BookOpen />}
            className="text-[#4e1ddc] hover:bg-[#4e1ddc]/10"
            onClick={(e) => {
              e.preventDefault();
              window.open('/api/manual', '_blank', 'noopener,noreferrer');
            }}
          >
            Manual
          </SidebarItem>
        </div>

        {/* Admin Navigation */}
        {isAdmin && (
          <>
            <div className="my-4 border-t pt-4">
              <div className="mb-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Admin
              </div>
              <div className="space-y-1">
                <SidebarItem
                  href="/users"
                  active={pathname === "/users"}
                  icon={<UserCheck />}
                >
                  Users
                </SidebarItem>

                <SidebarItem
                  href="/cron-monitor"
                  active={pathname === "/cron-monitor"}
                  icon={<Calendar />}
                >
                  Cron Monitor
                </SidebarItem>

                <SidebarItem
                  href="/tenants"
                  active={pathname === "/tenants"}
                  icon={<Users />}
                >
                  Tenants
                </SidebarItem>

                <SidebarItem
                  href="/metrics"
                  active={pathname === "/metrics"}
                  icon={<BarChart3 />}
                >
                  Metrics
                </SidebarItem>
              </div>
            </div>
          </>
        )}
      </nav>
    </div>
  );
}

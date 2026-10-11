"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  User, 
  FileText, 
  LayoutDashboard, 
  MessageSquare,
  LogOut,
  ChevronDown
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { useAuth } from '@/shared/hooks/useAuth';
import { ThemeToggle } from './ThemeToggle';

const navTabs = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Documents", href: "/documents", icon: FileText },
  { label: "Chat History", href: "/chat", icon: MessageSquare },
];

export const DashboardHeader: React.FC = () => {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    // Mount-time load of the persisted user from localStorage.
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUser(JSON.parse(savedUser));
    }
  }, []);

  return (
      <header className="sticky top-0 z-30 flex items-center justify-between h-20 px-8 bg-background/60 backdrop-blur-xl border-b border-border shadow-sm">
      
      {/* Left: Brand Logo */}
      <Link href="/" className="flex items-center gap-2 group cursor-pointer">
        <div className="w-9 h-9 rounded-xl bg-linear-to-tr from-blue-600 to-indigo-600 flex items-center justify-center p-2 shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform duration-300">
          <FileText className="text-white w-full h-full" />
        </div>
              <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-linear-to-r from-foreground to-foreground/60 hidden sm:block">
          DocsChat.ai
        </span>
      </Link>

      {/* Center: Navigation Tabs */}
          <nav className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center p-1 rounded-2xl bg-card border gap-2 border-border shadow-sm">
        {navTabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-all duration-300",
                isActive 
                    ? "text-foreground bg-background shadow-sm"
                    : "text-foreground/50 hover:text-foreground hover:bg-background/50"
              )}
            >
                  <tab.icon className={cn("w-4 h-4", isActive ? "text-primary" : "text-foreground/40")} />
              {tab.label}
              {isActive && (
                      <div className="absolute inset-x-0 -bottom-1 h-px bg-linear-to-r from-transparent via-primary to-transparent opacity-50" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Right: Actions & Profile */}
          <div className="flex items-center gap-6">
              <ThemeToggle />

        {/* Profile Dropdown Container */}
              <div className="relative group pl-6 border-l border-border py-2">
          <div className="flex items-center gap-3 cursor-pointer group-hover:opacity-80 transition-opacity">
            <div className="text-right hidden sm:flex flex-col items-end">
                          <span className="text-sm font-semibold text-foreground tracking-tight">
                {user?.name || "User"}
              </span>
                          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-primary font-bold opacity-70">
                <span>Account</span>
                <ChevronDown className="w-2.5 h-2.5 group-hover:rotate-180 transition-transform duration-300" />
              </div>
            </div>
                      <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center shadow-sm transition-all duration-300">
                          <User className="text-foreground/60 w-5 h-5" />
            </div>
          </div>

          {/* Hover Menu */}
          <div className="absolute top-full right-0 mt-2 w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible translate-y-2 group-hover:translate-y-0 transition-all duration-300 ease-out z-50">
                      <div className="p-1.5 rounded-2xl bg-card backdrop-blur-2xl border border-border shadow-xl">
                          <div className="px-3 py-2 border-b border-border mb-1">
                              <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest mb-0.5">Signed in as</p>
                              <p className="text-xs text-foreground font-medium truncate">{user?.email || "user@example.com"}</p>
              </div>
              
              <button 
                onClick={logout}
                              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-foreground/60 hover:text-red-500 hover:bg-red-500/10 transition-all duration-200 group/btn"
              >
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center group-hover/btn:bg-red-500/20 transition-colors">
                                  <LogOut className="w-4 h-4 text-red-500" />
                </div>
                <span>Log out</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};


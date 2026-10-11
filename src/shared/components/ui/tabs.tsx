"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const Tabs = ({ className, children }: { value: string, className?: string, children: React.ReactNode }) => {
    return (
        <div className={cn("inline-flex h-12 items-center justify-center rounded-xl bg-neutral-900/50 p-1 text-neutral-400 border border-neutral-800", className)}>
            {children}
        </div>
    );
};

const TabsList = ({ className, children }: { className?: string, children: React.ReactNode }) => {
    return (
        <div className={cn("inline-flex w-full items-center justify-center", className)}>
            {children}
        </div>
    );
};

const TabsTrigger = ({ onClick, children, className }: { value: string, onClick?: () => void, children: React.ReactNode, className?: string }) => {
    return (
        <button
            onClick={onClick}
            className={cn(
                "inline-flex w-full items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ring-offset-black transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 disabled:pointer-events-none disabled:opacity-50 hover:text-white",
                className
            )}
        >
            {children}
        </button>
    );
};

export { Tabs, TabsList, TabsTrigger };

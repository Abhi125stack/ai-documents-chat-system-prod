"use client";

import React, { useState } from 'react';
import { DocumentList } from '@/shared/components/DocumentList';
import { Search } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { useDebounce } from '@/shared/hooks/useDebounce';

export default function DocumentsPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-extrabold text-foreground tracking-tight mb-2">
            My Documents
          </h1>
          <p className="text-foreground/50 font-medium text-sm">
            Manage, search, and chat with all your uploaded PDF files.
          </p>
        </div>
        
        <div className="flex-1 max-w-md w-full">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-foreground/40 group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Search documents by name..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-12 pl-12 rounded-2xl bg-card border-border focus:border-primary/50 focus:bg-background transition-all placeholder:text-foreground/30"
            />
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="bg-card/40 p-4 sm:p-8 rounded-4xl border border-border backdrop-blur-3xl h-[72vh] overflow-y-auto custom-scrollbar shadow-sm">
        <DocumentList search={debouncedSearch} />
      </div>
    </div>
  );
}

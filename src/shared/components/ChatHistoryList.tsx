"use client";

import React from 'react';
import { 
  MessageSquare, 
  Clock,
  Loader2,
  ChevronRight,
  FileText,
  AlertCircle,
  RotateCw
} from "lucide-react";
import { useChatHistory } from '@/shared/hooks/useChatHistory';
import { PopulatedChatMetadata } from "@/types";
import Link from 'next/link';

export const ChatHistoryList: React.FC = () => {
  const { chats, isLoading, isError, refetch } = useChatHistory();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-pulse">
            <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
            <p className="text-foreground/50 font-medium text-sm">Fetching your chat history...</p>
      </div>
    );
  }

  // A failed fetch must not masquerade as "no conversations yet".
  if (isError) {
    return (
      <div role="alert" className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-700">
        <div className="w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
          <AlertCircle className="w-10 h-10 text-red-500" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">Couldn&apos;t load your chat history</h3>
        <p className="text-foreground/50 max-w-sm mx-auto leading-relaxed text-sm mb-6">
          Something went wrong while fetching your conversations. Your chats are safe. Please try again.
        </p>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-background font-bold text-xs uppercase tracking-widest hover:opacity-90 transition-opacity cursor-pointer"
        >
          <RotateCw className="w-3.5 h-3.5" />
          Retry
        </button>
      </div>
    );
  }

  if (chats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-700">
            <div className="w-20 h-20 rounded-3xl bg-card border border-border flex items-center justify-center mb-6">
                <MessageSquare className="w-10 h-10 text-foreground/30" />
        </div>
            <h3 className="text-xl font-bold text-foreground mb-2">No conversations yet</h3>
            <p className="text-foreground/50 max-w-sm mx-auto leading-relaxed text-sm">
          Start a new conversation by opening any of your documents and clicking the &quot;Chat&quot; button.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-both pb-20">
      <div className="grid grid-cols-1 gap-4">
        {chats.map((chat: PopulatedChatMetadata) => {
          const isMultiDoc = chat.documentIds && chat.documentIds.length > 0;
          const href = isMultiDoc 
            ? `/doc-view/${chat.documentIds?.join(',')}` 
            : `/doc-view/${chat?.documentId?._id}`;

          return (
            <Link
              href={href}
              key={chat._id}
                  className="group relative flex items-center p-5 rounded-3xl bg-card border border-border hover:border-primary/40 hover:bg-card/80 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 cursor-pointer overflow-hidden shadow-sm"
            >
              {/* Left Icon Accent */}
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mr-5 transition-all duration-300 group-hover:scale-110 group-hover:bg-primary group-hover:shadow-lg group-hover:shadow-primary/30">
                      <MessageSquare className="w-6 h-6 text-primary group-hover:text-background transition-colors" />
              </div>

              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] uppercase font-black text-primary tracking-widest px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                    {isMultiDoc ? "MULTI-SESSION" : "AI SESSION"}
                  </span>
                          <span className="text-[10px] text-foreground/40 font-bold uppercase tracking-widest flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    {new Date(chat.createdAt).toLocaleDateString()}
                  </span>
                </div>
                
                      <h3 className="text-sm font-bold text-foreground group-hover:text-primary truncate transition-colors tracking-tight">
                  {isMultiDoc ? (
                    "Conversation on: Multiple docs"
                  ) : (
                                  <>Conversation on: <span className="text-foreground/80 font-medium">{chat?.documentId?.name || "Deleted Document"}</span></>
                  )}
                </h3>
                
                      <p className="text-xs text-foreground/50 truncate mt-1 italic">
                  {chat.messages.length > 0 ? `"${chat.messages[chat.messages.length - 1].content.substring(0, 100)}..."` : "No messages yet"}
                </p>
              </div>

              <div className="flex items-center gap-4">
                 <div className="hidden sm:flex flex-col items-end text-right">
                          <span className="text-[10px] text-foreground/40 font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {isMultiDoc ? "Collective Context" : "Source Asset"}
                    </span>
                          <span className="text-[10px] text-foreground/60 font-medium truncate max-w-30">
                      {isMultiDoc ? `${chat.documentIds?.length} Assets` : (chat?.documentId?.name || "Unknown")}
                    </span>
                 </div>
                      <ChevronRight className="w-5 h-5 text-foreground/30 group-hover:text-primary transition-all transform group-hover:translate-x-1" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

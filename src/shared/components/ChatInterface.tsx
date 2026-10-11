"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import { Message, ChatMetadata, DocumentMetadata } from "@/types";
import { Loader2, Send, Cpu, Sparkles, Copy, Check } from "lucide-react";
import { motion, AnimatePresence, Variants } from "framer-motion";

interface ChatInterfaceProps {
    docIds: string[];
    onAnalyzeTrigger?: (ref: { analyze: (doc?: DocumentMetadata) => void }) => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ docIds, onAnalyzeTrigger }) => {
    const [input, setInput] = useState("");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [localMessages, setLocalMessages] = useState<Message[]>([]);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const queryClient = useQueryClient();

    const idsKey = [...docIds].sort().join(",");

    const { data, isLoading: isChatLoading } = useQuery<{ chat: ChatMetadata }>({
        queryKey: ["chat", idsKey],
        queryFn: async () => {
            const res = await api.get(`/chats?ids=${idsKey}`);
            return res.data;
        },
    });

    useEffect(() => {
        if (data?.chat?.messages) {
            // Sync server-fetched messages into local state when the query resolves.
            setLocalMessages(data.chat.messages);
        }
    }, [data?.chat?.messages]);

    const mutation = useMutation({
        mutationFn: async (vars: { content: string; mode?: "qa" | "summary" }) => {
            setErrorMsg(null);
            const res = await api.post("/chats/message", {
                docIds,
                content: vars.content,
                mode: vars.mode ?? "qa",
            });
            return res.data;
        },
        onMutate: async (vars) => {
            // A summary action has no user-authored message to echo optimistically.
            if (vars.mode === "summary") return null;

            const optimisticMsg: Message = {
                role: "user",
                content: vars.content,
                createdAt: new Date().toISOString(),
            };
            setLocalMessages(prev => [...prev, optimisticMsg]);
            return { optimisticMsg };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["chat", idsKey] });
            setInput("");
        },
        onError: (err: { response?: { data?: { message?: string } }; message?: string }, _vars, context) => {
            const apiError = err.response?.data?.message || err.message || "Failed to connect to AI Core.";
            setErrorMsg(apiError);
            if (context?.optimisticMsg) {
                setLocalMessages(prev => prev.filter(m => m !== context.optimisticMsg));
            }
        }
    });

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [localMessages, mutation.isPending]);

    useEffect(() => {
        if (onAnalyzeTrigger) {
            onAnalyzeTrigger({
                analyze: () => {
                    // Summary mode: the content is a plain instruction (no filename,
                    // no [SYSTEM_ACTION] marker) so it never poisons retrieval, and
                    // the server selects representative chunks instead of ranking
                    // against this string.
                    mutation.mutate({
                        content: "Provide a concise ~200-word summary of this document.",
                        mode: "summary",
                    });
                }
            });
        }
        // `mutation` is intentionally omitted: re-registering the trigger on every
        // mutation state change would thrash the parent callback. idsKey is the real key.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onAnalyzeTrigger, idsKey]);

    const handleSend = () => {
        if (!input.trim() || mutation.isPending) return;
        mutation.mutate({ content: input, mode: "qa" });
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleCopy = (content: string, id: string) => {
        navigator.clipboard.writeText(content);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const messageVariants: Variants = {
        initial: { opacity: 0, y: 30, scale: 0.95 },
        animate: { 
            opacity: 1, 
            y: 0, 
            scale: 1,
            transition: { 
                type: "spring", 
                stiffness: 300, 
                damping: 24,
                duration: 0.4 
            }
        },
        exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } }
    };

    return (
        <div className="w-full flex flex-col h-full bg-card border border-border rounded-[2.5rem] overflow-hidden backdrop-blur-3xl shadow-2xl relative">
            <div className="px-6 py-5 border-b border-border bg-card/80 backdrop-blur-xl flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner">
                            <Cpu className="w-5 h-5 text-primary" />
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-card rounded-full flex items-center justify-center border border-border">
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.8)] animate-pulse" />
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <h3 className="text-[12px] font-black text-foreground uppercase tracking-[0.2em]">DOC.AI Intelligence</h3>
                            <div className="px-1.5 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                                <span className="font-black text-primary tracking-widest text-[10px]">Active</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar relative">
                <AnimatePresence mode="popLayout" initial={false}>
                    {isChatLoading && localMessages.length === 0 ? (
                        <motion.div 
                            key="loader"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center justify-center h-full"
                        >
                            <div className="relative w-16 h-16">
                                <div className="absolute inset-0 rounded-full border-2 border-primary/10" />
                                <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin" />
                                <Cpu className="absolute inset-0 m-auto w-6 h-6 text-primary animate-pulse" />
                            </div>
                        </motion.div>
                    ) : (
                        <>
                            {localMessages.map((msg, idx) => (
                                <motion.div 
                                    key={msg.id || `msg-${idx}-${msg.createdAt}`}
                                    variants={messageVariants}
                                    initial="initial"
                                    animate="animate"
                                    exit="exit"
                                    layout
                                    className={`flex flex-col gap-2 max-w-[85%] ${msg.role === "user" ? "ml-auto" : ""}`}
                                >
                                    <div className={`px-5 py-4 border text-[14px] leading-[1.6] transition-all relative overflow-hidden group/msg ${
                                        msg.role === "user" 
                                        ? "bg-primary border-primary/30 rounded-4xl rounded-tr-none text-background ml-auto shadow-lg"
                                        : "bg-background border-border rounded-4xl rounded-tl-none text-foreground/90 shadow-sm"
                                    }`}>
                                        <p className="relative z-10 font-medium whitespace-pre-wrap">{msg.content}</p>
                                    </div>
                                    <div className={`flex items-center gap-2 px-2 ${msg.role === "user" ? "justify-end" : ""}`}>
                                        <span className="text-[10px] text-foreground/40 font-black uppercase tracking-widest opacity-80">
                                            {msg.role === "user" ? "USER" : "DOC.AI"} • {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        {msg.role === "assistant" && (
                                            <button 
                                                onClick={() => handleCopy(msg.content, msg.id || `msg-${idx}`)}
                                                className="p-1.5 hover:bg-foreground/5 rounded-lg transition-colors group/copy"
                                                title="Copy to clipboard"
                                            >
                                                {copiedId === (msg.id || `msg-${idx}`) ? (
                                                    <Check className="w-3 h-3 text-green-500" />
                                                ) : (
                                                        <Copy className="w-3 h-3 text-foreground/30 group-hover/copy:text-primary transition-colors" />
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                            
                            {mutation.isPending && (
                                <motion.div 
                                    key="thinking"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="flex flex-col gap-3 max-w-[85%]"
                                >
                                        <div className="px-5 py-4 bg-background/50 border border-primary/20 rounded-4xl rounded-tl-none text-sm text-foreground/70 backdrop-blur-sm relative overflow-hidden shadow-sm">
                                            <div className="absolute inset-0 bg-primary/5 animate-pulse" />
                                        <div className="flex items-center gap-3 relative z-10">
                                            <div className="flex gap-1.5 items-center">
                                                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                                                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                                                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                                            </div>
                                                <div className="h-4 w-px bg-border" />
                                            <div className="flex items-center gap-1.5 overflow-hidden">
                                                    <Sparkles className="w-3.5 h-3.5 text-primary rotate-animation" />
                                                    <span className="text-[11px] font-black text-primary/80 uppercase tracking-widest whitespace-nowrap animate-pulse">Processing...</span>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </>
                    )}
                </AnimatePresence>
                <div ref={messagesEndRef} />
                {errorMsg && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col gap-2 max-w-[90%] mx-auto sticky bottom-4 z-20"
                    >
                        <div className="px-6 py-4 bg-red-500/10 border border-red-500/20 rounded-3xl text-[12px] text-red-500 font-bold text-center backdrop-blur-md shadow-xl relative overflow-hidden">
                            <div className="absolute inset-0 bg-red-500/5 animate-pulse" />
                            <div className="relative z-10">
                                CORE ERROR: {errorMsg}
                            </div>
                        </div>
                        <button 
                            onClick={() => setErrorMsg(null)}
                            className="text-[10px] text-foreground/40 hover:text-foreground uppercase font-black tracking-widest transition-all mx-auto pb-2"
                        >
                            [ Clear Exception ]
                        </button>
                    </motion.div>
                )}
            </div>

            <div className="px-3 py-3 border-t border-border bg-card/90 backdrop-blur-2xl relative">
                <div className="relative group max-w-4xl mx-auto">
                    <div className={mutation.isPending ? "opacity-50 pointer-events-none" : "opacity-100"}>
                        <textarea 
                            rows={1}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyPress}
                            placeholder="Ask DOC.AI..."
                            className="w-full bg-background border border-border rounded-3xl px-7 py-5 text-[15px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-foreground/30 shadow-inner resize-none pr-28 custom-scrollbar font-medium"
                        />
                    </div>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <motion.button 
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleSend}
                            disabled={!input.trim() || mutation.isPending}
                            className="h-12 px-6 bg-primary hover:opacity-90 disabled:opacity-20 text-background text-[11px] font-black rounded-2xl transition-all shadow-md flex items-center justify-center gap-3 group/btn border border-primary/20"
                        >
                            {mutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin text-background" />
                            ) : (
                                <>
                                    SEND <Send className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
                                </>
                            )}
                        </motion.button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(var(--foreground), 0.05);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(var(--primary), 0.2);
                }
                @keyframes rotate-animation {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .rotate-animation {
                    animation: rotate-animation 4s linear infinite;
                }
            `}</style>
        </div>
    );
};

"use client";

import React, { use, Suspense } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";
import { Loader2, Info, Activity } from "lucide-react";
import Link from "next/link";
import { DocumentMetadata } from "@/types";
import { ErrorBoundary } from "@/shared/components/ui/ErrorBoundary";

// Lazy-loaded components - Skeletons are now rendered in the main flow for better SI/LCP
const PDFViewer = dynamic(() => import("@/shared/components/PDFViewer").then(mod => mod.PDFViewer), {
    ssr: false
});

const ChatInterface = dynamic(() => import("@/shared/components/ChatInterface").then(mod => mod.ChatInterface), {
    ssr: false
});

// Extracted Skeletons for High Performance First Paint
const ViewerSkeleton = () => (
    <div className="h-full w-full bg-card animate-pulse rounded-[2.5rem] border border-border flex flex-col items-center justify-center gap-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(var(--primary),0.1)_0%,transparent_100%)] animate-pulse" />
        <div className="w-24 h-24 bg-primary/10 rounded-full border border-primary/20 flex items-center justify-center relative shadow-xl">
            <div className="absolute inset-0 bg-primary/30 blur-3xl animate-pulse rounded-full" />
            <Activity className="w-10 h-10 text-primary animate-spin-slow" />
        </div>
        <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Module Activation</span>
            <span className="text-foreground/40 text-xs font-mono">Initializing PDF Engine...</span>
        </div>
    </div>
);

const ChatSkeleton = () => (
    <div className="h-full w-full bg-card animate-pulse rounded-[2.5rem] border border-border flex flex-col p-8 gap-10">
        <div className="flex items-center gap-4 border-b border-border pb-6">
            <div className="w-12 h-12 rounded-2xl bg-card/60" />
            <div className="flex-1 space-y-2">
                <div className="w-24 h-3 bg-card/60 rounded-full" />
                <div className="w-16 h-2 bg-card/60 rounded-full" />
            </div>
        </div>
        <div className="flex-1 flex flex-col gap-6">
            <div className="self-start w-48 h-12 bg-card/60 rounded-2xl rounded-tl-none" />
            <div className="self-end w-32 h-10 bg-primary/10 rounded-2xl rounded-tr-none" />
            <div className="self-start w-56 h-16 bg-card/60 rounded-2xl rounded-tl-none" />
        </div>
        <div className="w-full h-16 bg-card/60 rounded-3xl" />
    </div>
);

interface DocumentResponse {
    success: boolean;
    message: string;
    document?: DocumentMetadata;
    documents?: DocumentMetadata[];
}

export default function DocumentViewPage({ params }: { params: Promise<{ docId: string }> }) {
    const { docId: rawDocId } = use(params);
    const decodedDocId = decodeURIComponent(rawDocId);
    const idArray = decodedDocId.split(/,|%2C/).filter(id => id.trim() !== "");
    const [activeDocIndex, setActiveDocIndex] = React.useState(0);
    const analyzeRef = React.useRef<{ analyze: (doc?: DocumentMetadata) => void }>(null);

    const { data, isLoading, error } = useQuery<DocumentResponse>({
        queryKey: ["documents", decodedDocId],
        queryFn: async () => {
            const res = await api.get(`/documents/${decodedDocId}`);
            return res.data;
        },
    });

    const docs = data?.documents || (data?.document ? [data.document] : []);
    const currentDoc = docs[activeDocIndex] || docs[0];
    const fileUrl = currentDoc ? `/api/documents/${currentDoc._id}/file` : "";
    const idArrayForChat = idArray.length > 0 ? idArray : (currentDoc ? [currentDoc._id] : []);
    const hasError = error || (data && !data.success);

    return (
        <div className="w-[95%] mx-auto h-screen min-h-screen flex flex-col p-4 gap-4 overflow-hidden relative">
            {/* Header for multi-doc navigation - Permanent space but skeletons if loading */}
            <div className={`flex items-center gap-4 bg-card/80 backdrop-blur-xl p-3 rounded-2xl border border-border min-h-16 overflow-x-auto no-scrollbar shadow-xl relative z-20 ${isLoading ? "animate-pulse" : ""}`}>
                {isLoading ? (
                    <div className="flex gap-4">
                        <div className="w-32 h-10 bg-card rounded-xl border border-border" />
                        <div className="w-40 h-10 bg-card rounded-xl border border-border" />
                    </div>
                ) : docs.length > 1 ? (
                    docs.map((doc, idx) => (
                        <button
                            key={doc._id}
                            onClick={() => setActiveDocIndex(idx)}
                            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap uppercase tracking-widest border ${
                                activeDocIndex === idx
                                ? "bg-primary border-primary text-background shadow-lg shadow-primary/20 scale-105"
                                : "bg-background border-border text-foreground/50 hover:text-foreground hover:bg-card hover:cursor-pointer"
                            }`}
                        >
                            {doc.name}
                        </button>
                    ))
                ) : (
                    <div className="px-4 py-2 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Activity className="w-4 h-4 text-primary" />
                        </div>
                        <span className="text-xs font-bold text-foreground/70 uppercase tracking-widest">
                            {docs[0]?.name || (hasError ? "Retrieval Failed" : "Awaiting Data Cluster...")}
                        </span>
                    </div>
                )}
            </div>

            {/* Main Layout Grid */}
            <div className="flex-1 flex gap-4 min-h-0">
                {/* Document Viewer (70%) */}
                <div className="w-[70%] flex flex-col h-full overflow-hidden">
                    <ErrorBoundary>
                        {hasError ? (
                            <div className="flex flex-col items-center justify-center h-full gap-6 text-center p-8 bg-card border border-border rounded-[2.5rem] relative overflow-hidden">
                                <div className="absolute inset-0 bg-red-500/5" />
                                <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center relative z-10">
                                    <Info className="w-8 h-8 text-red-500" />
                                </div>
                                <div className="relative z-10">
                                    <h2 className="text-xl font-bold text-foreground mb-2">Retrieval Failed</h2>
                                    <p className="text-foreground/40 text-sm max-w-xs mx-auto">Neural linkage timed out. Asset cluster may be offline or restricted.</p>
                                </div>
                                <Link
                                    href="/dashboard"
                                    className="px-6 py-2 bg-background hover:bg-card border border-border rounded-xl text-foreground font-medium transition-all text-xs uppercase tracking-widest relative z-10"
                                >
                                    Back to Archive
                                </Link>
                            </div>
                        ) : (!currentDoc || isLoading) ? (
                            <ViewerSkeleton />
                        ) : currentDoc.status === 'processed' || currentDoc.status === 'error' ? (
                            <Suspense fallback={<ViewerSkeleton />}>
                                <PDFViewer
                                    fileUrl={fileUrl}
                                    docName={currentDoc.name}
                                    docDetails={currentDoc}
                                    onAnalyze={(info) => analyzeRef.current?.analyze(info)}
                                />
                                    </Suspense>
                        ) : (
                                        <div className="h-full bg-card border border-border rounded-[2.5rem] flex flex-col items-center justify-center gap-6 text-center p-8 backdrop-blur-3xl relative overflow-hidden">
                                            <div className="absolute inset-0 bg-linear-to-br from-primary/5 to-transparent" />
                                <div className="relative">
                                                <div className="absolute inset-0 bg-primary/20 blur-3xl animate-pulse rounded-full" />
                                                <Loader2 className="w-16 h-16 text-primary animate-spin relative z-10" />
                                </div>
                                <div className="space-y-2">
                                                <h3 className="text-2xl font-black text-foreground uppercase tracking-tighter">Neural Synthesis...</h3>
                                                <p className="text-foreground/50 font-medium text-sm tracking-tight">Indexing &quot;{currentDoc.name}&quot; into Collective Memory.</p>
                                </div>
                            </div>
                        )}
                    </ErrorBoundary>
                </div>

                <div className="w-[30%] flex flex-col h-full overflow-hidden">
                    <ErrorBoundary>
                        {isLoading ? (
                            <ChatSkeleton />
                        ) : (
                            <Suspense fallback={<ChatSkeleton />}>
                                    <ChatInterface 
                                        docIds={idArrayForChat}
                                        onAnalyzeTrigger={(ref) => { analyzeRef.current = ref; }}
                                    />
                            </Suspense>
                        )}
                    </ErrorBoundary>
                </div>
            </div>

            <style jsx global>{`
                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin-slow {
                    animation: spin-slow 8s linear infinite;
                }
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    );
}

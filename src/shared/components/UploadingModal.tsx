"use client";

import React, { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CloudUpload, Activity, Loader2 } from "lucide-react";
import { useModalA11y } from "@/shared/hooks/useModalA11y";

interface UploadingModalProps {
    isOpen: boolean;
    progress: number;
    fileName?: string;
    fileCount: number;
}

export const UploadingModal: React.FC<UploadingModalProps> = ({ isOpen, progress, fileCount }) => {
    // No onClose: an in-flight upload must not be dismissible (would hide progress).
    // The hook still keeps focus inside the dialog while it is open.
    const dialogRef = useRef<HTMLDivElement>(null);
    useModalA11y(dialogRef, isOpen);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/80 backdrop-blur-md"
                />

                {/* Modal Container */}
                <motion.div 
                    ref={dialogRef}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="uploading-title"
                    aria-busy="true"
                    tabIndex={-1}
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="relative w-full max-w-md bg-card border border-border rounded-[2.5rem] shadow-2xl overflow-hidden p-8 outline-none"
                >
                    {/* Visual Accent */}
                    <div className="absolute inset-0 bg-linear-to-tr from-primary/10 to-transparent pointer-events-none" />

                    <div className="relative z-10 flex flex-col items-center">
                        <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center border border-primary/20 mb-6">
                            <CloudUpload className="w-10 h-10 text-primary animate-bounce" />
                        </div>

                        <div className="text-center space-y-2 mb-8">
                            <h3 id="uploading-title" className="text-2xl font-black text-foreground uppercase tracking-tighter">Uploading Assets</h3>
                            <div className="flex flex-col gap-1 items-center justify-center">
                                <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em] flex items-center gap-2">
                                    <Activity className="w-3 h-3" /> Neural Linking active
                                </span>
                                <p className="text-xs text-foreground/40 font-bold max-w-60 truncate">
                                    Processing {fileCount} document{fileCount > 1 ? 's' : ''}
                                </p>
                            </div>
                        </div>

                        {/* Progress Section */}
                        <div className="w-full space-y-4">
                            <div className="flex items-center justify-between px-2">
                                <span className="text-[10px] font-black text-foreground/40 uppercase tracking-widest">Progress</span>
                                <span className="text-lg font-black text-foreground">{progress}%</span>
                            </div>

                            <div
                                role="progressbar"
                                aria-label="Upload progress"
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={progress}
                                className="h-4 w-full bg-background/50 rounded-2xl overflow-hidden border border-border p-1"
                            >
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                    transition={{ type: "spring", stiffness: 100, damping: 20 }}
                                    className="h-full bg-linear-to-r from-blue-600 via-blue-400 to-indigo-600 rounded-xl relative shadow-lg shadow-primary/20"
                                >
                                    <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-size-[20px_20px] animate-[progress-shine_1s_linear_infinite]" />
                                </motion.div>
                            </div>

                            <div className="flex items-center justify-center gap-3 py-2">
                                <Loader2 className="w-4 h-4 text-primary animate-spin" />
                                <span className="text-[10px] font-black text-foreground/40 uppercase tracking-widest animate-pulse">Syncing with Cloud Vault...</span>
                            </div>
                        </div>
                    </div>
                </motion.div>
                
                <style jsx>{`
                    @keyframes progress-shine {
                        0% { background-position: 0 0; }
                        100% { background-position: 40px 0; }
                    }
                `}</style>
            </div>
        </AnimatePresence>
    );
};

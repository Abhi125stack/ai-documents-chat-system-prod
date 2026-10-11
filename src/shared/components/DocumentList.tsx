"use client";

import React from 'react';
import { 
  FileText, 
  Clock,
  Loader2,
  Inbox,
  Trash2,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDocuments } from '@/shared/hooks/useDocuments';
import { useModalA11y } from '@/shared/hooks/useModalA11y';
import { DocumentListProps, DocumentMetadata } from "@/types";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

export const DocumentList: React.FC<DocumentListProps> = ({ search }) => {
  const router = useRouter();
  const {
    documents,
    isLoading,
    deleteDocument,
    isDeleting,
    deleteDocuments,
    isDeletingMultiple
  } = useDocuments(search);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = React.useState(false);

  // Escape closes, focus is trapped in the dialog. Closing is blocked while a
  // delete is in flight, matching the existing backdrop-click behaviour.
  const deleteDialogRef = React.useRef<HTMLDivElement>(null);
  const bulkDialogRef = React.useRef<HTMLDivElement>(null);
  useModalA11y(deleteDialogRef, !!deletingId, () => { if (!isDeleting) setDeletingId(null); });
  useModalA11y(bulkDialogRef, isBulkDeleting, () => { if (!isDeletingMultiple) setIsBulkDeleting(false); });

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const toggleSelect = (docId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedIds(prev =>
      prev.includes(docId)
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

  const clearSelection = () => setSelectedIds([]);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDeletingId(id);
  };

  const confirmDelete = () => {
    if (deletingId) {
      deleteDocument(deletingId, {
        onSuccess: () => {
          setDeletingId(null);
          setSelectedIds(prev => prev.filter(id => id !== deletingId));
        }
      });
    }
  };

  const confirmBulkDelete = () => {
    if (selectedIds.length > 0) {
      deleteDocuments(selectedIds, {
        onSuccess: () => {
          setSelectedIds([]);
          setIsBulkDeleting(false);
        }
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-pulse">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-foreground/50 font-medium text-sm">Fetching your documents...</p>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-700">
        <div className="w-20 h-20 rounded-3xl bg-card border border-border flex items-center justify-center mb-6">
          <Inbox className="w-10 h-10 text-foreground/30" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">
          {search ? "No results found" : "No documents found"}
        </h3>
        <p className="text-foreground/50 max-w-sm mx-auto leading-relaxed text-sm">
          {search
            ? `We couldn't find any documents matching "${search}". Try a different keyword.`
            : "You haven't uploaded any documents yet. Start by dropping a PDF in the upload zone above."
          }
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-both pb-20">

      {/* Bulk Actions Toolbar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex items-center justify-between p-4 rounded-2xl bg-primary/10 border border-primary/20 backdrop-blur-xl"
          >
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary font-bold text-xs uppercase tracking-widest">
                {selectedIds.length} SELECTED
              </div>
              <button
                onClick={clearSelection}
                className="text-foreground/40 hover:text-foreground transition-colors cursor-pointer"
                title="Clear selection"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsBulkDeleting(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all font-bold text-xs uppercase tracking-widest cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Selected
              </button>
              <Link
                href={`/doc-view/${selectedIds.join(',')}`}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:opacity-90 text-background transition-all font-bold text-xs uppercase tracking-widest shadow-lg shadow-primary/20"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Selected Docs Chat
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {documents.map((doc: DocumentMetadata) => {
          const isSelected = selectedIds.includes(doc._id);
          return (
            <div
              key={doc._id}
              onClick={() => router.push(`/doc-view/${doc._id}`)}
              className={cn(
                "group relative flex flex-col p-6 rounded-4xl border transition-all duration-300 overflow-hidden cursor-pointer",
                isSelected
                  ? "bg-primary/10 border-primary shadow-lg shadow-primary/10 scale-[1.02]"
                  : "bg-card border-border hover:border-primary/40 hover:bg-card/80"
              )}
            >
              {/* Checkbox Icon */}
              <div
                className="absolute top-4 right-4 animate-in fade-in duration-500 z-10 cursor-pointer"
                onClick={(e) => toggleSelect(doc._id, e)}
              >
                {isSelected ? (
                  <CheckCircle2 className="w-6 h-6 text-primary fill-primary/20 transition-all scale-110" />
                ) : (
                    <div className="w-6 h-6 rounded-full border-2 border-border group-hover:border-primary/40 transition-colors bg-background" />
                )}
              </div>

              {/* Status Badge (Overlayed on non-selected) */}
              {!isSelected && doc.status === 'processing' && (
                <div className="absolute top-4 right-12">
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-[10px] font-bold text-blue-400 border border-blue-500/10 uppercase tracking-widest animate-pulse">
                    Processing
                  </span>
                </div>
              )}

              {/* File Icon Accent */}
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center mb-6 transition-all duration-300",
                isSelected ? "bg-primary scale-110 shadow-primary/30" : "bg-primary/10 group-hover:scale-110 group-hover:bg-primary group-hover:shadow-primary/30"
              )}>
                <FileText className={cn("w-6 h-6 transition-colors", isSelected ? "text-background" : "text-primary group-hover:text-background")} />
              </div>

              <div className="space-y-1 mb-6">
                <h3 className={cn(
                  "text-sm font-bold truncate transition-colors pr-8 tracking-tight",
                  isSelected ? "text-primary" : "text-foreground group-hover:text-primary"
                )}>
                  {doc.name}
                </h3>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-foreground/40 font-bold">
                  <span>{formatBytes(doc.size)}</span>
                  <span className="w-1 h-1 rounded-full bg-border" />
                  <span>{doc.pages || 0} Pages</span>
                </div>
              </div>

              <div className="mt-auto flex items-center justify-between pt-4 border-t border-border/50">
                <Link
                  href={`/doc-view/${doc._id}`}
                  className="text-[10px] text-foreground/40 font-bold tracking-tight flex items-center gap-1.5 hover:text-primary transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(doc.createdAt).toLocaleDateString()}
                </Link>

                <button
                  onClick={(e) => handleDelete(e, doc._id as string)}
                  className="p-2 rounded-xl text-foreground/40 hover:text-red-400 hover:bg-red-400/10 transition-all border border-transparent hover:border-red-400/20 cursor-pointer"
                  title="Delete Document"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Single Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => !isDeleting && setDeletingId(null)} />
          <div
            ref={deleteDialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-doc-title"
            aria-describedby="delete-doc-desc"
            tabIndex={-1}
            className="relative w-full max-w-md p-8 rounded-4xl bg-card border border-border shadow-2xl animate-in zoom-in-95 duration-300 outline-none"
          >
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-6 mx-auto">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h3 id="delete-doc-title" className="text-xl font-bold text-foreground text-center mb-2">Delete Document?</h3>
            <p id="delete-doc-desc" className="text-foreground/50 text-center mb-8 leading-relaxed text-sm">
              Are you sure to delete this document? This action cannot be undone and will permanently remove all associated data.
            </p>
            <div className="flex gap-4">
              <button
                disabled={isDeleting}
                onClick={() => setDeletingId(null)}
                className="flex-1 h-12 rounded-2xl border border-border text-foreground font-bold hover:bg-card transition-all text-xs uppercase tracking-widest cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={isDeleting}
                onClick={confirmDelete}
                className="flex-1 h-12 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold shadow-xl shadow-red-600/20 transition-all active:scale-95 text-xs uppercase tracking-widest cursor-pointer flex items-center justify-center gap-2 disabled:opacity-80"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Modal */}
      {isBulkDeleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => !isDeletingMultiple && setIsBulkDeleting(false)} />
          <div
            ref={bulkDialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="bulk-delete-title"
            aria-describedby="bulk-delete-desc"
            tabIndex={-1}
            className="relative w-full max-w-md p-8 rounded-4xl bg-card border border-border shadow-2xl animate-in zoom-in-95 duration-300 outline-none"
          >
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-6 mx-auto">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h3 id="bulk-delete-title" className="text-xl font-bold text-foreground text-center mb-2">Delete {selectedIds.length} Documents?</h3>
            <p id="bulk-delete-desc" className="text-foreground/50 text-center mb-8 leading-relaxed text-sm">
              Are you sure you want to delete all {selectedIds.length} selected documents? This will permanently remove them and all their chat history.
            </p>
            <div className="flex gap-4">
              <button
                disabled={isDeletingMultiple}
                onClick={() => setIsBulkDeleting(false)}
                className="flex-1 h-12 rounded-2xl border border-border text-foreground font-bold hover:bg-card transition-all text-xs uppercase tracking-widest cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={isDeletingMultiple}
                onClick={confirmBulkDelete}
                className="flex-1 h-12 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold shadow-xl shadow-red-600/20 transition-all active:scale-95 text-xs uppercase tracking-widest cursor-pointer flex items-center justify-center gap-2 disabled:opacity-80"
              >
                {isDeletingMultiple ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Bulk Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

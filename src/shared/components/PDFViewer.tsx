"use client";

import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Loader2, ZoomIn, ZoomOut, ArrowLeft, Layers } from "lucide-react";
import { useRouter } from "next/navigation";
import { VariableSizeList } from "react-window";
import { AutoSizer } from "react-virtualized-auto-sizer";
import { DocumentMetadata } from "@/types";

// Use CDNs for worker as it's hard to configure with Next.js/Webpack easily.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
    fileUrl: string;
    docName?: string;
    onAnalyze?: (doc?: DocumentMetadata) => void;
    docDetails?: DocumentMetadata;
}

// Single Page Component for the Main Viewer
const PageRenderer = ({ 
    index, 
    style, 
    data 
}: { 
    index: number; 
    style: React.CSSProperties; 
    data: { 
        pdf: pdfjsLib.PDFDocumentProxy; 
        zoom: number;
        setPageNumber: (num: number) => void;
    } 
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
    const pageNumber = index + 1;
    const { pdf, zoom } = data;

    useEffect(() => {
        let isMounted = true;

        const renderPage = async () => {
            if (!canvasRef.current || !pdf) return;

            try {
                const page = await pdf.getPage(pageNumber);
                const viewport = page.getViewport({ scale: zoom });
                const canvas = canvasRef.current;
                const context = canvas.getContext("2d", { alpha: false });

                if (!context || !isMounted) return;

                // Clear and set dimensions
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                const renderContext = {
                    canvasContext: context,
                    viewport: viewport,
                    canvas: canvas,
                };

                if (renderTaskRef.current) {
                    renderTaskRef.current.cancel();
                }

                const renderTask = page.render(renderContext);
                renderTaskRef.current = renderTask;

                await renderTask.promise;
                renderTaskRef.current = null;
            } catch (error: unknown) {
                const err = error as { name?: string };
                if (err.name !== "RenderingCancelledException") {
                    console.error("Error rendering page:", error);
                }
            }
        };

        renderPage();

        return () => {
            isMounted = false;
            if (renderTaskRef.current) {
                renderTaskRef.current.cancel();
            }
        };
    }, [pdf, pageNumber, zoom]);

    return (
        <div style={style} className="p-4 flex">
            <div className="relative shadow-2xl rounded-lg border border-white/10 bg-[#111] transition-shadow duration-300 mx-auto h-fit">
                <canvas ref={canvasRef} className="block h-auto" />
                <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-md px-2 py-1 rounded text-[10px] text-white font-bold border border-white/10 pointer-events-none select-none">
                    PAGE {pageNumber}
                </div>
            </div>
        </div>
    );
};

// Thumbnail Component
const ThumbnailRenderer = ({ 
    index, 
    style, 
    data 
}: { 
    index: number; 
    style: React.CSSProperties; 
    data: { 
        pdf: pdfjsLib.PDFDocumentProxy; 
        currentPage: number;
        scrollToPage: (index: number) => void;
    } 
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const pageNumber = index + 1;
    const { pdf, currentPage, scrollToPage } = data;
    const isActive = currentPage === pageNumber;

    useEffect(() => {
        let isMounted = true;
        const renderThumbnail = async () => {
            if (!canvasRef.current || !pdf) return;

            try {
                const page = await pdf.getPage(pageNumber);
                const viewport = page.getViewport({ scale: 0.2 }); // Small scale for thumbnail
                const canvas = canvasRef.current;
                const context = canvas.getContext("2d", { alpha: false });

                if (!context || !isMounted) return;

                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({
                    canvasContext: context,
                    viewport: viewport,
                    canvas: canvas,
                }).promise;
            } catch (error) {
                console.error("Error rendering thumbnail:", error);
            }
        };

        renderThumbnail();
        return () => { isMounted = false; };
    }, [pdf, pageNumber]);

    return (
        <div 
            style={style} 
            className="p-2 px-4"
            onClick={() => scrollToPage(index)}
        >
            <div className={`cursor-pointer transition-all duration-300 rounded-lg overflow-hidden border-2 ${
                isActive ? "border-blue-500 shadow-lg shadow-blue-500/20 scale-105" : "border-white/5 hover:border-white/20"
            }`}>
                <canvas ref={canvasRef} className="w-full h-auto" />
                <div className={`text-[9px] text-center py-1 font-bold tracking-tighter ${
                    isActive ? "bg-blue-600 text-white" : "bg-white/5 text-gray-500"
                }`}>
                    P. {pageNumber}
                </div>
            </div>
        </div>
    );
};

export const PDFViewer: React.FC<PDFViewerProps> = ({ fileUrl, docName, onAnalyze, docDetails }) => {
    const router = useRouter();
    const listRef = useRef<VariableSizeList>(null);
    const thumbListRef = useRef<VariableSizeList>(null);
    
    const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [zoom, setZoom] = useState(1.5);
    const [isLoading, setIsLoading] = useState(true);
    const [numPages, setNumPages] = useState(0);
    const [pageHeights, setPageHeights] = useState<number[]>([]);
    const [pageRatios, setPageRatios] = useState<number[]>([]);
    const [jumpValue, setJumpValue] = useState("1");

    useEffect(() => {
        const loadPdf = async () => {
            setIsLoading(true);
            try {
                const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
                const response = await fetch(fileUrl, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                });

                if (!response.ok) throw new Error(`Failed to fetch PDF`);

                const arrayBuffer = await response.arrayBuffer();
                const loadingTask = pdfjsLib.getDocument({
                    data: new Uint8Array(arrayBuffer),
                    worker: new pdfjsLib.PDFWorker(),
                });
                
                const pdfDoc = await loadingTask.promise;
                setPdf(pdfDoc);
                setNumPages(pdfDoc.numPages);

                // Pre-calculate heights and ratios
                const heights: number[] = [];
                const ratios: number[] = [];
                for (let i = 1; i <= pdfDoc.numPages; i++) {
                    const page = await pdfDoc.getPage(i);
                    const viewport = page.getViewport({ scale: 1.5 });
                    heights.push(viewport.height + 32); // viewport + padding (p-4 = 16 each side)
                    ratios.push(viewport.height / viewport.width);
                }
                setPageHeights(heights);
                setPageRatios(ratios);
                setIsLoading(false);
            } catch (error) {
                console.error("Error loading PDF:", error);
                setIsLoading(false);
            }
        };

        if (fileUrl) loadPdf();
    }, [fileUrl]);

    useEffect(() => {
        if (listRef.current) {
            listRef.current.resetAfterIndex(0);
        }
    }, [zoom]);

    useEffect(() => {
        setJumpValue(pageNumber.toString());
    }, [pageNumber]);

    const scrollToPage = (index: number) => {
        listRef.current?.scrollToItem(index, "start");
        setPageNumber(index + 1);
    };

    const handleItemsRendered = ({ visibleStartIndex }: { visibleStartIndex: number }) => {
        setPageNumber(visibleStartIndex + 1);
        thumbListRef.current?.scrollToItem(visibleStartIndex, "smart");
    };

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] rounded-3xl border border-white/10 overflow-hidden shadow-2xl relative group">
            {/* Top Controls */}
            <div className="flex items-center justify-between p-4 bg-[#111] border-b border-white/20 backdrop-blur-md z-20">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => router.back()}
                        className="p-3 bg-white/5 rounded-xl text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-all cursor-pointer mr-2"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    {docName && (
                        <div className="flex items-center gap-3 px-3 py-1.5 bg-white/5 rounded-xl border border-white/10 mr-2">
                             <span className="text-sm font-bold text-white truncate max-w-50">{docName}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2 px-4 py-1.5 bg-blue-600/10 border border-blue-500/20 rounded-xl text-blue-400 text-xs font-bold tracking-widest uppercase group/jump">
                        <input 
                            type="text"
                            value={jumpValue}
                            onChange={(e) => {
                                // Only allow numeric input
                                const val = e.target.value.replace(/\D/g, '');
                                setJumpValue(val);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    const num = parseInt(jumpValue);
                                    if (!isNaN(num)) {
                                        const target = Math.min(Math.max(1, num), numPages);
                                        scrollToPage(target - 1);
                                    } else {
                                        setJumpValue(pageNumber.toString());
                                    }
                                }
                            }}
                            onBlur={() => {
                                const num = parseInt(jumpValue);
                                if (!isNaN(num)) {
                                    const target = Math.min(Math.max(1, num), numPages);
                                    scrollToPage(target - 1);
                                } else {
                                    setJumpValue(pageNumber.toString());
                                }
                            }}
                            className="w-10 bg-transparent text-blue-400 text-xs font-bold text-center border-b border-blue-400/50 outline-none focus:border-blue-400 transition-colors"
                        />
                        <span className="opacity-70">/ {numPages} Pages</span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center bg-white/5 rounded-xl border border-white/10 p-1">
                        <button 
                            onClick={() => setZoom(prev => Math.max(0.5, prev - 0.25))} 
                            className="p-2 text-gray-400 hover:text-white transition-colors cursor-pointer"
                        >
                            <ZoomOut className="w-4.5 h-4.5" />
                        </button>
                        <span className="text-[10px] font-bold text-gray-300 w-12 text-center uppercase">
                            {Math.round(zoom * 100)}%
                        </span>
                        <button 
                            onClick={() => setZoom(prev => Math.min(3, prev + 0.25))} 
                            className="p-2 text-gray-400 hover:text-white transition-colors cursor-pointer"
                        >
                            <ZoomIn className="w-4.5 h-4.5" />
                        </button>
                    </div>

                    {onAnalyze && (
                        <button 
                            onClick={() => onAnalyze(docDetails)}
                            className="px-6 py-2.5 bg-blue-600 cursor-pointer hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-95 flex items-center gap-2 uppercase tracking-tighter"
                        >
                            <Layers className="w-4 h-4" /> Analyze
                        </button>
                    )}
                </div>
            </div>

            {/* Content Area with Thumbnails and PDF */}
            <div className="flex-1 flex overflow-hidden">
                {isLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4">
                        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                        <p className="text-gray-400 font-bold text-xs uppercase tracking-widest animate-pulse">Initializing Virtual Renderer</p>
                    </div>
                ) : (
                    <>
                        {/* Thumbnail Sidebar (14.2% of 70% parent = 10% of total) */}
                        <div className="w-[14.2%] bg-[#0d0d0d] border-r border-white/20">
                            <AutoSizer renderProp={({ height, width }) => (
                                    <VariableSizeList
                                        ref={thumbListRef}
                                        key={width}
                                        height={height || 0}
                                        itemCount={numPages}
                                        itemSize={(index) => {
                                            const ratio = pageRatios[index] || 1.41;
                                            const contentWidth = (width || 0) - 32; // px-4 = 16 * 2
                                            return (contentWidth * ratio) + 55; // padding and title
                                        }}
                                        width={width || 0}
                                        className="custom-scrollbar"
                                        itemData={{ pdf: pdf!, currentPage: pageNumber, scrollToPage }}
                                    >
                                        {ThumbnailRenderer}
                                    </VariableSizeList>
                                )} />
                        </div>

                        {/* Main PDF Viewer */}
                        <div className="flex-1 bg-[radial-gradient(circle_at_center,#111_0%,#000_100%)]">
                            <AutoSizer renderProp={({ height, width }) => (
                                    <VariableSizeList
                                        ref={listRef}
                                        height={height || 0}
                                        width={width || 0}
                                        itemCount={numPages}
                                        itemSize={(index: number) => (pageHeights[index] || 800) * (zoom / 1.5)}
                                        onItemsRendered={handleItemsRendered}
                                        className="custom-scrollbar"
                                        itemData={{ pdf: pdf!, zoom, setPageNumber }}
                                        overscanCount={2}
                                    >
                                        {PageRenderer}
                                    </VariableSizeList>
                                )} />
                        </div>
                    </>
                )}
            </div>

            {/* Custom Styles */}
            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(59, 130, 246, 0.1);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(59, 130, 246, 0.3);
                }
            `}</style>
        </div>
    );
};

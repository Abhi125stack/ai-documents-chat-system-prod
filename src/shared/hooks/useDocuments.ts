import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import { toast } from "sonner";
import { AxiosError } from "axios";

import { DocumentMetadata, UploadResponse } from "@/types";

type ApiErrorData = { message?: string };

export const useDocuments = (search?: string) => {
    const queryClient = useQueryClient();

    const { data, isLoading, refetch } = useQuery({
        queryKey: ["documents", search],
        queryFn: async () => {
            const response = await api.get<{ documents: DocumentMetadata[] }>("/documents", {
                params: { name: search }
            });
            return response.data.documents;
        },
    });

    const uploadMutation = useMutation({
        mutationFn: async ({ files, onProgress }: { files: File[], onProgress?: (pct: number) => void }) => {
            const formData = new FormData();
            files.forEach(file => formData.append("files", file));
            
            const response = await api.post<UploadResponse>("/documents/upload", formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
                onUploadProgress: (progressEvent) => {
                    if (progressEvent.total && onProgress) {
                        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        onProgress(percentCompleted);
                    }
                }
            });
            return response.data;
        },
        onSuccess: (data) => {
            toast.success(data.message || "Upload complete!");
            queryClient.invalidateQueries({ queryKey: ["documents"] });
        },
        onError: (error: AxiosError<ApiErrorData>) => {
            const message = error.response?.data?.message || "Upload failed. Please try again.";
            toast.error(message);
        },
    });

    const deleteDocumentMutation = useMutation({
        mutationFn: async (docId: string) => {
            const response = await api.delete(`/documents/${docId}`);
            return response.data;
        },
        onSuccess: (data) => {
            toast.success(data.message || "Document deleted!");
            queryClient.invalidateQueries({ queryKey: ["documents"] });
        },
        onError: (error: AxiosError<ApiErrorData>) => {
            const message = error.response?.data?.message || "Delete failed.";
            toast.error(message);
        },
    });

    const deleteDocumentsMutation = useMutation({
        mutationFn: async (docIds: string[]) => {
            const response = await api.post("/documents/bulk-delete", { docIds });
            return response.data;
        },
        onSuccess: (data) => {
            toast.success(data.message || "Documents deleted!");
            queryClient.invalidateQueries({ queryKey: ["documents"] });
        },
        onError: (error: AxiosError<ApiErrorData>) => {
            const message = error.response?.data?.message || "Delete failed.";
            toast.error(message);
        },
    });

    return {
        documents: data || [],
        isLoading,
        uploadFiles: uploadMutation.mutate,
        isUploading: uploadMutation.isPending,
        deleteDocument: deleteDocumentMutation.mutate,
        isDeleting: deleteDocumentMutation.isPending,
        deleteDocuments: deleteDocumentsMutation.mutate,
        isDeletingMultiple: deleteDocumentsMutation.isPending,
        refetch,
    };
};

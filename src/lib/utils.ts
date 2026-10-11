import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Safely extract a human-readable message from an unknown thrown value.
 * Use in `catch (err: unknown)` blocks instead of `catch (err: any)`.
 */
export function getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === "string") return err;
    return "Unknown error";
}

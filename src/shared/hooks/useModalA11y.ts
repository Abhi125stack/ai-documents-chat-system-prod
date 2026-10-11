import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Dialog keyboard accessibility while `open`:
 * - moves focus into the dialog (first focusable, else the dialog itself),
 * - Escape calls `onClose` (omit it for dialogs that must not be dismissed),
 * - Tab / Shift+Tab cycle inside the dialog instead of escaping to the page,
 * - focus returns to the previously focused element when the dialog closes.
 */
export function useModalA11y(
    ref: RefObject<HTMLElement | null>,
    open: boolean,
    onClose?: () => void
) {
    // Keep the latest onClose without re-running the effect (which would steal focus
    // back to the first element on every parent re-render).
    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    });

    useEffect(() => {
        if (!open) return;
        const node = ref.current;
        if (!node) return;

        const previouslyFocused = document.activeElement as HTMLElement | null;
        const focusables = () => Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
        (focusables()[0] ?? node).focus();

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (onCloseRef.current) {
                    e.preventDefault();
                    onCloseRef.current();
                }
                return;
            }
            if (e.key !== "Tab") return;

            const items = focusables();
            if (items.length === 0) {
                e.preventDefault();
                return;
            }
            const first = items[0];
            const last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };

        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("keydown", onKeyDown);
            previouslyFocused?.focus?.();
        };
    }, [ref, open]);
}

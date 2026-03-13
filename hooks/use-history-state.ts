import { useEffect, useRef, useCallback } from "react";

/**
 * Hook to integrate a modal/sheet with browser history for back button support.
 *
 * Works by pushing a state to history when opened.
 * - If the user hits the browser/hardware back button, the modal closes.
 * - If the modal is closed manually from UI, it calls history.back() to clean up.
 *
 * @param isOpen - Current open state of the modal/sheet
 * @param onClose - Callback to close the modal
 * @param key - Unique key for the history state
 */
export function useHistoryState(
  isOpen: boolean,
  onClose: () => void,
  key: string
) {
  const isPoppingRef = useRef(false);
  const historyPushedRef = useRef(false);

  const handlePopState = useCallback(() => {
    if (historyPushedRef.current) {
      isPoppingRef.current = true;
      historyPushedRef.current = false;
      onClose();
      // Reset isPopping after the current execution cycle
      setTimeout(() => {
        isPoppingRef.current = false;
      }, 0);
    }
  }, [onClose]);

  useEffect(() => {
    // Only apply history state if we're on a browser (not SSR)
    if (typeof window === "undefined") return;

    if (isOpen) {
      if (!historyPushedRef.current) {
        window.history.pushState({ [key]: true }, "");
        historyPushedRef.current = true;
      }
    } else {
      // If closed manually (not via back button)
      if (historyPushedRef.current && !isPoppingRef.current) {
        historyPushedRef.current = false;
        window.history.back();
      }
    }
  }, [isOpen, key]);

  useEffect(() => {
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [handlePopState]);
}

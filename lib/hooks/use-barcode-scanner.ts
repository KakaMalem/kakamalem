"use client";

import { useEffect, useRef, useCallback } from "react";

interface UseBarcodeScanner {
  onScan: (barcode: string) => void;
  enabled?: boolean;
  minLength?: number;
  maxTimeBetweenKeys?: number;
  endKeys?: string[];
}

/**
 * Global barcode scanner listener hook.
 *
 * USB/Bluetooth barcode scanners work as HID keyboards - they "type"
 * the barcode very fast (typically 10-50ms between characters) followed
 * by an Enter key.
 *
 * This hook detects scanner input by:
 * 1. Listening for rapid keystrokes at the document level
 * 2. Buffering characters typed faster than maxTimeBetweenKeys
 * 3. Processing the buffer when an end key (Enter) is received
 * 4. Ignoring slow typing (human input)
 *
 * Works regardless of which element has focus.
 */
export function useBarcodeScanner({
  onScan,
  enabled = true,
  minLength = 4, // Minimum barcode length to consider valid
  maxTimeBetweenKeys = 50, // Max ms between keys for scanner input
  endKeys = ["Enter"], // Keys that signal end of barcode
}: UseBarcodeScanner) {
  const bufferRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear the buffer
  const clearBuffer = useCallback(() => {
    bufferRef.current = "";
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Process the buffer when we have a complete barcode
  const processBuffer = useCallback(() => {
    const barcode = bufferRef.current.trim();

    if (barcode.length >= minLength) {
      onScan(barcode);
    }

    clearBuffer();
  }, [minLength, onScan, clearBuffer]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const now = Date.now();
      const timeSinceLastKey = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Check if this is an end key (Enter)
      if (endKeys.includes(event.key)) {
        // Only process if we have buffered content that was typed fast
        if (bufferRef.current.length > 0) {
          event.preventDefault();
          event.stopPropagation();
          processBuffer();
        }
        return;
      }

      // Only accept single printable characters
      if (event.key.length !== 1) {
        return;
      }

      // Check if this keystroke is fast enough to be from a scanner
      const isFastKeystroke = timeSinceLastKey < maxTimeBetweenKeys;

      // If buffer is empty, start fresh (first character of potential barcode)
      if (bufferRef.current.length === 0) {
        bufferRef.current = event.key;

        // Set a timeout to clear the buffer if no more fast keystrokes come
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(clearBuffer, maxTimeBetweenKeys * 3);
        return;
      }

      // If keystroke is fast, add to buffer (likely scanner)
      if (isFastKeystroke) {
        bufferRef.current += event.key;

        // Reset the timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(clearBuffer, maxTimeBetweenKeys * 3);
      } else {
        // Slow keystroke - clear buffer (human typing)
        clearBuffer();
      }
    };

    // Listen at document level to capture input regardless of focus
    document.addEventListener("keydown", handleKeyDown, { capture: true });

    return () => {
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, maxTimeBetweenKeys, endKeys, processBuffer, clearBuffer]);

  return {
    clearBuffer,
  };
}

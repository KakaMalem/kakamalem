"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  useNotificationSoundStore,
  notificationSoundEmitter,
  NOTIFICATION_SOUNDS,
  type NotificationSoundType,
} from "@/lib/stores/use-notification-sound-store";

interface ServiceWorkerSoundMessage {
  type: "PLAY_NOTIFICATION_SOUND";
  notificationType?: NotificationSoundType;
}

/**
 * Hook to play custom notification sounds.
 *
 * Listens to multiple sources:
 * 1. Service worker messages (push notifications)
 * 2. Global event emitter (polling/real-time in-app notifications)
 *
 * Respects user settings from the notification sound store.
 */
export function useNotificationSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastPlayedRef = useRef<number>(0);
  const { settings, updateLastPlayed } = useNotificationSoundStore();

  const playSound = useCallback(
    (notificationType: NotificationSoundType = "default") => {
      // Check if sounds are enabled globally
      if (!settings.enabled) return;

      // Check if this specific sound type is enabled
      if (!settings.soundPerType[notificationType]) return;

      // Debounce: prevent duplicate plays within 500ms
      const now = Date.now();
      if (now - lastPlayedRef.current < 500) return;
      lastPlayedRef.current = now;

      // Get sound path for this type
      const soundPath =
        NOTIFICATION_SOUNDS[notificationType] || NOTIFICATION_SOUNDS.default;

      // Create and play audio
      const audio = new Audio(soundPath);
      audio.volume = settings.volume;

      audio
        .play()
        .then(() => {
          updateLastPlayed();
        })
        .catch((error) => {
          // Browser may block autoplay if user hasn't interacted
          console.warn("Could not play notification sound:", error.message);
        });

      // Store reference for cleanup
      audioRef.current = audio;
    },
    [settings.enabled, settings.volume, settings.soundPerType, updateLastPlayed]
  );

  useEffect(() => {
    // 1. Listen for service worker messages (push notifications)
    const handleServiceWorkerMessage = (
      event: MessageEvent<ServiceWorkerSoundMessage>
    ) => {
      if (event.data?.type === "PLAY_NOTIFICATION_SOUND") {
        playSound(event.data.notificationType);
      }
    };

    // 2. Subscribe to global event emitter (polling/real-time)
    const unsubscribe = notificationSoundEmitter.subscribe(playSound);

    // Register service worker listener
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener(
        "message",
        handleServiceWorkerMessage
      );
    }

    return () => {
      // Cleanup service worker listener
      if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener(
          "message",
          handleServiceWorkerMessage
        );
      }

      // Cleanup event emitter subscription
      unsubscribe();

      // Cleanup audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [playSound]);

  return { playSound, settings };
}

/**
 * Play a notification sound from anywhere (non-hook context).
 * Use this when you can't use the hook (e.g., in callbacks, utilities).
 */
export function playNotificationSound(type: NotificationSoundType = "default") {
  notificationSoundEmitter.emit(type);
}

/**
 * Map in-app notification types to sound types
 */
export function mapNotificationTypeToSound(
  notificationType: string
): NotificationSoundType {
  switch (notificationType) {
    case "new_order":
    case "order_confirmed":
    case "order_shipped":
    case "out_for_delivery":
    case "order_delivered":
    case "order_cancelled":
      return "order";
    case "new_review":
      return "review";
    case "low_stock":
      return "lowStock";
    case "back_in_stock":
    default:
      return "default";
  }
}

/**
 * Provider component that initializes notification sound listeners.
 * Add to dashboard layout.
 */
export function NotificationSoundProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useNotificationSound();
  return <>{children}</>;
}

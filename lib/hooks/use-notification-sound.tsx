"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  useNotificationSoundStore,
  notificationSoundEmitter,
  NOTIFICATION_SOUNDS,
  type NotificationSoundType,
} from "@/lib/stores/use-notification-sound-store";

/**
 * Hook to play custom notification sounds.
 *
 * Listens to the global event emitter for sound triggers.
 * The NotificationBell component emits sounds when new notifications arrive.
 * Respects user settings from the notification sound store.
 *
 * The browser's own autoplay policy handles blocking before user interaction.
 * The NotificationBell's initial-load guard prevents false triggers on page load.
 */
export function useNotificationSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastPlayedRef = useRef<number>(0);
  const { settings, updateLastPlayed } = useNotificationSoundStore();

  const playSound = useCallback(
    (notificationType: NotificationSoundType = "default") => {
      if (!settings.enabled) return;
      if (!settings.soundPerType[notificationType]) return;

      // Debounce: prevent duplicate plays within 500ms
      const now = Date.now();
      if (now - lastPlayedRef.current < 500) return;
      lastPlayedRef.current = now;

      const soundPath =
        NOTIFICATION_SOUNDS[notificationType] || NOTIFICATION_SOUNDS.default;

      const audio = new Audio(soundPath);
      audio.volume = settings.volume;

      audio
        .play()
        .then(() => {
          updateLastPlayed();
        })
        .catch((error) => {
          console.warn("Could not play notification sound:", error.message);
        });

      audioRef.current = audio;
    },
    [settings.enabled, settings.volume, settings.soundPerType, updateLastPlayed]
  );

  useEffect(() => {
    const unsubscribe = notificationSoundEmitter.subscribe(playSound);

    return () => {
      unsubscribe();

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

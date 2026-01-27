"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

// Notification sound types mapped to audio files
export const NOTIFICATION_SOUNDS = {
  order: "/sounds/order.mp3", // New order - exciting "cha-ching"
  review: "/sounds/notification.mp3", // New review
  lowStock: "/sounds/alert.mp3", // Low stock warning
  default: "/sounds/notification.mp3", // Generic notification
} as const;

export type NotificationSoundType = keyof typeof NOTIFICATION_SOUNDS;

interface NotificationSoundSettings {
  enabled: boolean;
  volume: number; // 0-1
  soundPerType: Record<NotificationSoundType, boolean>;
}

interface NotificationSoundState {
  settings: NotificationSoundSettings;
  lastPlayedAt: number | null;
  // Actions
  setEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  toggleSoundForType: (type: NotificationSoundType) => void;
  setSoundForType: (type: NotificationSoundType, enabled: boolean) => void;
  updateLastPlayed: () => void;
}

const DEFAULT_SETTINGS: NotificationSoundSettings = {
  enabled: true,
  volume: 0.7,
  soundPerType: {
    order: true,
    review: true,
    lowStock: true,
    default: true,
  },
};

export const useNotificationSoundStore = create<NotificationSoundState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      lastPlayedAt: null,

      setEnabled: (enabled) =>
        set((state) => ({
          settings: { ...state.settings, enabled },
        })),

      setVolume: (volume) =>
        set((state) => ({
          settings: {
            ...state.settings,
            volume: Math.max(0, Math.min(1, volume)),
          },
        })),

      toggleSoundForType: (type) =>
        set((state) => ({
          settings: {
            ...state.settings,
            soundPerType: {
              ...state.settings.soundPerType,
              [type]: !state.settings.soundPerType[type],
            },
          },
        })),

      setSoundForType: (type, enabled) =>
        set((state) => ({
          settings: {
            ...state.settings,
            soundPerType: {
              ...state.settings.soundPerType,
              [type]: enabled,
            },
          },
        })),

      updateLastPlayed: () => set({ lastPlayedAt: Date.now() }),
    }),
    {
      name: "notification-sound-settings",
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);

// Event emitter for notification sounds (decoupled from React)
type NotificationSoundListener = (type: NotificationSoundType) => void;
const listeners = new Set<NotificationSoundListener>();

export const notificationSoundEmitter = {
  subscribe: (listener: NotificationSoundListener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  emit: (type: NotificationSoundType) => {
    listeners.forEach((listener) => listener(type));
  },
};

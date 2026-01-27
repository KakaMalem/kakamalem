"use client";

import { Volume2, VolumeX, Play } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  useNotificationSoundStore,
  NOTIFICATION_SOUNDS,
  type NotificationSoundType,
} from "@/lib/stores/use-notification-sound-store";

const SOUND_TYPE_LABELS: Record<
  NotificationSoundType,
  { label: string; description: string }
> = {
  order: {
    label: "New Orders",
    description: "Play sound when you receive a new order",
  },
  review: {
    label: "New Reviews",
    description: "Play sound for new customer reviews",
  },
  lowStock: {
    label: "Low Stock Alerts",
    description: "Play sound when products run low",
  },
  default: {
    label: "Other Notifications",
    description: "Sound for general notifications",
  },
};

export function NotificationSoundSettings() {
  const { settings, setEnabled, setVolume, setSoundForType } =
    useNotificationSoundStore();

  const playTestSound = (type: NotificationSoundType) => {
    const soundPath = NOTIFICATION_SOUNDS[type];
    const audio = new Audio(soundPath);
    audio.volume = settings.volume;
    audio.play().catch((error) => {
      console.warn("Could not play test sound:", error.message);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Volume2 className="h-5 w-5" />
          Notification Sounds
        </CardTitle>
        <CardDescription>
          Customize sounds for different notification types
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Master toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="sound-enabled" className="text-base">
              Enable notification sounds
            </Label>
            <p className="text-sm text-muted-foreground">
              Play custom sounds when notifications arrive
            </p>
          </div>
          <Switch
            id="sound-enabled"
            checked={settings.enabled}
            onCheckedChange={setEnabled}
          />
        </div>

        {settings.enabled && (
          <>
            {/* Volume slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Volume</Label>
                <span className="text-sm text-muted-foreground">
                  {Math.round(settings.volume * 100)}%
                </span>
              </div>
              <div className="flex items-center gap-3">
                <VolumeX className="h-4 w-4 text-muted-foreground" />
                <Slider
                  value={[settings.volume]}
                  onValueChange={([value]) => setVolume(value)}
                  min={0}
                  max={1}
                  step={0.1}
                  className="flex-1"
                />
                <Volume2 className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            {/* Sound type toggles */}
            <div className="space-y-4 pt-2">
              <Label className="text-sm font-medium text-muted-foreground">
                Sound by notification type
              </Label>

              {(Object.keys(SOUND_TYPE_LABELS) as NotificationSoundType[]).map(
                (type) => (
                  <div
                    key={type}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex-1 space-y-0.5">
                      <Label
                        htmlFor={`sound-${type}`}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {SOUND_TYPE_LABELS[type].label}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {SOUND_TYPE_LABELS[type].description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => playTestSound(type)}
                        disabled={!settings.soundPerType[type]}
                        title="Play test sound"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                      <Switch
                        id={`sound-${type}`}
                        checked={settings.soundPerType[type]}
                        onCheckedChange={(checked) =>
                          setSoundForType(type, checked)
                        }
                      />
                    </div>
                  </div>
                )
              )}
            </div>

            {/* Tips */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Tip:</strong> Sounds play
                when the dashboard is open. Push notifications will also trigger
                sounds when enabled.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

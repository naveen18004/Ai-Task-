import { Stack } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import * as Notifications from "expo-notifications";
import { processClipboard } from "@/src/utils/clipboardHelper";
import { setupNotifications } from "@/src/notifications/notificationService";

// Configure notifications to show even when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  const appState = useRef(AppState.currentState);
  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPolling = () => {
    if (pollInterval.current) return; // already polling
    pollInterval.current = setInterval(async () => {
      const added = await processClipboard();
      if (added) console.log('Auto-detected task from clipboard!');
    }, 3000); // check every 3 seconds
  };

  const stopPolling = () => {
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
      pollInterval.current = null;
    }
  };

  useEffect(() => {
    setupNotifications();

    // Start polling immediately
    startPolling();

    const subscription = AppState.addEventListener("change", async (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        // App came to foreground — immediately check + start polling
        await processClipboard();
        startPolling();
      } else if (nextAppState.match(/inactive|background/)) {
        // App went to background — stop polling to save battery
        stopPolling();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
      stopPolling();
    };
  }, []);

  return <Stack />;
}

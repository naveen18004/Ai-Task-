import { scheduleDailyBriefing, setupNotifications } from "@/src/notifications/notificationService";
import { processClipboard } from "@/src/utils/clipboardHelper";
import { Ionicons } from "@expo/vector-icons";
import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus, Text, TouchableOpacity, View } from "react-native";

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
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
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
    scheduleDailyBriefing();

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

  useEffect(() => {
    const authenticateUser = async () => {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        setIsUnlocked(true); // Bypass if device has no security
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock AI Task Organizer',
        fallbackLabel: 'Enter Passcode',
        disableDeviceFallback: false,
      });

      if (result.success) {
        setIsUnlocked(true);
      }
      setHasScanned(true);
    };

    authenticateUser();
  }, []);

  if (!isUnlocked) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' }}>
        <Ionicons name="lock-closed" size={64} color="#6366F1" />
        <Text style={{ marginTop: 24, fontSize: 24, fontWeight: 'bold', color: '#1E293B' }}>Secure Vault</Text>
        <Text style={{ marginTop: 8, fontSize: 16, color: '#64748B' }}>Biometric verification required</Text>
        {hasScanned && (
          <TouchableOpacity
            style={{ marginTop: 32, backgroundColor: '#6366F1', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 }}
            onPress={() => LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock AI Task Organizer' }).then(r => r.success && setIsUnlocked(true))}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Tap to Unlock</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

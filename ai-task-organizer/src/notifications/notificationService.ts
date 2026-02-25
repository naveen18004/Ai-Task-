import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export async function setupNotifications() {
  const { status } = await Notifications.requestPermissionsAsync();

  if (status !== "granted") {
    alert("Notification permission not granted");
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
}

export async function scheduleReminder(
  title: string,
  body: string,
  date: Date
) {
  // Ensure we have permission before scheduling
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    const { status: newStatus } = await Notifications.requestPermissionsAsync();
    if (newStatus !== "granted") {
      console.warn('Cannot schedule notification, permission denied');
      return;
    }
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: date,
      channelId: 'default',
    },
  });
  console.log('Notification scheduled with ID:', id, 'for', date.toLocaleString());
}

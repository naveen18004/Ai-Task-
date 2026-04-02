import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { getTasks } from "../storage/asyncStorage";

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

export async function scheduleDailyBriefing() {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  // Clear existing briefings to rebuild them with latest task data
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    if (notif.content.data?.type === 'daily_briefing') {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }

  const tasks = await getTasks();
  const now = new Date();

  // Schedule dynamic briefings for the next 7 days
  for (let i = 0; i < 7; i++) {
    const targetDate = new Date();
    targetDate.setDate(now.getDate() + i);
    const dateStr = targetDate.toDateString();

    const daysTasks = tasks.filter(t => t.date === dateStr && !t.isDone);
    if (daysTasks.length === 0) continue;

    const highPriority = daysTasks.filter(t => t.priority === 'high');

    // Target time: 8:00 AM
    targetDate.setHours(8, 0, 0, 0);

    if (targetDate.getTime() < now.getTime()) continue;

    let body = `You have ${daysTasks.length} tasks scheduled for today.`;
    if (highPriority.length > 0) {
      body = `You have ${daysTasks.length} tasks, including ${highPriority.length} high priority: ${highPriority[0].text.substring(0, 30)}...`;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🌞 Your Daily Briefing',
        body: body,
        sound: true,
        data: { type: 'daily_briefing' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: targetDate,
        channelId: 'default',
      },
    });
  }
}

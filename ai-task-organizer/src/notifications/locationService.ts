import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

const GEOFENCE_TASK_NAME = 'GEOFENCE_TASK_REMINDER';

// Define the background task outside of React components
TaskManager.defineTask(GEOFENCE_TASK_NAME, async (taskBody: any) => {
    const { data, error } = taskBody;
    if (error) {
        console.error('Geofence error:', error.message);
        return;
    }
    const { eventType, region } = data;
    if (eventType === Location.GeofencingEventType.Enter) {
        console.log("You've entered region:", region);

        const taskTitle = region.identifier || "Task Reminder";

        Notifications.scheduleNotificationAsync({
            content: {
                title: "📍 You have arrived!",
                body: `Don't forget: ${taskTitle}`,
                sound: true,
            },
            trigger: null, // Send immediately
        });
    }
});

export const requestLocationPermissions = async () => {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
        console.log('Permission to access foreground location was denied');
        return false;
    }

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
        console.log('Permission to access background location was denied');
        return false;
    }
    return true;
};

export const startGeofenceForTask = async (taskId: string, taskTitle: string, latitude: number, longitude: number, radius: number = 200) => {
    const hasPermission = await requestLocationPermissions();
    if (!hasPermission) return;

    try {
        await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, [
            {
                identifier: taskTitle,
                latitude,
                longitude,
                radius,
                notifyOnEnter: true,
                notifyOnExit: false,
            },
        ]);
        console.log(`Geofence started for ${taskTitle}`);
    } catch (error) {
        console.error("Failed to start Geofence:", error);
    }
};

export const geocodeLocationString = async (locationStr: string): Promise<{ latitude: number, longitude: number } | null> => {
    try {
        const results = await Location.geocodeAsync(locationStr);
        if (results && results.length > 0) {
            return {
                latitude: results[0].latitude,
                longitude: results[0].longitude
            };
        }
    } catch (err) {
        console.log("Geocoding failed for: ", locationStr, err);
    }
    return null;
}

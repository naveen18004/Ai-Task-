import * as Calendar from 'expo-calendar';
import { Alert, Platform } from 'react-native';
import { ParsedTask } from '../ai/taskParser';

/**
 * Requests native Calendar permissions and returns default calendar ID
 */
export async function getDefaultCalendarSource() {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') {
        Alert.alert('Permission needed', 'Calendar permissions are required to save tasks.');
        return null;
    }

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    if (Platform.OS === 'ios') {
        const defaultCalendars = calendars.filter((c) => c.isPrimary);
        return defaultCalendars.length ? defaultCalendars[0] : calendars[0];
    } else {
        // Android: find a primary google or device calendar
        const defaultCalendars = calendars.filter((c) => c.accessLevel === Calendar.CalendarAccessLevel.OWNER);
        return defaultCalendars.length ? defaultCalendars[0] : calendars[0];
    }
}

/**
 * Creates an event in the native device calendar directly
 */
export async function addOfflineTaskToCalendar(task: ParsedTask) {
    try {
        const calendar = await getDefaultCalendarSource();
        if (!calendar) return;

        // Convert extracted dates to normal Date objects
        // If no date was spoken, default to today
        let startDate = new Date();

        if (task.date) {
            startDate = new Date(task.date);

            if (task.time) {
                const timeParts = task.time.match(/(\d+):(\d+) (\w+)/);
                if (timeParts) {
                    let hours = parseInt(timeParts[1]);
                    const mins = parseInt(timeParts[2]);
                    const ampm = timeParts[3];
                    if (ampm.toLowerCase() === 'pm' && hours < 12) hours += 12;
                    if (ampm.toLowerCase() === 'am' && hours === 12) hours = 0;

                    startDate.setHours(hours, mins, 0, 0);
                }
            }
        }

        // Default event length: 1 hour
        const endDate = new Date(startDate);
        endDate.setHours(startDate.getHours() + 1);

        const eventId = await Calendar.createEventAsync(calendar.id, {
            title: task.text || "New Task",
            startDate: startDate,
            endDate: endDate,
            location: task.location || undefined,
            notes: `Intent: ${task.intent} | Priority: ${task.priority}\n\nGenerated offline by AI Task Organizer`,
            timeZone: 'GMT', // Will default to device timezone automatically
        });

        Alert.alert('Success', `Task "${task.text}" added to your device calendar.`);
        return eventId;
    } catch (error) {
        console.error('Failed to save to calendar', error);
        Alert.alert('Error', 'Could not save the task to the calendar.');
    }
}

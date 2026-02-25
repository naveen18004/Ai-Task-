import * as Clipboard from 'expo-clipboard';
import { parseTaskText, ParsedTask } from '../ai/taskParser';
import { isClipboardProcessed, markClipboardProcessed, saveTaskStr, Task, getApiKey } from '../storage/asyncStorage';
import { scheduleReminder } from '../notifications/notificationService';

/** Robustly build a Date from dateStr ("Fri Feb 20 2026") + timeStr ("12:09 PM" or "14:30") */
function buildReminderDate(dateStr: string, timeStr: string): Date | null {
    try {
        // Parse date part
        const dateParts = new Date(dateStr);
        const year = dateParts.getFullYear();
        const month = dateParts.getMonth();
        const day = dateParts.getDate();
        if (isNaN(year)) return null;

        // Parse time part
        let hours = 0, minutes = 0;
        const time12 = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        const time12h = timeStr.match(/^(\d{1,2})\s*(AM|PM)$/i);
        const time24 = timeStr.match(/^(\d{1,2}):(\d{2})$/);

        if (time12) {
            hours = parseInt(time12[1]);
            minutes = parseInt(time12[2]);
            const period = time12[3].toUpperCase();
            if (period === 'PM' && hours !== 12) hours += 12;
            if (period === 'AM' && hours === 12) hours = 0;
        } else if (time12h) {
            hours = parseInt(time12h[1]);
            minutes = 0;
            const period = time12h[2].toUpperCase();
            if (period === 'PM' && hours !== 12) hours += 12;
            if (period === 'AM' && hours === 12) hours = 0;
        } else if (time24) {
            hours = parseInt(time24[1]);
            minutes = parseInt(time24[2]);
        } else {
            return null;
        }

        return new Date(year, month, day, hours, minutes, 0, 0);
    } catch {
        return null;
    }
}

export const processClipboard = async (): Promise<boolean> => {
    try {
        const hasString = await Clipboard.hasStringAsync();
        if (!hasString) return false;

        const text = await Clipboard.getStringAsync();
        if (!text || text.trim() === '') return false;

        // Check if already processed
        const isProcessed = await isClipboardProcessed(text);
        if (isProcessed) return false;

        // Process line by line
        const lines = text.split('\n').filter(line => line.trim().length > 3);
        let taskAdded = false;

        for (const line of lines) {
            const parsed: ParsedTask = parseTaskText(line);

            const newTask: Task = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                text: line.trim(),
                intent: parsed.intent,
                category: parsed.category,
                date: parsed.date,
                time: parsed.time,
                priority: parsed.priority,
                createdAt: new Date().toISOString()
            };

            await saveTaskStr(newTask);
            taskAdded = true;

            if (parsed.date && parsed.time) {
                const reminderDate = buildReminderDate(parsed.date, parsed.time);
                const now = new Date();
                if (reminderDate && reminderDate > now) {
                    await scheduleReminder('AI Task Detected', line.trim(), reminderDate);
                    console.log('Reminder scheduled for', reminderDate.toLocaleString());
                } else {
                    console.log('Reminder skipped: date is in the past or invalid', parsed.date, parsed.time);
                }
            }
        }

        if (taskAdded) {
            await markClipboardProcessed(text);
        }

        return taskAdded;
    } catch (error) {
        console.error('Clipboard processing error:', error);
        return false;
    }
};

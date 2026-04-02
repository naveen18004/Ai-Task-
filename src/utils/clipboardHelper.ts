import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { parseTaskWithFallback } from '../ai/fallbackParser';
import { scheduleReminder } from '../notifications/notificationService';
import { getTasks, saveTaskStr, Task } from '../storage/asyncStorage';

const LAST_CLIPBOARD_KEY = '@ai_task_organizer_last_clipboard';

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

        // Prevent infinite respawns if the user deleted the task but it's still on their clipboard
        const lastProcessed = await AsyncStorage.getItem(LAST_CLIPBOARD_KEY);
        if (lastProcessed === text) {
            return false; // The clipboard hasn't changed since we last processed it
        }

        // It's a new clipboard payload, mark it as the latest
        await AsyncStorage.setItem(LAST_CLIPBOARD_KEY, text);

        const rawText = text.trim();

        // ── TASK HEURISTIC FILTER ──
        // If the text doesn't contain typical task/action words, don't auto-import it.
        // This prevents capturing randomURLs, code snippets, or conversational text.
        const taskKeywords = /\b(call|buy|email|send|text|submit|remind|meeting|test|exam|deadline|assignment|homework|project|report|finish|complete|attend|prepare|review|schedule|appointment|doctor|pick\s?up|grocery|groceries|pay|clean|cook|study|visit)\b/i;

        // Instead of parsing the massive block, split by lines or bullets
        const lines = rawText.split(/\n|\u2022|\-/).map(l => l.trim()).filter(l => l.length > 8);
        if (lines.length === 0) return false;

        let taskAdded = false;
        const existingTasks = await getTasks();

        for (const line of lines) {
            // Only process lines that have actionable task keywords
            if (!taskKeywords.test(line)) continue;

            const parsed = await parseTaskWithFallback(line);
            if (!parsed) continue;

            const finalTaskText = parsed.text || line;

            // Deduplication Logic
            const isDuplicate = existingTasks.some((t: Task) =>
                t.text === finalTaskText &&
                t.date === parsed.date
            );

            if (isDuplicate) {
                console.log('Skipping duplicate sub-task from clipboard:', line);
                continue;
            }

            const newTask: Task = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                text: finalTaskText,
                intent: parsed.intent || 'task',
                category: parsed.category || 'General',
                date: parsed.date,
                time: parsed.time,
                priority: parsed.priority || 'medium',
                location: parsed.location,
                actionContact: parsed.actionContact,
                actionPayload: parsed.actionPayload,
                createdAt: new Date().toISOString()
            };

            const saved = await saveTaskStr(newTask);
            if (saved) {
                taskAdded = true;
                if (parsed.date && parsed.time) {
                    const reminderDate = buildReminderDate(parsed.date, parsed.time);
                    const now = new Date();
                    if (reminderDate && reminderDate > now) {
                        await scheduleReminder('AI Task Detected', finalTaskText, reminderDate);
                    }
                }
            }
        }

        return taskAdded;
    } catch (error) {
        console.error('Clipboard processing error:', error);
        return false;
    }
};

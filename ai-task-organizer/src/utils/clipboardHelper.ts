import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseTaskText, ParsedTask } from '../ai/taskParser';
import { isClipboardProcessed, markClipboardProcessed, saveTaskStr, getTasks, Task, getApiKey } from '../storage/asyncStorage';
import { scheduleReminder } from '../notifications/notificationService';

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
        // Removed generic words (today, tomorrow, read, start, check) to prevent chat messages from triggering it.
        const taskKeywords = /\b(submit|remind|meeting|test|exam|deadline|assignment|homework|project|report|finish|complete|attend|prepare|review|schedule|appointment|doctor|pick\s?up|grocery|groceries|pay|clean|cook|study|visit)\b/i;

        // Also ensure it's a reasonable length (not a massive essay, not a single word)
        if (rawText.length < 5 || rawText.length > 250 || !taskKeywords.test(rawText)) {
            return false;
        }

        const parsed: ParsedTask = parseTaskText(rawText);

        // Use the smart summary text that the parser generates, or fallback to rawText
        const finalTaskText = parsed.text || rawText;

        // Fetch existing tasks to check for semantic duplicates
        const existingTasks = await getTasks();

        // Deduplication Logic: Block if EXACT same text & dates exist.
        const isDuplicate = existingTasks.some((t: Task) =>
            t.text === finalTaskText &&
            t.date === parsed.date &&
            t.time === parsed.time
        );

        if (isDuplicate) {
            console.log('Skipping duplicate task from clipboard');
            return false;
        }

        const newTask: Task = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            text: finalTaskText,
            intent: parsed.intent,
            category: parsed.category,
            date: parsed.date,
            time: parsed.time,
            priority: parsed.priority,
            location: parsed.location,
            createdAt: new Date().toISOString()
        };

        const saved = await saveTaskStr(newTask);
        if (!saved) return false;
        let taskAdded = true;

        if (parsed.date && parsed.time) {
            const reminderDate = buildReminderDate(parsed.date, parsed.time);
            const now = new Date();
            if (reminderDate && reminderDate > now) {
                await scheduleReminder('AI Task Detected', rawText, reminderDate);
                console.log('Reminder scheduled for', reminderDate.toLocaleString());
            } else {
                console.log('Reminder skipped: date is in the past or invalid', parsed.date, parsed.time);
            }
        }

        return taskAdded;
    } catch (error) {
        console.error('Clipboard processing error:', error);
        return false;
    }
};

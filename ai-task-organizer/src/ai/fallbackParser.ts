import { ParsedTask, parseTaskText } from './taskParser';
import { OfflineModel } from './offline-model/offlineModel';

export async function parseTaskWithFallback(text: string): Promise<ParsedTask | null> {
    // 1. Try Offline Model First
    const offlineModel = OfflineModel.getInstance();
    const offlineResultString = await offlineModel.parseTaskOffline(text);

    if (offlineResultString && offlineResultString !== '{}') {
        try {
            const parsedOffline = JSON.parse(offlineResultString);
            // Construct ParsedTask mapping the response from the LLM
            return {
                text: parsedOffline.title || text,
                intent: 'task', // LLMs can extract this better later with an improved prompt
                date: parsedOffline.date || '',
                time: parsedOffline.deadline || '',
                category: 'General',
                priority: parsedOffline.priority || 'medium',
                location: parsedOffline.location || '',
            } as ParsedTask;
        } catch (e) {
            console.warn("Offline JSON parsing failed, falling back to primitive parser");
        }
    }

    // 2. Fallback to primitive parser OR Groq/Gemini calls here
    console.log("Using primitive parsing fallback");
    return parseTaskText(text);
}

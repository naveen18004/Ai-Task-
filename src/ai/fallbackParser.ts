import { CustomNLPEngine } from './custom-model/customParser';
import { ParsedTask, parseTaskText } from './taskParser';

export async function parseTaskWithFallback(text: string): Promise<ParsedTask | null> {
    // 1. Get robust Date, Time, Priority from primitive parser
    const primitiveResult = parseTaskText(text);

    // 2. Try Custom Offline NLP Engine for better Intent & Category mapping
    try {
        const engine = CustomNLPEngine.getInstance();
        const tasks = engine.parseTask(text);

        if (tasks && tasks.length > 0 && tasks[0].intent !== 'none') {
            // Merge custom AI intelligence with primitive Date/Time accuracy
            return {
                ...primitiveResult,
                intent: tasks[0].intent || primitiveResult.intent,
                category: tasks[0].category || primitiveResult.category,
                location: tasks[0].location || primitiveResult.location,
            };
        }
    } catch (e) {
        console.warn("Custom NLP extraction failed in fallback, using primitive parser only:", e);
    }

    return primitiveResult;
}

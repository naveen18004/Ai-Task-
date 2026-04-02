import modelBase from '../../../assets/custom_model.json';
import { MLRawTask } from '../mlParser';
import { getAdaptedModel } from './retrainer';

/**
 * Custom NLP Engine created from scratch.
 * Uses the pre-trained weights from custom_model.json.
 */
export class CustomNLPEngine {
    private static instance: CustomNLPEngine;
    private model: any;

    private constructor() {
        this.model = modelBase;
    }

    public async loadWeights() {
        this.model = await getAdaptedModel();
    }

    public static getInstance(): CustomNLPEngine {
        if (!CustomNLPEngine.instance) {
            CustomNLPEngine.instance = new CustomNLPEngine();
        }
        return CustomNLPEngine.instance;
    }

    private tokenize(text: string): string[] {
        return text.toLowerCase().match(/\w+/g) || [];
    }

    /**
     * Performs Intent Classification using Naive Bayes logic.
     */
    public classifyIntent(text: string): string {
        const tokens = this.tokenize(text);
        let bestIntent = 'task';
        let maxProb = -Infinity;

        for (const intent of this.model.intents) {
            let score = Math.log(this.model.intent_probs[intent]);

            for (const token of tokens) {
                if (this.model.word_probs[intent] && this.model.word_probs[intent][token]) {
                    score += Math.log(this.model.word_probs[intent][token]);
                } else {
                    // Laplace smoothing factor for unknown words
                    score += Math.log(1 / (1000 + Object.keys(this.model.word_probs[intent] || {}).length));
                }
            }

            if (score > maxProb) {
                maxProb = score;
                bestIntent = intent;
            }
        }

        return bestIntent;
    }

    /**
     * Scratches the surface of Entity Extraction by matching tokens 
     * against the frequency-based dictionary built during training.
     */
    public extractEntities(text: string): Partial<MLRawTask> {
        const tokens = this.tokenize(text);
        const result: Partial<MLRawTask> = {};

        // 1. Extract Date/Time (improved regex)
        const timeMatch = text.match(/(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm|AM|PM)|(?:[01]?\d|2[0-3])[:.][0-5]\d)/i);
        if (timeMatch) {
            // Normalize dot to colon if present so other parts of the app can use it smoothly
            result.time = timeMatch[1].replace('.', ':').toUpperCase();
        }

        // 2. Map Entity Verb (Intent) back to Category
        const intent = this.classifyIntent(text);
        result.intent = intent;

        const categoryMap: Record<string, string> = {
            "meet": "Work",
            "call": "Communication",
            "buy": "Personal",
            "submit": "Education",
            "clean": "Personal",
            "study": "Education",
            "review": "Work",
            "visit": "Personal"
        };
        result.category = categoryMap[intent] || "General";

        // 3. Extract items/locations from dictionary
        for (const loc of this.model.entities.location) {
            if (text.toLowerCase().includes(loc)) {
                result.location = loc.charAt(0).toUpperCase() + loc.slice(1);
                break;
            }
        }

        return result;
    }

    /**
     * Main entry point to convert raw text into a Structured Task.
     */
    public parseTask(text: string): MLRawTask[] {
        const raw = this.extractEntities(text);

        // Construct the final task object
        const task: MLRawTask = {
            text: text.length > 60 ? text.substring(0, 57) + '...' : text,
            intent: raw.intent || 'task',
            date: raw.date || '',
            time: raw.time || '',
            location: raw.location || '',
            category: raw.category || 'General',
            priority: 'medium',
            subTasks: [],
            estimatedMinutes: 30
        };

        return [task];
    }
}

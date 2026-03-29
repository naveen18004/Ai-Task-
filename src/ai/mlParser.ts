import { CustomNLPEngine } from "./custom-model/customParser";
import { ParsedTask } from "./taskParser";

export interface MLRawTask extends ParsedTask {
    text: string;
    subTasks?: string[];
    estimatedMinutes?: number;
}

export async function extractTasksWithML(text: string, apiKey: string): Promise<MLRawTask[]> {
    // 1. Try Custom "From Scratch" NLP Engine first
    try {
        const engine = CustomNLPEngine.getInstance();
        const tasks = engine.parseTask(text);

        if (tasks && tasks.length > 0) {
            // If the model identifies this as 'none', it's noise - return empty
            if (tasks[0].intent === 'none') {
                console.log("Custom NLP identified input as noise. Ignoring.");
                return [];
            }
            console.log("Successfully extracted tasks using Custom NLP Engine.");
            return tasks;
        }
    } catch (error) {
        console.warn("Custom NLP extraction failed, falling back to Gemini:", error);
    }

    const prompt = `You are an expert NLP task-extraction engine. Your ONLY purpose is to read raw text (from OCR, voice transcripts, or paste) and extract clear, concise, actionable tasks.

CRITICAL PROCESSING RULES:
1. SPLIT INDEPENDENT TASKS: If the user describes multiple completely distinct events occurring at different times (e.g., a meeting on Tuesday and a game on Sunday), SPLIT them into separate objects in the JSON array. However, if the text describes a singular event (like a "Review") with multiple sub-requirements (bring documents, prepare demo), SUMMARIZE them into ONE single task.
2. ACTIONABLE ONLY: Completely ignore informational statements ("The meeting will be held...", "All students must..."). Instead, rephrase it as an action FOR THE USER (e.g., "Attend meeting", "Complete assignment").
13. DATE & TIME PARSING: Identify ANY date representation (e.g., "02.03.2026", "March 2nd", "Tomorrow", "Next Friday") and convert it to a standard JS date string format (e.g., "Mon Mar 02 2026"). Identify time (e.g., 14:30, 2 PM) and convert to a standard format (e.g. '14:30' or '2:00 PM').  If no date/time is mentioned, leave it empty. Current relative date/time context: ${new Date().toDateString()}.
14. REMOVE NOISE: Strip away all conversational filler, UI artifacts, signatures, standalone phone numbers, or battery percentages.
15. FALLBACK: If the text contains absolutely nothing actionable (e.g., it's just a random paragraph of facts or a simple "hello"), return an empty array [].
16. LOCATION: Extract the location (e.g., "Conference Room A", "Starbucks", "Online") if mentioned.
17. SUB-TASKS: If the task described is complex (e.g., "Plan a birthday party", "Write a research paper"), break it down into an array of 2-5 actionable sub-tasks (e.g., ["Buy decorations", "Order cake", "Send invites"]). If it's a simple, atomic task (e.g., "Call mom", "Buy milk"), return an empty array [] or simply omit the field.
18. TIME ESTIMATION: Estimate how long the task might take to complete in minutes (e.g., 15, 30, 60, 120).
19. SHORT SUMMARY: The "text" field MUST be a precise, actionable summary, maximum 60 characters long.

Format the output EXACTLY as a JSON array of objects with the following schema:
[
  { 
    "text": "Clean, short task description under 60 chars (e.g., 'Submit report')",
    "intent": "meeting" | "call" | "reminder" | "submission" | "exam" | "task", 
    "date": "Standardized date string (e.g., 'Mon Mar 02 2026') or ''", 
    "time": "Standardized time string (e.g., '9:00 AM', '2:30 PM', '14:30') or ''", 
    "location": "Location string if found, otherwise empty",
    "category": "Work" | "Communication" | "Personal" | "Education" | "General" | "Health",
    "priority": "high" | "medium" | "low",
    "subTasks": ["Sub-task 1", "Sub-task 2"] | [],
    "estimatedMinutes": 30
  }
]

Do not return Markdown formatting or code blocks. Return ONLY the raw JSON array.

Raw Text to analyze:
${text}
`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 0.1
                }
            })
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        const jsonText = data.candidates[0].content.parts[0].text;
        const tasks: MLRawTask[] = JSON.parse(jsonText);
        return tasks;
    } catch (error) {
        console.error("ML Parsing Error:", error);
        throw error;
    }
}

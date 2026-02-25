import { ParsedTask } from "./taskParser";

export interface MLRawTask extends ParsedTask {
    text: string;
}

export async function extractTasksWithML(text: string, apiKey: string): Promise<MLRawTask[]> {
    const prompt = `You are a highly intelligent task extraction AI. Extract all actionable tasks, reminders, meetings or events from the following raw OCR text. 
CRITICAL: Ignore conversational noise, software UI elements, standalone phone numbers, battery percentages, and timestamps that aren't clearly attached to an action.

Format the output EXACTLY as a JSON array of objects with the following schema:
[
  { 
    "text": "The actual task description (e.g., 'Buy groceries at kotturpuram')",
    "intent": "meeting" | "call" | "reminder" | "submission" | "exam", 
    "date": "Parsed date string (e.g., 'Wed Jan 28 2026') or empty string", 
    "time": "Parsed time string (e.g., '9:00 pm') or empty string", 
    "category": "Work" | "Communication" | "Personal" | "Education" | "General", 
    "priority": "high" | "medium" | "low"
  }
]

Do not return markdown formatting, just the raw JSON array. If there are no tasks, return an empty array [].

Raw OCR Text to analyze:
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

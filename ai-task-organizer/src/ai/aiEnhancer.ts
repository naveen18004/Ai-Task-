import { Task } from "@/src/storage/asyncStorage";

export interface EnhancedTaskData {
    subTasks: string[];
    estimatedMinutes: number;
}

export async function enhanceTaskWithAI(taskText: string, apiKey: string): Promise<EnhancedTaskData> {
    const prompt = `You are a productivity AI. Your job is to analyze the following task description and provide two things:
1. Break it down into 2-5 actionable sub-tasks (if it's a complex task). If it's a very simple task (e.g. "Buy milk", "Call mom"), return an empty array [].
2. Estimate the time required to complete the task in minutes.

Task: "${taskText}"

Format the output EXACTLY as a JSON object with this schema:
{
    "subTasks": ["Step 1", "Step 2"],
    "estimatedMinutes": 30
}
Return ONLY the raw JSON object. Do not format as markdown.`;

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
        const enhancedData: EnhancedTaskData = JSON.parse(jsonText);
        return enhancedData;
    } catch (error) {
        console.error("AI Enhancer Error:", error);
        return { subTasks: [], estimatedMinutes: 15 }; // Fallback
    }
}

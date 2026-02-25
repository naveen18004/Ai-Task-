import { MLRawTask } from "./mlParser";

/**
 * Use Gemini Vision to read an image directly and extract tasks.
 * No separate OCR step needed — Gemini reads the image AND extracts tasks in one call.
 */
export async function extractTasksFromImage(base64Image: string, apiKey: string): Promise<{ tasks: MLRawTask[], extractedText: string }> {
    const prompt = `You are a strict task extraction AI. Read the image and extract ONLY unique, actionable tasks.

RULES:
1. ONLY extract lines that describe something a person needs to DO (meetings, tests, submissions, reminders, appointments, calls, errands).
2. IGNORE completely: timestamps, phone numbers, sender names, app UI elements (battery, signal, "Message yourself", checkmarks), dates alone, random strings, API keys, file sizes.
3. DEDUPLICATE: If multiple messages describe the same task (e.g., "Meeting at 12:28 PM" and "Meeting at 12:29 PM"), keep ONLY the latest/last one.
4. CLEAN the task text: Remove OCR artifacts like "W", "U", "V/", checkmarks. Write a clean, readable task description.
5. For date: Use today's date (${new Date().toDateString()}) when "today" is mentioned, tomorrow's when "tomorrow" is mentioned.
6. For time: Always format as "H:MM AM/PM" (e.g., "1:00 PM", "8:00 PM").
7. Return FEWER tasks rather than more. Quality over quantity. Maximum 10 unique tasks.

Return JSON:
{
  "extractedText": "Brief summary of what the image contains",
  "tasks": [
    {
      "text": "Clean task description (e.g., 'Submit report')",
      "intent": "meeting" | "call" | "reminder" | "submission" | "exam" | "task",
      "date": "Date string (e.g., '${new Date().toDateString()}') or empty",
      "time": "Time string (e.g., '1:00 PM') or empty",
      "category": "Work" | "Personal" | "Education" | "General",
      "priority": "high" | "medium" | "low"
    }
  ]
}

Return ONLY the JSON, no markdown. Empty tasks array if nothing actionable found.`;

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        {
                            inlineData: {
                                mimeType: 'image/jpeg',
                                data: base64Image
                            }
                        }
                    ]
                }],
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 0.1
                }
            })
        }
    );

    const data = await response.json();

    if (data.error) {
        console.error('Gemini Vision Error:', data.error);
        throw new Error(data.error.message);
    }

    const jsonText = data.candidates[0].content.parts[0].text;
    console.log('Gemini Vision raw output:', jsonText.substring(0, 300));
    const result = JSON.parse(jsonText);

    return {
        extractedText: result.extractedText || '',
        tasks: result.tasks || []
    };
}

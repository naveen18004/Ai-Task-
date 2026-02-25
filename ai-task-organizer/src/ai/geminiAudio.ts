import { MLRawTask } from "./mlParser";

/**
 * Use Gemini 2.0 Flash to transcribe an audio file and extract actionable tasks.
 */
export async function extractTasksFromAudio(base64Audio: string, mimeType: string, apiKey: string): Promise<{ tasks: MLRawTask[], rawText: string }> {
    const prompt = `You are a strict task extraction AI. Listen to the provided audio call recording/memo.
    
    1. Transcribe the audio (the transcription will be returned in "rawText").
    2. Extract ONLY unique, actionable tasks from the conversation.
    
RULES FOR TASKS:
1. ONLY extract lines that describe something a person needs to DO (meetings, tests, submissions, reminders, appointments, calls, errands).
2. DEDUPLICATE: If multiple sentences describe the same task, keep ONLY the latest/most accurate one.
3. For date: Use today's date (${new Date().toDateString()}) when "today" is mentioned, tomorrow's when "tomorrow" is mentioned.
4. For time: Always format as "H:MM AM/PM" (e.g., "1:00 PM", "8:00 PM").
5. Return FEWER tasks rather than more. Quality over quantity. Maximum 10 unique tasks.

Return exactly this JSON structure:
{
  "rawText": "The full transcribed text of the conversation.",
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
                                mimeType: mimeType,
                                data: base64Audio
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
        console.error('Gemini Audio Error:', data.error);

        // Handle Rate Limits cleanely
        if (data.error.message && data.error.message.includes('Quota exceeded')) {
            throw new Error("You are speaking too fast! The free Gemini API only allows a few audio requests per minute. Please wait 60 seconds and try again.");
        }

        throw new Error(data.error.message);
    }

    try {
        const jsonText = data.candidates[0].content.parts[0].text;
        const result = JSON.parse(jsonText);

        return {
            rawText: result.rawText || '',
            tasks: result.tasks || []
        };
    } catch (e) {
        console.error("Failed to parse Gemini response", e);
        throw new Error("Failed to parse the audio intelligently.");
    }
}

/**
 * Use Gemini 2.0 Flash (Text Endpoint) to extract actionable tasks from an existing transcription.
 * This is used heavily when Groq handles the STT transcription, to bypass Gemini Audio Limits.
 */
export async function extractTasksFromText(transcribedText: string, apiKey: string): Promise<{ tasks: MLRawTask[], rawText: string }> {
    const prompt = `You are a strict task extraction AI. Read the provided transcription of an audio call recording/memo.
    
    1. Return the original transcription in "rawText".
    2. Extract ONLY unique, actionable tasks from the conversation.
    
RULES FOR TASKS:
1. ONLY extract lines that describe something a person needs to DO (meetings, tests, submissions, reminders, appointments, calls, errands).
2. DEDUPLICATE: If multiple sentences describe the same task, keep ONLY the latest/most accurate one.
3. For date: Use today's date (${new Date().toDateString()}) when "today" is mentioned, tomorrow's when "tomorrow" is mentioned.
4. For time: Always format as "H:MM AM/PM" (e.g., "1:00 PM", "8:00 PM").
5. Return FEWER tasks rather than more. Quality over quantity. Maximum 10 unique tasks.

Transcription:
"""
${transcribedText}
"""

Return exactly this JSON structure:
{
  "rawText": "The full transcribed text of the conversation.",
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
                        { text: prompt }
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
        console.error('Gemini Text Error:', data.error);
        throw new Error(data.error.message);
    }

    try {
        const jsonText = data.candidates[0].content.parts[0].text;
        const result = JSON.parse(jsonText);

        return {
            rawText: result.rawText || transcribedText,
            tasks: result.tasks || []
        };
    } catch (e) {
        console.error("Failed to parse Gemini text response", e);
        throw new Error("Failed to parse the text intelligently.");
    }
}

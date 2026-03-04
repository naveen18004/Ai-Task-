import { MLRawTask } from "./mlParser";

/**
 * Use Gemini Vision to read an image directly and extract tasks.
 * No separate OCR step needed — Gemini reads the image AND extracts tasks in one call.
 */
export async function extractTasksFromImage(base64Image: string, apiKey: string): Promise<{ tasks: MLRawTask[], extractedText: string }> {
    const prompt = `You are an expert NLP task-extraction engine. Your ONLY purpose is to read the image and extract clear, concise, actionable tasks.

CRITICAL PROCESSING RULES:
1. AGGRESSIVE CONSOLIDATION: Never split a single event, project, notification, or requirement into multiple tasks. If the text describes a singular event (like a "Review", "Meeting", "Assignment", or "Trip") with multiple sub-requirements (bring documents, prepare demo, wear uniform), SUMMARIZE them into ONE single comprehensive task description.
2. ACTIONABLE ONLY: Completely ignore informational statements ("The meeting will be held...", "All students must..."). Instead, rephrase it as an action FOR THE USER (e.g., "Attend meeting", "Complete assignment").
13. DATE & TIME PARSING: Identify ANY date representation (e.g., "02.03.2026", "March 2nd", "Tomorrow", "Next Friday") and convert it to a standard JS date string format (e.g., "Mon Mar 02 2026"). Identify time (e.g., 14:30, 2 PM) and convert to a standard format (e.g. '14:30' or '2:00 PM'). If no date/time is mentioned, leave it empty. Current relative date/time context: ${new Date().toDateString()}.
14. REMOVE NOISE: Strip away all conversational filler, UI artifacts, signatures, standalone phone numbers, or battery percentages. Clean OCR artifacts like "W", "U", "V/", checkmarks.
15. FALLBACK: Return FEWER tasks rather than more. Quality over quantity. Maximum 10 unique tasks. If there are no tasks, return an empty array [].
16. LOCATION: Extract the location (e.g., "Conference Room A", "Starbucks", "Online") if mentioned.
17. SHORT SUMMARY: The "text" field MUST be a precise, actionable summary, maximum 60 characters long.

Return JSON:
{
  "extractedText": "Brief summary of what the image contains",
  "tasks": [
    {
      "text": "Clean, short task description under 60 chars (e.g., 'Submit report')",
      "intent": "meeting" | "call" | "reminder" | "submission" | "exam" | "task",
      "date": "Standardized date string (e.g., 'Mon Mar 02 2026') or ''",
      "time": "Standardized time string (e.g., '9:00 AM', '2:30 PM', '14:30') or ''",
      "location": "Location string if found, otherwise empty",
      "category": "Work" | "Personal" | "Education" | "General",
      "priority": "high" | "medium" | "low"
    }
  ]
}

Return ONLY the JSON. Empty tasks array if nothing actionable found.`;

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
        console.log('External API call bypassed.');
        throw new Error('Image scanner is busy or offline.');
    }

    const jsonText = data.candidates[0].content.parts[0].text;
    console.log('Gemini Vision raw output:', jsonText.substring(0, 300));
    const result = JSON.parse(jsonText);

    return {
        extractedText: result.extractedText || '',
        tasks: result.tasks || []
    };
}

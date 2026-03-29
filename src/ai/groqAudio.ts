/**
 * Use Groq's high-speed Whisper API to transcribe an audio file.
 */
export async function transcribeAudioWithGroq(
    audioUri: string,
    mimeType: string,
    apiKey: string
): Promise<string> {
    const formData = new FormData();
    formData.append('file', {
        uri: audioUri,
        name: 'recording.m4a', // Name doesn't matter much to Groq as long as extension matches type roughly
        type: mimeType
    } as any);

    // Using the fastest supported Groq audio model
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('response_format', 'text');

    try {
        const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Groq API Error:', errorData);
            throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
        }

        const text = await response.text();
        return text.trim();

    } catch (e: any) {
        console.error("Failed to call Groq API", e);
        throw new Error(e.message || "Failed to transcribe the audio.");
    }
}

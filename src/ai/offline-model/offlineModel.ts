import type { LlamaContext } from 'llama.rn';
import { Platform } from 'react-native';

let LlamaModelObj: any = null;
if (Platform.OS !== 'web') {
    try {
        LlamaModelObj = require('llama.rn').LlamaModel;
    } catch (e) {
        console.warn("Could not load llama.rn native module:", e);
    }
}

// Singleton instance to manage the offline LLM model.
export class OfflineModel {
    private static instance: OfflineModel;
    private context: LlamaContext | null = null;
    private isLoaded: boolean = false;

    private constructor() { }

    /**
     * Returns the singleton instance of the OfflineModel.
     */
    public static getInstance(): OfflineModel {
        if (!OfflineModel.instance) {
            OfflineModel.instance = new OfflineModel();
        }
        return OfflineModel.instance;
    }

    /**
     * Initializes the LLM model from the stored GGUF file.
     * We expect the model.gguf file to be handled natively or loaded via path.
     */
    public async loadModel(): Promise<boolean> {
        if (this.isLoaded) return true;

        try {
            if (!LlamaModelObj) throw new Error("LlamaNativeModule not available");
            // In Expo we may need to specify the rn-fs path, or use require
            this.context = await LlamaModelObj.load({
                model: require('../../../assets/models/qwen2.5-0.5b-instruct.gguf'),
                contextSize: 2048,
                useSystemPrompt: true,
            });
            console.log(`LLM Model successfully initialized.`);
            this.isLoaded = true;
            return true;
        } catch (error) {
            console.error('Failed to load local LLM model:', error);
            return false;
        }
    }

    /**
     * Sends a prompt strictly for task extraction to the loaded model.
     * Prompts the model to return the output accurately in JSON format.
     */
    public async parseTaskOffline(text: string): Promise<string | null> {
        if (!this.isLoaded || !this.context) {
            console.warn('Offline LLM is not loaded yet');
            return null;
        }

        try {
            const prompt = `Return ONLY strict JSON matching this interface: { "title": string, "deadline": string, "priority": "low"| "medium"| "high", "location": string }. Extract task title, deadline, infer priority, and find any location mentioned in the text: "${text}"`;

            console.log('Inferencing offline model...', prompt);
            const response = await this.context.completion({
                prompt,
                n_predict: 150,
                temperature: 0.1, // Low temp for more deterministic JSON
            });

            return response.text;
        } catch (error) {
            console.error('Offline inference failed:', error);
            return null;
        }
    }
}

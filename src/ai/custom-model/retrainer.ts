import AsyncStorage from '@react-native-async-storage/async-storage';
import baseModel from '../../../assets/custom_model.json';

const MODEL_WEIGHTS_KEY = '@ai_task_organizer_custom_weights';

export const getAdaptedModel = async () => {
    try {
        const stored = await AsyncStorage.getItem(MODEL_WEIGHTS_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error('Failed to load adapted model, using base', e);
    }
    return JSON.parse(JSON.stringify(baseModel));
};

export const retrainModelOnCorrection = async (text: string, newIntent: string) => {
    try {
        const model = await getAdaptedModel();

        // Ensure intent exists
        if (!model.intents.includes(newIntent)) {
            model.intents.push(newIntent);
            model.intent_probs[newIntent] = 0.01;
            model.word_probs[newIntent] = {};
        }

        // 1. Boost Intent Probability Globally
        model.intent_probs[newIntent] *= 1.2;

        // 2. Boost Specific Words
        const words = text.toLowerCase().match(/\w+/g) || [];
        for (const word of words) {
            if (!model.word_probs[newIntent]) {
                model.word_probs[newIntent] = {};
            }

            if (model.word_probs[newIntent][word]) {
                model.word_probs[newIntent][word] *= 1.5; // Boost significantly
            } else {
                model.word_probs[newIntent][word] = 0.05; // Add new vocabulary
            }

            // Contrast: Slightly decay this word in other intents so it becomes highly discriminative
            for (const intent of model.intents) {
                if (intent !== newIntent && model.word_probs[intent] && model.word_probs[intent][word]) {
                    model.word_probs[intent][word] *= 0.85;
                }
            }
        }

        // Save back to AsyncStorage to persist the local learning
        await AsyncStorage.setItem(MODEL_WEIGHTS_KEY, JSON.stringify(model));
        console.log(`[ML] Model successfully retrained locally! Learned pattern for intent: ${newIntent}`);
        return true;
    } catch (error) {
        console.error('[ML] Error retraining model on device:', error);
        return false;
    }
};

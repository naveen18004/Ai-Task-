import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import * as DocumentPicker from 'expo-document-picker';
import { parseTaskText } from "../../src/ai/taskParser";
import { transcribeAudioWithGroq } from "../../src/ai/groqAudio";
import { MLRawTask } from "../../src/ai/mlParser";
import { addOfflineTaskToCalendar } from "../../src/utils/calendar";
import { getApiKey, getGroqApiKey } from "../../src/storage/asyncStorage";

export default function VoiceTab() {
    const [isProcessing, setIsProcessing] = useState(false);
    const [extractedTasks, setExtractedTasks] = useState<MLRawTask[]>([]);
    const [rawText, setRawText] = useState("");

    const handleImportAudio = async () => {
        const apiKey = await getApiKey();
        if (!apiKey) {
            Alert.alert("API Key Missing", "Please add your Gemini API Key in the Settings tab first.");
            return;
        }

        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['audio/*'],
                copyToCacheDirectory: true,
            });

            if (result.canceled || !result.assets || result.assets.length === 0) {
                return;
            }

            setIsProcessing(true);
            setExtractedTasks([]);
            setRawText("");

            const groqApiKey = await getGroqApiKey();

            if (!groqApiKey) {
                Alert.alert("Missing Groq API Key", "Please set your free Groq API Key in the Settings tab to use voice transcription.");
                setIsProcessing(false);
                return;
            }

            const fileUri = result.assets[0].uri;
            const mimeType = result.assets[0].mimeType || 'audio/mp3';

            // 1. Send the file URI directly to Groq for ultra-fast Whisper transcription
            console.log('Sending audio to Groq API...');
            const transcribedText = await transcribeAudioWithGroq(fileUri, mimeType, groqApiKey);

            if (!transcribedText || transcribedText.trim().length === 0) {
                Alert.alert("No Speech Detected", "Groq could not hear any speech in the audio file.");
                setIsProcessing(false);
                return;
            }

            // 2. We use the local rule-based NLP to avoid hitting the Gemini text rate limit
            console.log('Parsing tasks offline...');
            const parsed = parseTaskText(transcribedText);

            setRawText(transcribedText);
            setExtractedTasks([{
                text: transcribedText,
                intent: parsed.intent,
                date: parsed.date,
                time: parsed.time,
                priority: parsed.priority,
                category: parsed.category,
            }]);

        } catch (error: any) {
            console.error(error);
            Alert.alert("Error", error.message || "Failed to process the audio file.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAddToCalendar = async (task: MLRawTask) => {
        // Reusing the native calendar utility
        await addOfflineTaskToCalendar({
            text: task.text,
            intent: task.intent,
            date: task.date || "",
            time: task.time || "",
            priority: task.priority as any
        });
    };

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>Voice Tasks</Text>
                    <Text style={styles.subtitle}>Powered by Gemini 2.0 Flash</Text>
                </View>

                <TouchableOpacity
                    style={styles.importBtn}
                    onPress={handleImportAudio}
                    disabled={isProcessing}
                >
                    {isProcessing ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.importBtnText}>Import Call Recording</Text>
                    )}
                </TouchableOpacity>

                {isProcessing && (
                    <View style={styles.loadingContainer}>
                        <Text style={styles.processingText}>Gemini is listening to your audio...</Text>
                        <Text style={styles.processingSubText}>(This is fast, but larger files take a few seconds)</Text>
                    </View>
                )}

                {rawText ? (
                    <View style={styles.transcriptionBox}>
                        <Text style={styles.sectionTitle}>Transcription:</Text>
                        <Text style={styles.transcriptionText}>{rawText}</Text>
                    </View>
                ) : null}

                {extractedTasks.length > 0 && (
                    <View style={styles.tasksContainer}>
                        <Text style={styles.sectionTitle}>Detected Tasks</Text>
                        {extractedTasks.map((task, index) => (
                            <View key={index} style={styles.taskCard}>
                                <View style={styles.taskHeader}>
                                    <View style={[styles.badge, styles.intentBadge]}>
                                        <Text style={styles.badgeText}>{task.intent.toUpperCase()}</Text>
                                    </View>
                                    <View style={[styles.badge, task.priority === 'high' ? styles.highBadge : styles.lowBadge]}>
                                        <Text style={styles.badgeText}>{task.priority.toUpperCase()}</Text>
                                    </View>
                                </View>

                                <Text style={styles.taskText}>{task.text}</Text>

                                {(task.date || task.time) && (
                                    <Text style={styles.dateTimeText}>📅 {task.date} ⏰ {task.time}</Text>
                                )}

                                <TouchableOpacity
                                    style={styles.calendarBtn}
                                    onPress={() => handleAddToCalendar(task)}
                                >
                                    <Text style={styles.calendarBtnText}>+ Add to Device Calendar</Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#F6F7FB" },
    container: { padding: 20 },
    header: { marginBottom: 30 },
    title: { fontSize: 28, fontWeight: "700", color: "#1F2937" },
    subtitle: { fontSize: 16, color: "#6B7280", marginTop: 4 },

    importBtn: {
        backgroundColor: "#2563EB",
        padding: 16,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#2563EB",
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    importBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
    loadingContainer: { marginTop: 16, alignItems: 'center' },
    processingText: { textAlign: "center", color: "#4B5563", fontWeight: '600' },
    processingSubText: { textAlign: "center", color: "#9CA3AF", fontSize: 12, marginTop: 4 },

    transcriptionBox: {
        marginTop: 24,
        backgroundColor: "#DBEAFE",
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#BFDBFE"
    },
    sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 12, color: "#1E3A8A" },
    transcriptionText: { color: "#1E40AF", lineHeight: 22, fontStyle: 'italic' },

    tasksContainer: { marginTop: 24 },
    taskCard: {
        backgroundColor: "#fff",
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
        borderLeftWidth: 4,
        borderLeftColor: "#2563EB"
    },
    taskHeader: { flexDirection: "row", gap: 8, marginBottom: 12 },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    intentBadge: { backgroundColor: "#F3F4F6" },
    highBadge: { backgroundColor: "#FEE2E2" },
    lowBadge: { backgroundColor: "#D1FAE5" },
    badgeText: { fontSize: 12, fontWeight: "700", color: "#374151" },
    taskText: { fontSize: 16, fontWeight: "500", color: "#111827", marginBottom: 8 },
    dateTimeText: { fontSize: 14, color: "#6B7280", marginBottom: 16 },

    calendarBtn: {
        backgroundColor: "#10B981",
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: "center",
    },
    calendarBtnText: { color: "#fff", fontWeight: "600" }
});

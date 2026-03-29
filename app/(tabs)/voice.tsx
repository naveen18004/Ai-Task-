import * as DocumentPicker from 'expo-document-picker';
import { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { parseTaskWithFallback } from "../../src/ai/fallbackParser";
import { extractTasksFromText } from "../../src/ai/geminiAudio";
import { transcribeAudioWithGroq } from "../../src/ai/groqAudio";
import { MLRawTask } from "../../src/ai/mlParser";
import { getApiKey, getGroqApiKey } from "../../src/storage/asyncStorage";
import { addOfflineTaskToCalendar } from "../../src/utils/calendar";

export default function VoiceTab() {
    const [isProcessing, setIsProcessing] = useState(false);
    const [extractedTasks, setExtractedTasks] = useState<MLRawTask[]>([]);
    const [rawText, setRawText] = useState("");

    const handleImportAudio = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['audio/*'],
                copyToCacheDirectory: true,
            });

            if (result.canceled || !result.assets || result.assets.length === 0) {
                return;
            }

            setRawText("");
            setExtractedTasks([]);

            const fileUri = result.assets[0].uri;
            const mimeType = result.assets[0].mimeType || 'audio/mp3';

            await processAudioFile(fileUri, mimeType);
        } catch (error: any) {
            console.error(error);
            Alert.alert("Error", error.message || "Failed to process the audio file.");
        }
    };

    const processAudioFile = async (fileUri: string, mimeType: string) => {
        const apiKey = await getApiKey();
        const groqApiKey = await getGroqApiKey();

        if (!groqApiKey) {
            Alert.alert("Missing API Key", "You need a Voice Transcription Code from Groq (in Settings) to use Voice inside Expo Go.");
            return;
        }

        setIsProcessing(true);

        const runFallback = async (text: string) => {
            let textToSplit = text.replace(/([.?!])\s+([A-Z])/g, "$1|SPLIT|$2");
            textToSplit = textToSplit.replace(/(^|\s+)(\d+\.\s)/g, "$1|SPLIT|$2");
            textToSplit = textToSplit.replace(/(^|\s+)([•\-*]\s)/g, "$1|SPLIT|$2");
            const parts = textToSplit.split('|SPLIT|').map(p => p.trim()).filter(Boolean);
            const fallbackTasks: MLRawTask[] = [];
            for (const p of parts) {
                const parsed = await parseTaskWithFallback(p);
                if (parsed) {
                    fallbackTasks.push({
                        text: parsed.text || p, intent: parsed.intent, date: parsed.date, time: parsed.time, priority: parsed.priority as any, category: parsed.category
                    });
                }
            }
            setExtractedTasks(fallbackTasks);
        };

        try {
            // 1. Send the file URI directly to Groq for ultra-fast Whisper transcription
            console.log('Sending audio to Groq API...');
            const transcribedText = await transcribeAudioWithGroq(fileUri, mimeType, groqApiKey);

            if (!transcribedText || transcribedText.trim().length === 0) {
                Alert.alert("No Speech Detected", "Groq could not hear any speech in the audio file.");
                return;
            }

            setRawText(transcribedText);

            if (apiKey) {
                // 2. Use Gemini Text extractor to parse multiple tasks accurately
                console.log('Parsing tasks with Gemini...');
                try {
                    const extractionResult = await extractTasksFromText(transcribedText, apiKey);
                    setExtractedTasks(extractionResult.tasks);
                } catch (err) {
                    // Fallback to offline parser if Gemini fails (e.g. rate limit)
                    console.log('Falling back to offline parser...', err);
                    await runFallback(transcribedText);
                }
            } else {
                console.log('No Gemini API - Using fully offline parser');
                await runFallback(transcribedText);
            }

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
            category: task.category || "General",
            priority: task.priority as any
        });
    };

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.subtitle}>Transcription</Text>
                    <Text style={styles.title}>Voice Tasks</Text>
                </View>

                <View style={styles.recordContainer}>
                    <TouchableOpacity
                        style={styles.importBtn}
                        onPress={handleImportAudio}
                        disabled={isProcessing}
                        activeOpacity={0.8}
                    >
                        {isProcessing ? (
                            <ActivityIndicator color="#6366F1" />
                        ) : (
                            <View style={styles.btnContent}>
                                <Text style={styles.importBtnText}>
                                    📁 Import Audio File
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                {isProcessing && (
                    <View style={styles.loadingContainer}>
                        <Text style={styles.processingText}>Groq is processing your audio...</Text>
                        <Text style={styles.processingSubText}>(This is fast, but larger files take a few seconds)</Text>
                    </View>
                )}

                {rawText ? (
                    <View style={styles.transcriptionBox}>
                        <Text style={styles.sectionTitle}>Raw Transcript</Text>
                        <Text style={styles.transcriptionText}>{rawText}</Text>
                    </View>
                ) : null}

                {extractedTasks.length > 0 && (
                    <View style={styles.tasksContainer}>
                        <Text style={styles.sectionTitleBlack}>Detected Tasks</Text>
                        {extractedTasks.map((task, index) => (
                            <View key={index} style={styles.taskCard}>
                                <View style={styles.taskHeader}>
                                    <View style={[styles.badge, styles.intentBadge]}>
                                        <Text style={styles.badgeTextDark}>{task.intent.toUpperCase()}</Text>
                                    </View>
                                    <View style={[styles.badge, task.priority === 'high' ? styles.highBadge : styles.lowBadge]}>
                                        <Text style={[styles.badgeTextDark, task.priority === 'high' ? styles.badgeTextRed : styles.badgeTextGreen]}>
                                            {task.priority.toUpperCase()}
                                        </Text>
                                    </View>
                                </View>

                                <Text style={styles.taskText}>{task.text}</Text>

                                {(task.date || task.time) && (
                                    <View style={styles.metricsRow}>
                                        {task.date && <Text style={styles.metricPill}>📅 {task.date}</Text>}
                                        {task.time && <Text style={styles.metricPill}>⏰ {task.time}</Text>}
                                    </View>
                                )}

                                <TouchableOpacity
                                    style={styles.calendarBtn}
                                    onPress={() => handleAddToCalendar(task)}
                                    activeOpacity={0.8}
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
    safe: { flex: 1, backgroundColor: "#F8FAFC" },
    container: { padding: 24, paddingBottom: 60 },
    header: { marginBottom: 32, marginTop: 16 },
    subtitle: {
        fontSize: 14,
        fontWeight: "600",
        color: "#94A3B8",
        textTransform: "uppercase",
        letterSpacing: 1.2,
        marginBottom: 4
    },
    title: {
        fontSize: 32,
        fontWeight: "800",
        color: "#0F172A",
        letterSpacing: -0.5
    },

    recordContainer: {
        gap: 16,
    },
    recordBtn: {
        backgroundColor: "#EF4444",
        padding: 18,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#EF4444",
        shadowOpacity: 0.3,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 6,
    },
    recordBtnActive: {
        backgroundColor: "#B91C1C",
    },
    recordBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700", letterSpacing: 0.5 },
    redDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: "#FFFFFF",
        marginRight: 4,
    },
    orText: {
        textAlign: 'center',
        color: '#94A3B8',
        fontWeight: '600',
        marginVertical: 4
    },
    importBtn: {
        backgroundColor: "#EEF2FF",
        borderWidth: 1,
        borderColor: "#C7D2FE",
        padding: 16,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
    },
    disabledBtn: {
        opacity: 0.6
    },
    btnContent: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    importBtnText: { color: "#6366F1", fontSize: 16, fontWeight: "700", letterSpacing: 0.5 },
    disabledText: { color: "#94A3B8" },

    loadingContainer: { marginTop: 24, alignItems: 'center' },
    processingText: { textAlign: "center", color: "#64748B", fontWeight: '600', fontSize: 15 },
    processingSubText: { textAlign: "center", color: "#94A3B8", fontSize: 13, marginTop: 6 },

    transcriptionBox: {
        marginTop: 32,
        backgroundColor: "#F1F5F9",
        padding: 24,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: "#E2E8F0"
    },
    sectionTitle: { fontSize: 14, fontWeight: "700", marginBottom: 16, color: "#64748B", textTransform: 'uppercase', letterSpacing: 1 },
    sectionTitleBlack: { fontSize: 18, fontWeight: "700", marginBottom: 16, color: "#0F172A" },
    transcriptionText: { color: "#334155", lineHeight: 28, fontStyle: 'italic', fontSize: 16 },

    tasksContainer: { marginTop: 32 },
    taskCard: {
        backgroundColor: "#FFFFFF",
        padding: 24,
        borderRadius: 24,
        marginBottom: 16,
        shadowColor: "#64748B",
        shadowOpacity: 0.08,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 3,
        borderWidth: 1,
        borderColor: "#F1F5F9",
    },
    taskHeader: { flexDirection: "row", gap: 8, marginBottom: 16 },
    badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    intentBadge: { backgroundColor: "#EEF2FF" },
    highBadge: { backgroundColor: "#FEF2F2" },
    lowBadge: { backgroundColor: "#ECFDF5" },
    badgeTextDark: { fontSize: 12, fontWeight: "800", color: "#6366F1", textTransform: 'uppercase', letterSpacing: 0.5 },
    badgeTextRed: { color: "#EF4444" },
    badgeTextGreen: { color: "#10B981" },

    taskText: { fontSize: 18, fontWeight: "600", color: "#0F172A", marginBottom: 16, lineHeight: 26 },

    metricsRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
    metricPill: {
        fontSize: 13,
        fontWeight: "600",
        color: "#475569",
        backgroundColor: "#F8FAFC",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "#F1F5F9",
    },

    calendarBtn: {
        backgroundColor: "#F1F5F9",
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: "center",
    },
    calendarBtnText: { color: "#0F172A", fontWeight: "700", fontSize: 14 }
});

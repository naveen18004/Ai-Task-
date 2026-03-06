import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ScrollView } from "react-native";
import { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import * as Clipboard from "expo-clipboard";
import { parseTaskWithFallback } from "@/src/ai/fallbackParser";
import { saveTaskStr, getApiKey } from "@/src/storage/asyncStorage";
import { extractTasksWithML } from "@/src/ai/mlParser";
import { extractTasksFromImage } from "@/src/ai/geminiVision";
import { scheduleReminder } from "@/src/notifications/notificationService";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

export default function OCRScreen() {
    const [image, setImage] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [extractedText, setExtractedText] = useState("");

    const pickImage = async () => {
        // Request permission
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (permissionResult.granted === false) {
            Alert.alert("Permission required", "You need to allow access to your photos to scan tasks.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: false,
            quality: 0.3, // Lower quality to keep under OCR API's 1MB limit
            base64: true,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
            if (result.assets[0].base64) {
                processOCR(result.assets[0].base64);
            } else {
                Alert.alert("Error", "Could not get image data.");
            }
        }
    };

    const processOCR = async (base64string: string) => {
        setIsProcessing(true);
        setExtractedText("");

        try {
            const apiKey = await getApiKey();

            // ── PRIMARY: Gemini Vision (reads image + extracts tasks in one call) ──
            if (apiKey) {
                try {
                    console.log('Using Gemini Vision for OCR...');
                    const result = await extractTasksFromImage(base64string, apiKey);
                    setExtractedText(result.extractedText);

                    let tasksAdded = 0;
                    for (const task of result.tasks) {
                        const saved = await saveTaskStr({
                            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                            text: task.text, intent: task.intent, category: task.category,
                            date: task.date, time: task.time, priority: task.priority,
                            location: task.location,
                            createdAt: new Date().toISOString()
                        });

                        if (saved) {
                            if (task.date && task.time) {
                                const normalizedTime = task.time.replace(/^(\d{1,2})\s?(AM|PM)$/i, '$1:00 $2');
                                const timeMatch = normalizedTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
                                const baseDateMs = new Date(task.date).setHours(0, 0, 0, 0);
                                if (timeMatch && !isNaN(baseDateMs)) {
                                    let h = parseInt(timeMatch[1]), m = parseInt(timeMatch[2]);
                                    const period = (timeMatch[3] || '').toUpperCase();
                                    if (period === 'PM' && h !== 12) h += 12;
                                    if (period === 'AM' && h === 12) h = 0;
                                    const base = new Date(baseDateMs);
                                    const rd = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0);
                                    if (rd > new Date()) await scheduleReminder('OCR Task Reminder', task.text, rd);
                                }
                            }
                            tasksAdded++;
                        }
                    }

                    if (tasksAdded > 0) {
                        Alert.alert('OCR Success', `Gemini Vision extracted ${tasksAdded} task(s) from the image!`);
                    } else {
                        Alert.alert('No Tasks Found', 'Gemini Vision could not find actionable tasks in this image.');
                    }
                    return;
                } catch (geminiError: any) {
                    console.warn('Primary scanner failed, falling back to basic OCR.');
                    // Fall through to ocr.space fallback below
                }
            }

            // ── FALLBACK: Free ocr.space API (no API key needed) ──
            console.log('No API key found, using free OCR.space API...');
            const formData = new FormData();
            formData.append('base64Image', `data:image/jpeg;base64,${base64string}`);
            formData.append('apikey', 'helloworld');
            formData.append('language', 'eng');
            formData.append('isOverlayRequired', 'false');

            const response = await fetch('https://api.ocr.space/parse/image', {
                method: 'POST',
                body: formData,
            });

            const json = await response.json();
            console.log('OCR API Response:', JSON.stringify(json).substring(0, 500));

            if (json.IsErroredOnProcessing || !json.ParsedResults || json.ParsedResults.length === 0) {
                const errorMsg = json.ErrorMessage?.[0] || json.ErrorMessage || 'OCR Failed';
                throw new Error(typeof errorMsg === 'string' ? errorMsg : 'OCR Failed to read text');
            }

            const extracted = json.ParsedResults[0].ParsedText as string;
            const lines = extracted.split(/\r?\n/);

            let blocks: string[] = [];
            let currentBlock: string[] = [];

            for (const line of lines) {
                let trimmed = line.trim();

                // 1. Noise filtering (skip completely)
                if (trimmed.length < 4) {
                    if (currentBlock.length > 0) { blocks.push(currentBlock.join(' ')); currentBlock = []; }
                    continue;
                }
                if (/^[0-9+\-\s()\/]+$/.test(trimmed)) {
                    if (currentBlock.length > 0) { blocks.push(currentBlock.join(' ')); currentBlock = []; }
                    continue;
                }
                if (/^(message yourself|message|type a message|you|today|yesterday|tomorrow)$/i.test(trimmed)) {
                    if (currentBlock.length > 0) { blocks.push(currentBlock.join(' ')); currentBlock = []; }
                    continue;
                }
                if (trimmed.length > 10 && trimmed.split(/\s+/).length <= 2 && /[A-Z].*[a-z].*\d/.test(trimmed)) continue;

                // 2. Delimiter detection (flush current block)
                const isTimestampLine = /^\d{1,2}:\d{2}\s*(am|pm)?\s*[a-zA-Z\/'"\.\s]*$/i.test(trimmed);
                const isDateDelimiter = /^[a-zA-Z]+\s+\d{1,2},?\s+\d{4}$/.test(trimmed) || /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(trimmed);

                if (isTimestampLine || isDateDelimiter) {
                    if (currentBlock.length > 0) {
                        blocks.push(currentBlock.join(' '));
                        currentBlock = [];
                    }
                    continue; // skip the pure timestamp line
                }

                // Clean up inline timestamps like "1:59 PM V/" at the end of a line
                trimmed = trimmed.replace(/\s+\d{1,2}:\d{2}\s*(am|pm)?\s*[a-zA-Z\/'"\.\s]*$/i, '');

                currentBlock.push(trimmed);
            }
            if (currentBlock.length > 0) {
                blocks.push(currentBlock.join(' '));
            }

            let tasksAdded = 0;
            const validTasks: string[] = [];

            for (let block of blocks) {
                // Correct common OCR typos
                block = block.replace(/\b(\d)\s*[oO]\b/g, '$10');
                block = block.replace(/\b[oO]\s*(am|pm)\b/ig, '0$1');

                const lower = block.toLowerCase();
                const hasTaskKeyword = /\b(submit|remind|meeting|test|exam|deadline|assignment|homework|project|report|finish|complete|attend|prepare|review|schedule|appointment|doctor|pick\s?up|grocery|groceries|pay|clean|cook|study|visit)\b/i.test(lower);

                if (!hasTaskKeyword) continue;
                if (block.length < 10 || block.split(' ').length < 3) continue;

                const parsed = await parseTaskWithFallback(block);
                if (!parsed) continue;

                const saved = await saveTaskStr({
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                    text: parsed.text || block,
                    intent: parsed.intent,
                    category: parsed.category,
                    date: parsed.date,
                    time: parsed.time,
                    priority: parsed.priority,
                    location: parsed.location,
                    createdAt: new Date().toISOString()
                });

                if (saved) {
                    validTasks.push(block);
                    tasksAdded++;
                }
            }

            setExtractedText(validTasks.join('\n\n'));

            if (tasksAdded > 0) {
                Alert.alert('OCR Success', `Extracted ${tasksAdded} task(s). For better results, add an Activation Code in Settings!`);
            } else {
                Alert.alert('No Tasks Found', 'Add an Activation Code in Settings for much better image scanning!');
            }
        } catch (error: any) {
            console.error('OCR Error:', error);
            Alert.alert('Scanner Error', 'The image scanner is currently busy. Please try another image or import from the clipboard instead.');
        } finally {
            setIsProcessing(false);
        }
    };

    const pasteFromClipboard = async () => {
        const text = await Clipboard.getStringAsync();
        if (!text || text.trim() === '') {
            Alert.alert('Clipboard Empty', 'Nothing was found in the clipboard. Copy some text first!');
            return;
        }
        setIsProcessing(true);
        try {
            const apiKey = await getApiKey();
            if (apiKey) {
                const mlTasks = await extractTasksWithML(text, apiKey);
                for (const task of mlTasks) {
                    const saved = await saveTaskStr({
                        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                        text: task.text, intent: task.intent, category: task.category,
                        date: task.date, time: task.time, priority: task.priority,
                        location: task.location,
                        createdAt: new Date().toISOString()
                    });
                    if (saved) {
                        if (task.date && task.time) {
                            const normalizedTime = task.time.replace(/^(\d{1,2})\s?(AM|PM)$/i, '$1:00 $2');
                            const timeMatch = normalizedTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
                            const baseDateMs = new Date(task.date).setHours(0, 0, 0, 0);
                            if (timeMatch && !isNaN(baseDateMs)) {
                                let h = parseInt(timeMatch[1]), m = parseInt(timeMatch[2]);
                                const period = (timeMatch[3] || '').toUpperCase();
                                if (period === 'PM' && h !== 12) h += 12;
                                if (period === 'AM' && h === 12) h = 0;
                                const base = new Date(baseDateMs);
                                const rd = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0);
                                if (rd > new Date()) await scheduleReminder('Clipboard Task', task.text, rd);
                            }
                        }
                    }
                }
                Alert.alert('Clipboard Imported', `ML extracted ${mlTasks.length} task(s) from clipboard!`);
                return;
            }
            // Fallback: rule-based
            const lines = text.split('\n').filter(l => l.trim().length > 3);
            const strictKeywords = /\b(submit|remind|meeting|test|exam|deadline|assignment|homework|project|report|finish|complete|attend|prepare|review|schedule|appointment|doctor|pick\s?up|grocery|groceries|pay|clean|cook|study|visit)\b/i;

            let added = 0;
            for (const line of lines) {
                if (!strictKeywords.test(line) || line.split(' ').length < 3) continue;
                const parsed = await parseTaskWithFallback(line);
                if (!parsed) continue;

                const saved = await saveTaskStr({
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                    text: parsed.text || line.trim(), intent: parsed.intent, category: parsed.category,
                    date: parsed.date, time: parsed.time, priority: parsed.priority,
                    location: parsed.location,
                    createdAt: new Date().toISOString()
                });
                if (saved) {
                    if (parsed.date && parsed.time) {
                        const normalizedTime = parsed.time.replace(/^(\d{1,2})\s?(AM|PM)$/i, '$1:00 $2');
                        const timeMatch = normalizedTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
                        const baseDateMs = new Date(parsed.date).setHours(0, 0, 0, 0);
                        if (timeMatch && !isNaN(baseDateMs)) {
                            let h = parseInt(timeMatch[1]), m = parseInt(timeMatch[2]);
                            const period = (timeMatch[3] || '').toUpperCase();
                            if (period === 'PM' && h !== 12) h += 12;
                            if (period === 'AM' && h === 12) h = 0;
                            const base = new Date(baseDateMs);
                            const rd = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0);
                            if (rd > new Date()) await scheduleReminder('Clipboard Task', line.trim(), rd);
                        }
                    }
                    added++;
                }
            }
            Alert.alert('Clipboard Imported', `Added ${added} task(s) from clipboard!`);
        } catch (e) {
            Alert.alert('Error', 'Failed to read clipboard text.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.header}>
                <Text style={styles.subtitle}>Smart Import</Text>
                <Text style={styles.title}>AI Scanner</Text>
            </View>

            <View style={styles.actionCards}>
                <TouchableOpacity style={styles.btnAction} onPress={pickImage} activeOpacity={0.8}>
                    <LinearGradient
                        colors={["#0EA5E9", "#2563EB"]}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={styles.gradientBg}
                    >
                        <Ionicons name="image-outline" size={32} color="#FFF" style={styles.btnIcon} />
                        <Text style={styles.btnTextPrimary}>Scan from Gallery</Text>
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.btnAction} onPress={pasteFromClipboard} disabled={isProcessing} activeOpacity={0.8}>
                    <LinearGradient
                        colors={["#8B5CF6", "#6D28D9"]}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={styles.gradientBg}
                    >
                        <Ionicons name="clipboard-outline" size={32} color="#FFF" style={styles.btnIcon} />
                        <Text style={styles.btnTextPrimary}>Import from Clipboard</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            {image && (
                <View style={styles.imageWrapper}>
                    <Image source={{ uri: image }} style={styles.previewImage} />
                </View>
            )}

            {isProcessing && (
                <View style={styles.loadingState}>
                    <Ionicons name="sparkles" size={40} color="#D97706" />
                    <Text style={styles.processingText}>Extracting Magic...</Text>
                </View>
            )}

            {extractedText ? (
                <View style={styles.resultContainer}>
                    <Text style={styles.resultTitle}>Extracted Action Items</Text>
                    <Text style={styles.resultText}>{extractedText}</Text>
                </View>
            ) : null}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        padding: 24,
        backgroundColor: "#F8FAFC",
        paddingTop: 60,
    },
    header: {
        marginBottom: 32,
    },
    subtitle: {
        fontSize: 14,
        fontWeight: "700",
        color: "#94A3B8",
        textTransform: "uppercase",
        letterSpacing: 1.5,
        marginBottom: 4,
    },
    title: {
        fontSize: 34,
        fontWeight: "800",
        color: "#0F172A",
        letterSpacing: -1,
    },
    actionCards: {
        gap: 16,
        marginBottom: 32,
    },
    btnAction: {
        borderRadius: 20,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 15,
        shadowOffset: { width: 0, height: 8 },
        elevation: 6,
    },
    gradientBg: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 20,
        paddingHorizontal: 24,
    },
    btnIcon: {
        marginRight: 16,
    },
    btnTextPrimary: {
        color: "#fff",
        fontWeight: "800",
        fontSize: 18,
        letterSpacing: -0.5,
    },
    imageWrapper: {
        borderRadius: 24,
        overflow: "hidden",
        marginBottom: 24,
        shadowColor: "#64748B",
        shadowOpacity: 0.15,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
        elevation: 5,
    },
    previewImage: {
        width: "100%",
        height: 250,
        resizeMode: "cover",
    },
    loadingState: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 40,
    },
    processingText: {
        fontSize: 18,
        color: "#D97706",
        fontWeight: "700",
        marginTop: 16,
        letterSpacing: -0.5,
    },
    resultContainer: {
        width: "100%",
        backgroundColor: "#FFFFFF",
        padding: 24,
        borderRadius: 24,
        marginTop: 16,
        shadowColor: "#64748B",
        shadowOpacity: 0.08,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 4,
        borderWidth: 1,
        borderColor: "#F1F5F9",
    },
    resultTitle: {
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 12,
        color: "#0F172A",
        letterSpacing: -0.5,
    },
    resultText: {
        fontSize: 15,
        color: "#475569",
        lineHeight: 24,
    }
});

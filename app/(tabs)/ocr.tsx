import { parseTaskWithFallback } from "@/src/ai/fallbackParser";
import { extractTasksFromImage } from "@/src/ai/geminiVision";
import { extractTasksWithML } from "@/src/ai/mlParser";
import { scheduleReminder } from "@/src/notifications/notificationService";
import { getApiKey, saveTaskStr } from "@/src/storage/asyncStorage";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function OCRScreen() {
    const [images, setImages] = useState<string[]>([]);
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
            allowsMultipleSelection: true,
            quality: 0.3, // Lower quality to keep under OCR API's 1MB limit
            base64: true,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const uris = result.assets.map(a => a.uri);
            const base64s = result.assets.map(a => a.base64).filter(Boolean) as string[];
            setImages(uris);

            if (base64s.length > 0) {
                processOCR(base64s);
            } else {
                Alert.alert("Error", "Could not get image data.");
            }
        }
    };

    const processOCR = async (base64strings: string[]) => {
        setIsProcessing(true);
        setExtractedText("");

        try {
            const apiKey = await getApiKey();

            // ── PRIMARY: Gemini Vision (reads image + extracts tasks in one call) ──
            if (apiKey) {
                try {
                    console.log(`Using Gemini Vision for OCR on ${base64strings.length} images...`);
                    const result = await extractTasksFromImage(base64strings, apiKey);
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

            let allExtracted = "";
            for (const b64 of base64strings) {
                const formData = new FormData();
                formData.append('base64Image', `data:image/jpeg;base64,${b64}`);
                formData.append('apikey', 'helloworld');
                formData.append('language', 'eng');
                formData.append('isOverlayRequired', 'false');

                const response = await fetch('https://api.ocr.space/parse/image', {
                    method: 'POST',
                    body: formData,
                });

                const json = await response.json();

                if (!json.IsErroredOnProcessing && json.ParsedResults && json.ParsedResults.length > 0) {
                    allExtracted += json.ParsedResults[0].ParsedText + "\n";
                }
            }

            if (!allExtracted.trim()) {
                throw new Error('OCR Failed to read text from any images');
            }

            const lines = allExtracted.split(/\r?\n/);

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
                // Skip random hash strings (API keys, tokens, encoded IDs) WITHOUT stripping spaces, which would accidentally destroy valid unpunctuated sentences
                if (/^[A-Za-z0-9_\-]{20,}$/.test(trimmed)) {
                    if (currentBlock.length > 0) { blocks.push(currentBlock.join(' ')); currentBlock = []; }
                    continue;
                }
                // Skip lines that are mostly non-alphabetic (like hash fragments mixed with short words)
                const alphaRatio = (trimmed.match(/[a-zA-Z]/g) || []).length / trimmed.length;
                const hasLongNonSpaceChunk = trimmed.split(/\s+/).some((w: string) => w.length > 15 && /[A-Z].*[a-z].*\d/.test(w));
                if (hasLongNonSpaceChunk) {
                    if (currentBlock.length > 0) { blocks.push(currentBlock.join(' ')); currentBlock = []; }
                    continue;
                }
                if (trimmed.length > 10 && trimmed.split(/\s+/).length <= 2 && /[A-Z].*[a-z].*\d/.test(trimmed)) continue;

                // 2. Delimiter detection (flush current block)
                const isTimestampLine = /^\d{1,2}:\d{2}\s*(am|pm)?\s*[a-zA-Z\/'"\.\\s]*$/i.test(trimmed);
                const isDateDelimiter = /^[a-zA-Z]+\s+\d{1,2},?\s+\d{4}$/.test(trimmed) || /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(trimmed);

                if (isTimestampLine || isDateDelimiter) {
                    if (currentBlock.length > 0) {
                        blocks.push(currentBlock.join(' '));
                        currentBlock = [];
                    }
                    continue; // skip the pure timestamp line
                }

                // Clean up inline timestamps like "1:59 PM V/" at the end of a line
                trimmed = trimmed.replace(/\s+\d{1,2}:\d{2}\s*(am|pm)?\s*[a-zA-Z\/'"\.\\s]*$/i, '');
                // Clean up check marks and tick marks
                trimmed = trimmed.replace(/[✓✔☑]/g, '').trim();

                currentBlock.push(trimmed);
            }
            if (currentBlock.length > 0) {
                blocks.push(currentBlock.join(' '));
            }

            let tasksAdded = 0;
            const validTasks: string[] = [];

            const subBlocks: string[] = [];
            for (const b of blocks) {
                let textToSplit = b.replace(/([.?!])\s+([A-Z])/g, "$1|SPLIT|$2");
                textToSplit = textToSplit.replace(/(^|\s+)(\d+\.\s)/g, "$1|SPLIT|$2");
                textToSplit = textToSplit.replace(/(^|\s+)([•\-*]\s)/g, "$1|SPLIT|$2");
                const parts = textToSplit.split('|SPLIT|');
                for (const p of parts) {
                    if (p.trim()) subBlocks.push(p.trim());
                }
            }

            for (let block of subBlocks) {
                // Correct common OCR typos
                block = block.replace(/\b(\d)\s*[oO]\b/g, '$10');
                block = block.replace(/\b[oO]\s*(am|pm)\b/ig, '0$1');
                // Fix split numbers: "1 0am" -> "10am", "4 pm" -> "4pm"
                block = block.replace(/(\d)\s+(0\s*(?:am|pm))/ig, '$1$2');
                block = block.replace(/(\d)\s+(am|pm)/ig, '$1$2');
                // Remove leading noise fragments (hash remnants before actual text)
                block = block.replace(/^[A-Za-z0-9_]{10,}\s*\*?\s*/g, '');

                let lower = block.toLowerCase();

                // Reject obvious files or meaningless fragments
                if (/\.(pdf|jpg|jpeg|png|gif|doc|docx|csv|xlsx|zip)/i.test(lower)) continue;
                if (/^[0-9+\-\s()\/.]+$/.test(lower)) continue;

                // Reject WhatsApp UI artifacts (e.g., Contacts, "Message yourself", phone numbers)
                if (lower.includes('(you)') || lower === 'message' || lower === 'message yourself') continue;
                if (/\b\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b/.test(block) && block.length < 35) continue; // Phone number contact card block

                // Clean up hash artifacts generated by OCR
                block = block.replace(/\b[A-Za-z0-9]+\/[A-Za-z0-9]+\b/g, '').trim();
                lower = block.toLowerCase();

                const hasTaskKeyword = /\b(submit|remind|meet|meeting|test|exam|deadline|assignment|homework|project|report|finish|complete|attend|prepare|review|schedule|appointment|doctor|pick\s?up|grocery|groceries|pay|clean|cook|study|visit|presentation|buy|forget|need|call|email|send|book|draft|go|office|gym|work|class)\b/i.test(lower);
                const hasTimeDate = /\b(tomorrow|today|tonight|am|pm|\d{1,2}:\d{2}|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(lower);

                if (!hasTaskKeyword && !hasTimeDate) continue;
                if (block.length < 5 || block.split(' ').length < 3) continue;

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
                Alert.alert('OCR Success', `Extracted ${tasksAdded} task(s) using offline scanner!`);
            } else {
                Alert.alert('No Tasks Found', 'The scanner could not find actionable tasks in this image.');
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
            const strictKeywords = /\b(submit|remind|meet|meeting|test|exam|deadline|assignment|homework|project|report|finish|complete|attend|prepare|review|schedule|appointment|doctor|pick\s?up|grocery|groceries|pay|clean|cook|study|visit|presentation|buy|forget|need|call|email|send|book|draft|go|office|gym|work|class)\b/i;
            const timeDateKeywords = /\b(tomorrow|today|tonight|am|pm|\d{1,2}:\d{2}|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;

            let added = 0;
            const subLines: string[] = [];
            for (const l of lines) {
                let textToSplit = l.replace(/([.?!])\s+([A-Z])/g, "$1|SPLIT|$2");
                textToSplit = textToSplit.replace(/(^|\s+)(\d+\.\s)/g, "$1|SPLIT|$2");
                textToSplit = textToSplit.replace(/(^|\s+)([•\-*]\s)/g, "$1|SPLIT|$2");
                const parts = textToSplit.split('|SPLIT|');
                for (const p of parts) {
                    if (p.trim()) subLines.push(p.trim());
                }
            }

            for (const line of subLines) {
                const lower = line.toLowerCase();

                if (/\.(pdf|jpg|jpeg|png|gif|doc|docx|csv|xlsx|zip)/i.test(lower)) continue;
                if (/^[0-9+\-\s()\/.]+$/.test(lower)) continue;

                if (!strictKeywords.test(lower) && !timeDateKeywords.test(lower)) continue;
                if (line.split(' ').length < 3) continue;

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

            {images.length > 0 && (
                <View style={styles.imageGallery}>
                    {images.map((uri, index) => (
                        <View key={index} style={styles.imageWrapper}>
                            <Image source={{ uri }} style={styles.previewImage} />
                        </View>
                    ))}
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
    imageGallery: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 24,
    },
    imageWrapper: {
        width: '47%',
        aspectRatio: 1,
        borderRadius: 16,
        overflow: "hidden",
        shadowColor: "#64748B",
        shadowOpacity: 0.15,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 },
        elevation: 5,
    },
    previewImage: {
        width: "100%",
        height: "100%",
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

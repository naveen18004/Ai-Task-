import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView } from "react-native";
import { useState, useEffect } from "react";
import { saveApiKey, getApiKey, saveGroqApiKey, getGroqApiKey } from "@/src/storage/asyncStorage";
import { IconSymbol } from '@/components/ui/icon-symbol';
import { scheduleReminder } from '@/src/notifications/notificationService';

export default function SettingsScreen() {
    const [apiKey, setApiKey] = useState("");
    const [isSaved, setIsSaved] = useState(false);

    const [groqApiKey, setGroqApiKey] = useState("");
    const [isGroqSaved, setIsGroqSaved] = useState(false);

    useEffect(() => {
        const loadKey = async () => {
            const key = await getApiKey();
            if (key) {
                setApiKey(key);
                setIsSaved(true);
            }
            const gKey = await getGroqApiKey();
            if (gKey) {
                setGroqApiKey(gKey);
                setIsGroqSaved(true);
            }
        };
        loadKey();
    }, []);

    const handleSave = async () => {
        if (!apiKey.trim()) {
            Alert.alert("Error", "Please enter a valid API key");
            return;
        }
        await saveApiKey(apiKey.trim());
        setIsSaved(true);
        Alert.alert("Success", "Gemini API Key saved successfully. The ML Model is now active!");
    };

    const handleSaveGroq = async () => {
        if (!groqApiKey.trim()) {
            Alert.alert("Error", "Please enter a valid API key");
            return;
        }
        await saveGroqApiKey(groqApiKey.trim());
        setIsGroqSaved(true);
        Alert.alert("Success", "Groq API Key saved successfully. Unlimited Voice Tasks are now active!");
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.header}>
                <IconSymbol size={40} name="gear" color="#2563EB" />
                <Text style={styles.title}>Settings</Text>
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>ML Model Configuration</Text>
                <Text style={styles.cardSubtitle}>
                    To unlock powerful ML Task Parsing for OCR text, you need to provide a free Google Gemini API Key. This key is stored securely on your local device.
                </Text>

                <TextInput
                    style={styles.input}
                    placeholder="Enter your Gemini API Key..."
                    value={apiKey}
                    onChangeText={(text) => {
                        setApiKey(text);
                        setIsSaved(false);
                    }}
                    secureTextEntry={true}
                    autoCapitalize="none"
                    autoCorrect={false}
                />

                <TouchableOpacity
                    style={[styles.btnPrimary, isSaved && styles.btnSuccess]}
                    onPress={handleSave}
                >
                    <Text style={styles.btnTextPrimary}>
                        {isSaved ? "Saved Successfully" : "Save API Key"}
                    </Text>
                </TouchableOpacity>
                {/* Test Notification Button */}
                <TouchableOpacity
                    style={[styles.btnPrimary]}
                    onPress={async () => {
                        const triggerDate = new Date(Date.now() + 5000);
                        await scheduleReminder('Test Notification', 'This is a test notification', triggerDate);
                        Alert.alert('Test Scheduled', 'Notification will fire in 5 seconds');
                    }}
                >
                    <Text style={styles.btnTextPrimary}>Test Notification</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.linkContainer}
                    onPress={() => Alert.alert("How to get a key", "Go to Google AI Studio (aistudio.google.com), sign in, and click 'Get API Key'. It is completely free!")}
                >
                    <Text style={styles.linkText}>How do I get a free API Key?</Text>
                </TouchableOpacity>
            </View>

            <View style={[styles.card, { marginTop: 20 }]}>
                <Text style={styles.cardTitle}>Free Audio Transcription Config</Text>
                <Text style={styles.cardSubtitle}>
                    To use the "Speak Task" feature without hitting audio generation limits, you need to provide a free Groq API Key.
                </Text>

                <TextInput
                    style={styles.input}
                    placeholder="Enter your Groq API Key..."
                    value={groqApiKey}
                    onChangeText={(text) => {
                        setGroqApiKey(text);
                        setIsGroqSaved(false);
                    }}
                    secureTextEntry={true}
                    autoCapitalize="none"
                    autoCorrect={false}
                />

                <TouchableOpacity
                    style={[styles.btnPrimary, isGroqSaved && styles.btnSuccess]}
                    onPress={handleSaveGroq}
                >
                    <Text style={styles.btnTextPrimary}>
                        {isGroqSaved ? "Saved Successfully" : "Save Groq API Key"}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.linkContainer}
                    onPress={() => Alert.alert("How to get a key", "Go to console.groq.com/keys, sign in, and click 'Create API Key'. It is completely free and requires no credit card!")}
                >
                    <Text style={styles.linkText}>How do I get a free Groq API Key?</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        padding: 24,
        backgroundColor: "#F6F7FB",
        paddingTop: 60,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 30,
    },
    title: {
        fontSize: 28,
        fontWeight: "700",
        marginLeft: 12,
        color: "#1F2937",
    },
    card: {
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 20,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: "#374151",
        marginBottom: 10,
    },
    cardSubtitle: {
        fontSize: 14,
        color: "#6B7280",
        lineHeight: 20,
        marginBottom: 20,
    },
    input: {
        backgroundColor: "#F3F4F6",
        padding: 14,
        borderRadius: 10,
        fontSize: 16,
        color: "#1F2937",
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#E5E7EB",
    },
    btnPrimary: {
        backgroundColor: "#2563EB",
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: "center",
        marginBottom: 16,
    },
    btnSuccess: {
        backgroundColor: "#10B981",
    },
    btnTextPrimary: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 16,
    },
    linkContainer: {
        alignItems: "center",
    },
    linkText: {
        color: "#3B82F6",
        fontSize: 14,
        fontWeight: "500",
    }
});

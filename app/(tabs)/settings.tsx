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
            Alert.alert("Error", "Please enter a valid key");
            return;
        }
        await saveApiKey(apiKey.trim());
        setIsSaved(true);
        Alert.alert("Success", "Activation Code saved successfully. The Feature is now active!");
    };

    const handleSaveGroq = async () => {
        if (!groqApiKey.trim()) {
            Alert.alert("Error", "Please enter a valid key");
            return;
        }
        await saveGroqApiKey(groqApiKey.trim());
        setIsGroqSaved(true);
        Alert.alert("Success", "Voice Transcription Code saved successfully. Unlimited Voice Tasks are now active!");
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.header}>
                <View style={styles.iconWrapper}>
                    <IconSymbol size={28} name="gear" color="#FFFFFF" />
                </View>
                <View>
                    <Text style={styles.subtitle}>Configuration</Text>
                    <Text style={styles.title}>Settings</Text>
                </View>
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>ML Model Configuration</Text>
                <Text style={styles.cardSubtitle}>
                    To unlock powerful parsing for OCR text, you need to provide a free Activation Code. This code is stored securely on your local device.
                </Text>

                <TextInput
                    style={styles.input}
                    placeholder="Enter your Activation Code..."
                    placeholderTextColor="#94A3B8"
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
                    activeOpacity={0.8}
                >
                    <Text style={styles.btnTextPrimary}>
                        {isSaved ? "✓ Saved Successfully" : "Save Code"}
                    </Text>
                </TouchableOpacity>

                {/* Test Notification Button */}
                <TouchableOpacity
                    style={[styles.btnSecondary]}
                    onPress={async () => {
                        const triggerDate = new Date(Date.now() + 5000);
                        await scheduleReminder('Test Notification', 'This is a test notification', triggerDate);
                        Alert.alert('Test Scheduled', 'Notification will fire in 5 seconds');
                    }}
                    activeOpacity={0.8}
                >
                    <Text style={styles.btnTextSecondary}>Test Notification</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.linkContainer}
                    onPress={() => Alert.alert("How to get a code", "Go to Google AI Studio (aistudio.google.com), sign in, and create your code. It is completely free!")}
                >
                    <Text style={styles.linkText}>How do I get a free Activation Code?</Text>
                </TouchableOpacity>
            </View>

            <View style={[styles.card, { marginTop: 24 }]}>
                <Text style={styles.cardTitle}>Free Audio Transcription</Text>
                <Text style={styles.cardSubtitle}>
                    To use the "Speak Task" feature without hitting audio limits, you need to provide a free Voice Transcription Code.
                </Text>

                <TextInput
                    style={styles.input}
                    placeholder="Enter your Voice Transcription Code..."
                    placeholderTextColor="#94A3B8"
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
                    activeOpacity={0.8}
                >
                    <Text style={styles.btnTextPrimary}>
                        {isGroqSaved ? "✓ Saved Successfully" : "Save Voice Transcription Code"}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.linkContainer}
                    onPress={() => Alert.alert("How to get a code", "Go to console.groq.com/keys, sign in, and create your code. It is completely free and requires no credit card!")}
                >
                    <Text style={styles.linkText}>How do I get a free Voice Transcription Code?</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        padding: 24,
        backgroundColor: "#F8FAFC",
        paddingTop: 60,
        paddingBottom: 60,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 32,
    },
    iconWrapper: {
        backgroundColor: "#6366F1",
        width: 50,
        height: 50,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 16,
        shadowColor: "#6366F1",
        shadowOpacity: 0.3,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
    },
    subtitle: {
        fontSize: 14,
        fontWeight: "600",
        color: "#94A3B8",
        textTransform: "uppercase",
        letterSpacing: 1.2,
        marginBottom: 2,
    },
    title: {
        fontSize: 32,
        fontWeight: "800",
        color: "#0F172A",
        letterSpacing: -0.5,
    },
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 24,
        padding: 24,
        shadowColor: "#64748B",
        shadowOpacity: 0.08,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 3,
        borderWidth: 1,
        borderColor: "#F1F5F9",
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: "#0F172A",
        marginBottom: 12,
    },
    cardSubtitle: {
        fontSize: 14,
        color: "#64748B",
        lineHeight: 22,
        marginBottom: 24,
    },
    input: {
        backgroundColor: "#F8FAFC",
        padding: 18,
        borderRadius: 16,
        fontSize: 16,
        color: "#0F172A",
        marginBottom: 20,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    btnPrimary: {
        backgroundColor: "#6366F1",
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: "center",
        marginBottom: 16,
        shadowColor: "#6366F1",
        shadowOpacity: 0.3,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
    },
    btnSuccess: {
        backgroundColor: "#10B981",
        shadowColor: "#10B981",
    },
    btnSecondary: {
        backgroundColor: "#FFFFFF",
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: "center",
        marginBottom: 24,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        shadowColor: "#64748B",
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
    },
    btnTextPrimary: {
        color: "#FFFFFF",
        fontWeight: "700",
        fontSize: 16,
        letterSpacing: 0.5,
    },
    btnTextSecondary: {
        color: "#475569",
        fontWeight: "700",
        fontSize: 16,
        letterSpacing: 0.5,
    },
    linkContainer: {
        alignItems: "center",
        paddingVertical: 8,
    },
    linkText: {
        color: "#6366F1",
        fontSize: 14,
        fontWeight: "600",
    }
});

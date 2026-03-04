import { View, Text, StyleSheet, FlatList, TouchableOpacity, Share, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { getTasks, Task } from "@/src/storage/asyncStorage";
import { Ionicons } from "@expo/vector-icons";

export default function ShareScreen() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useFocusEffect(
        useCallback(() => {
            loadTasks();
        }, [])
    );

    const loadTasks = async () => {
        setIsLoading(true);
        const storedTasks = await getTasks();
        // optionally filter to only show upcoming/active tasks, but for now show all to share
        setTasks(storedTasks);
        setIsLoading(false);
    };

    const formatTaskForSharing = (task: Task) => {
        let text = `📌 Task: ${task.text}\n`;
        if (task.date) text += `📅 Date: ${task.date}\n`;
        if (task.time) text += `⏰ Time: ${task.time}\n`;
        if (task.location) text += `📍 Location: ${task.location}\n`;
        text += `Priority: ${task.priority.toUpperCase()}`;
        return text;
    };

    const handleShareTask = async (task: Task) => {
        try {
            await Share.share({
                message: formatTaskForSharing(task),
                title: 'Task Export', // Title is primarily used for email subjects
            });
        } catch (error: any) {
            console.error("Error sharing task:", error.message);
        }
    };

    const handleShareAll = async () => {
        if (tasks.length === 0) return;
        try {
            const allText = tasks.map(t => formatTaskForSharing(t)).join('\n\n---\n\n');
            await Share.share({
                message: `My Upcoming Tasks:\n\n${allText}`,
                title: 'All Active Tasks',
            });
        } catch (error: any) {
            console.error("Error sharing all tasks:", error.message);
        }
    };

    const renderTask = ({ item }: { item: Task }) => (
        <View style={styles.taskCard}>
            <View style={styles.taskContent}>
                <Text style={styles.taskTitle}>{item.text}</Text>

                <View style={styles.metricsRow}>
                    {item.date ? <Text style={styles.metricText}>📅 {item.date}</Text> : null}
                    {item.time ? <Text style={styles.metricText}>⏰ {item.time}</Text> : null}
                    {item.location ? <Text style={styles.metricText}>📍 {item.location}</Text> : null}
                </View>

                <View style={styles.badgesRow}>
                    <Text style={[styles.badge, styles.intentBadge]}>{item.intent}</Text>
                    <Text style={[styles.badge, item.priority === 'high' ? styles.highBadge : styles.normalBadge]}>
                        {item.priority}
                    </Text>
                </View>
            </View>

            <TouchableOpacity
                style={styles.shareButton}
                onPress={() => handleShareTask(item)}
                activeOpacity={0.7}
            >
                <Ionicons name="share-outline" size={24} color="#6366F1" />
                <Text style={styles.shareText}>Send</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.header}>
                <Text style={styles.subtitle}>Collaboration</Text>
                <Text style={styles.title}>Share Tasks</Text>
            </View>

            {isLoading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#6366F1" />
                </View>
            ) : tasks.length === 0 ? (
                <View style={styles.center}>
                    <Ionicons name="documents-outline" size={64} color="#CBD5E1" />
                    <Text style={styles.emptyText}>No Tasks Found</Text>
                    <Text style={styles.emptySubtext}>Add tasks in the Home or Voice tab to share them!</Text>
                </View>
            ) : (
                <>
                    <FlatList
                        data={tasks}
                        keyExtractor={(item) => item.id}
                        renderItem={renderTask}
                        contentContainerStyle={styles.listContainer}
                        showsVerticalScrollIndicator={false}
                    />

                    {/* Floating FAB to share ALL tasks */}
                    <TouchableOpacity
                        style={styles.fab}
                        onPress={handleShareAll}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="share-social" size={24} color="#FFF" />
                        <Text style={styles.fabText}>Share Summary</Text>
                    </TouchableOpacity>
                </>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: "#F8FAFC",
    },
    header: {
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        fontWeight: "600",
        color: "#94A3B8",
        textTransform: "uppercase",
        letterSpacing: 1.2,
        marginBottom: 4,
    },
    title: {
        fontSize: 32,
        fontWeight: "800",
        color: "#0F172A",
        letterSpacing: -0.5,
    },
    center: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
    },
    emptyText: {
        fontSize: 20,
        fontWeight: "700",
        color: "#475569",
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 15,
        color: "#94A3B8",
        textAlign: "center",
        marginTop: 8,
    },
    listContainer: {
        padding: 24,
        paddingBottom: 100, // accommodate FAB
    },
    taskCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        flexDirection: "row",
        alignItems: "center",
        shadowColor: "#64748B",
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 3,
        borderWidth: 1,
        borderColor: "#F1F5F9",
    },
    taskContent: {
        flex: 1,
        paddingRight: 16,
    },
    taskTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#1E293B",
        marginBottom: 10,
        lineHeight: 22,
    },
    metricsRow: {
        flexDirection: "column",
        gap: 6,
        marginBottom: 12,
    },
    metricText: {
        fontSize: 13,
        color: "#64748B",
        fontWeight: "500",
    },
    badgesRow: {
        flexDirection: "row",
        gap: 8,
    },
    badge: {
        fontSize: 11,
        fontWeight: "700",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        overflow: "hidden",
        textTransform: "uppercase",
    },
    intentBadge: {
        backgroundColor: "#EEF2FF",
        color: "#6366F1",
    },
    highBadge: {
        backgroundColor: "#FEF2F2",
        color: "#EF4444",
    },
    normalBadge: {
        backgroundColor: "#F1F5F9",
        color: "#64748B",
    },
    shareButton: {
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F8FAFC",
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    shareText: {
        fontSize: 11,
        fontWeight: "700",
        color: "#6366F1",
        marginTop: 4,
        textTransform: "uppercase",
    },
    fab: {
        position: "absolute",
        bottom: 24,
        right: 24,
        backgroundColor: "#10B981", // Emerald green for bulk sharing
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 30,
        shadowColor: "#10B981",
        shadowOpacity: 0.4,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
        gap: 8,
    },
    fabText: {
        color: "#FFFFFF",
        fontWeight: "700",
        fontSize: 16,
    }
});

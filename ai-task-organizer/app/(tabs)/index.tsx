import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useCallback } from "react";
import { getTasks, Task } from "@/src/storage/asyncStorage";

export default function HomeTab() {
  const [tasks, setTasks] = useState<Task[]>([]);

  const loadTasks = async () => {
    const fetchedTasks = await getTasks();
    // Only show today's tasks or high priority, or just the top 3 latest
    setTasks(fetchedTasks.slice(0, 3));
  };

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [])
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Good Day 👋</Text>
          <Text style={styles.title}>Your Tasks</Text>
        </View>

        {/* Focus Card */}
        <View style={styles.focusCard}>
          <Text style={styles.focusTitle}>Maximize Your Productivity</Text>
          <Text style={styles.focusSub}>With Smart Task AI</Text>
          <TouchableOpacity style={styles.focusBtn} onPress={() => router.push("/(tabs)/ocr" as any)}>
            <Text style={styles.focusBtnText}>Try AI Scanner</Text>
          </TouchableOpacity>
        </View>

        {/* Section */}
        <Text style={styles.sectionTitle}>Recent Tasks</Text>

        {tasks.length === 0 ? (
          <Text style={styles.emptyText}>No tasks yet. Create one or scan using AI!</Text>
        ) : (
          tasks.map(task => (
            <View key={task.id} style={styles.taskCard}>
              <View style={[styles.tag, task.priority === "high" ? styles.tagHigh : styles.tagLow]}>
                <Text style={[styles.tagText, task.priority === "high" ? styles.tagTextHigh : styles.tagTextLow]}>
                  {task.priority.toUpperCase()} Priority
                </Text>
              </View>
              <Text style={styles.taskTitle}>{task.text}</Text>
              <Text style={styles.taskSub}>{task.intent} • {task.category}</Text>

              <View style={styles.statusRow}>
                <View style={styles.statusTodo}>
                  <Text style={styles.statusText}>{task.date || "Anytime"}</Text>
                </View>
                {task.time ? (
                  <View style={styles.statusTodo}>
                    <Text style={styles.statusText}>{task.time}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Floating Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/add-task")}
      >
        <Text style={styles.fabText}>＋</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F6F7FB",
  },
  container: {
    padding: 20,
    paddingBottom: 80, // for FAB
  },
  header: {
    marginBottom: 20,
  },
  greeting: {
    color: "#666",
    fontSize: 14,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    marginTop: 4,
  },

  focusCard: {
    backgroundColor: "#1F2937",
    borderRadius: 18,
    padding: 20,
    marginBottom: 25,
  },
  focusTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  focusSub: {
    color: "#D1D5DB",
    marginTop: 6,
  },
  focusBtn: {
    backgroundColor: "#10B981",
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  focusBtnText: {
    color: "#fff",
    fontWeight: "600",
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  emptyText: {
    color: "#6B7280",
    fontSize: 14,
    fontStyle: "italic",
  },

  taskCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  tag: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  tagHigh: {
    backgroundColor: "#FEE2E2",
  },
  tagLow: {
    backgroundColor: "#D1FAE5",
  },
  tagText: {
    fontSize: 12,
    fontWeight: "600",
  },
  tagTextHigh: {
    color: "#DC2626",
  },
  tagTextLow: {
    color: "#059669",
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  taskSub: {
    color: "#6B7280",
    marginTop: 4,
    fontSize: 13,
  },
  statusRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  statusTodo: {
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  statusText: {
    color: "#2563EB",
    fontSize: 12,
    fontWeight: "600",
  },

  fab: {
    position: "absolute",
    right: 20,
    bottom: 30,
    backgroundColor: "#2563EB",
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    zIndex: 10,
  },
  fabText: {
    color: "#fff",
    fontSize: 30,
    marginBottom: 2,
  },
});

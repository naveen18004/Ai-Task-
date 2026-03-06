import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Linking,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useCallback } from "react";
import { getTasks, Task } from "@/src/storage/asyncStorage";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

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
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Good Day 👋</Text>
          <Text style={styles.title}>Your Tasks</Text>
        </View>

        {/* Focus Card with Gradient */}
        <LinearGradient
          colors={["#0F172A", "#1E293B", "#334155"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.focusCard}
        >
          <View style={styles.focusContent}>
            <View>
              <Text style={styles.focusTitle}>Maximize Productivity</Text>
              <Text style={styles.focusSub}>Supercharged by Offline AI</Text>
            </View>
            <Ionicons name="sparkles" size={36} color="#38BDF8" style={styles.focusIcon} />
          </View>

          <TouchableOpacity style={styles.focusBtn} onPress={() => router.push("/(tabs)/ocr" as any)}>
            <LinearGradient
              colors={["#38BDF8", "#0284C7"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.focusBtnGradient}
            >
              <Text style={styles.focusBtnText}>Try AI Scanner</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFF" style={{ marginLeft: 6 }} />
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>

        {/* Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Tasks</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/explore" as any)}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

        {tasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="leaf-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyText}>No tasks yet. Relax or add a new one.</Text>
          </View>
        ) : (
          tasks.map(task => (
            <View key={task.id} style={styles.taskCard}>
              <View style={styles.taskHeader}>
                <View style={[styles.tag, task.priority === "high" ? styles.tagHigh : styles.tagLow]}>
                  <Text style={[styles.tagText, task.priority === "high" ? styles.tagTextHigh : styles.tagTextLow]}>
                    {task.priority.toUpperCase()} PRIORITY
                  </Text>
                </View>
                <Ionicons name="ellipsis-horizontal" size={20} color="#94A3B8" />
              </View>

              <Text style={styles.taskTitle}>{task.text}</Text>

              <View style={styles.pillContainer}>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>{task.intent}</Text>
                </View>
                <View style={[styles.pill, { backgroundColor: "#F3E8FF" }]}>
                  <Text style={[styles.pillText, { color: "#A855F7" }]}>{task.category}</Text>
                </View>
              </View>

              <View style={styles.statusRow}>
                <View style={styles.statusTodo}>
                  <Ionicons name="calendar-outline" size={14} color="#2563EB" />
                  <Text style={styles.statusText}>{task.date || "Anytime"}</Text>
                </View>
                {task.time ? (
                  <View style={styles.statusTodo}>
                    <Ionicons name="time-outline" size={14} color="#2563EB" />
                    <Text style={styles.statusText}>{task.time}</Text>
                  </View>
                ) : null}
              </View>

              {task.location ? (
                <TouchableOpacity
                  style={styles.statusLocation}
                  onPress={() => {
                    const q = encodeURIComponent(task.location as string);
                    Linking.openURL(Platform.OS === 'ios' ? `maps://?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`);
                  }}
                >
                  <Ionicons name="location-outline" size={16} color="#8B5CF6" />
                  <Text style={styles.statusLocationText}>{task.location}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>

      {/* Floating Button */}
      <TouchableOpacity
        style={styles.fabContainer}
        onPress={() => router.push("/add-task")}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={["#0EA5E9", "#2563EB"]}
          style={styles.fab}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="add" size={32} color="#FFF" />
        </LinearGradient>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  container: {
    padding: 24,
    paddingBottom: 100, // for FAB
  },
  header: {
    marginBottom: 28,
    marginTop: 10,
  },
  greeting: {
    color: "#64748B",
    fontSize: 16,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontWeight: "600",
  },
  title: {
    fontSize: 34,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 6,
    letterSpacing: -1,
  },

  focusCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
    shadowColor: "#0284C7",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  focusContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  focusTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  focusSub: {
    color: "#94A3B8",
    marginTop: 6,
    fontSize: 15,
  },
  focusIcon: {
    opacity: 0.9,
  },
  focusBtn: {
    marginTop: 24,
    borderRadius: 14,
    overflow: "hidden",
  },
  focusBtnGradient: {
    flexDirection: "row",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  focusBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
  },
  seeAllText: {
    fontSize: 15,
    color: "#0284C7",
    fontWeight: "600",
  },

  emptyState: {
    paddingVertical: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
  },
  emptyText: {
    color: "#94A3B8",
    fontSize: 16,
    marginTop: 16,
    fontWeight: "500",
  },

  taskCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#94A3B8",
    shadowOpacity: 0.08,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  taskHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagHigh: {
    backgroundColor: "#FEF2F2",
  },
  tagLow: {
    backgroundColor: "#ECFDF5",
  },
  tagText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  tagTextHigh: {
    color: "#EF4444",
  },
  tagTextLow: {
    color: "#10B981",
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    lineHeight: 26,
    marginBottom: 12,
  },
  pillContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  pill: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  pillText: {
    color: "#3B82F6",
    fontSize: 13,
    fontWeight: "600",
  },
  statusRow: {
    flexDirection: "row",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 16,
  },
  statusTodo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusText: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
  },
  statusLocation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F5F3FF",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 12,
  },
  statusLocationText: {
    color: "#8B5CF6",
    fontSize: 14,
    fontWeight: "600",
  },

  fabContainer: {
    position: "absolute",
    right: 24,
    bottom: 30,
    shadowColor: "#0284C7",
    shadowOpacity: 0.3,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});

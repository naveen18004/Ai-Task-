import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from "react-native";
import { useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { getTasks, deleteTask, clearAllTasks, Task } from "@/src/storage/asyncStorage";

export default function ExploreScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);

  const loadTasks = async () => {
    const fetchedTasks = await getTasks();
    // Sort by latest created (assuming array is already prepended or can sort here)
    fetchedTasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setTasks(fetchedTasks);
  };

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [])
  );

  const handleLongPress = (task: Task) => {
    Alert.alert(
      "Delete Task",
      `Are you sure you want to delete "${task.text}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteTask(task.id);
            loadTasks();
          }
        }
      ]
    );
  };

  const handleClearAll = () => {
    Alert.alert(
      "Clear All Tasks",
      "Are you sure you want to delete ALL tasks? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            await clearAllTasks();
            loadTasks();
          }
        }
      ]
    );
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "high": return "#FEE2E2"; // Light red
      case "low": return "#D1FAE5"; // Light green
      default: return "#FEF3C7"; // Light yellow
    }
  };

  const getPriorityTextColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "high": return "#DC2626"; // Dark red
      case "low": return "#059669"; // Dark green
      default: return "#D97706"; // Dark yellow
    }
  };

  const renderItem = ({ item }: { item: Task }) => (
    <TouchableOpacity
      style={styles.taskCard}
      onLongPress={() => handleLongPress(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.tag, { backgroundColor: getPriorityColor(item.priority) }]}>
        <Text style={[styles.tagText, { color: getPriorityTextColor(item.priority) }]}>
          {item.priority.toUpperCase()} Priority
        </Text>
      </View>

      <Text style={styles.taskTitle}>{item.text}</Text>

      <View style={styles.metricsRow}>
        <Text style={styles.metricText}>Intent: {item.intent}</Text>
        <Text style={styles.metricText}>Category: {item.category}</Text>
      </View>

      {(item.date || item.time) && (
        <View style={styles.dateRow}>
          {item.date ? <Text style={styles.dateText}>📅 {item.date}</Text> : null}
          {item.time ? <Text style={styles.dateText}>🕒 {item.time}</Text> : null}
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>All Tasks</Text>
        <TouchableOpacity style={styles.clearBtn} onPress={handleClearAll}>
          <Text style={styles.clearBtnText}>Clear All</Text>
        </TouchableOpacity>
      </View>

      {tasks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No tasks found. Start adding some!</Text>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F6F7FB",
    paddingTop: 60,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1F2937",
  },
  clearBtn: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  clearBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
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
    marginBottom: 10,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "700",
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 8,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 8,
  },
  metricText: {
    fontSize: 13,
    color: "#6B7280",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: "hidden",
  },
  dateRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingTop: 12,
  },
  dateText: {
    fontSize: 14,
    color: "#4B5563",
    fontWeight: "500",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#9CA3AF",
  }
});

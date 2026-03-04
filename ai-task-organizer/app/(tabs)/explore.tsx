import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ScrollView, Linking, Platform } from "react-native";
import { useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { getTasks, deleteTask, clearAllTasks, updateTaskStatus, updateTask, removeClipboardProcessed, Task } from "@/src/storage/asyncStorage";
import { Ionicons } from "@expo/vector-icons";
import EditTaskModal from "@/components/EditTaskModal";
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CATEGORIES = ["All", "Work", "Personal", "Education", "Health", "General"];

export default function ExploreScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

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
            await removeClipboardProcessed(task.text);

            // Clear OS clipboard and cache if it matches, allowing immediate re-copying
            const currentClip = await Clipboard.getStringAsync();
            if (currentClip === task.text) {
              await Clipboard.setStringAsync('');
            }
            const lastProcessed = await AsyncStorage.getItem('@ai_task_organizer_last_clipboard');
            if (lastProcessed === task.text) {
              await AsyncStorage.removeItem('@ai_task_organizer_last_clipboard');
            }

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
            await Clipboard.setStringAsync('');
            await AsyncStorage.removeItem('@ai_task_organizer_last_clipboard');
            loadTasks();
          }
        }
      ]
    );
  };

  const handleToggleDone = async (task: Task) => {
    const newStatus = !task.isDone;
    // Optimistically update UI
    setTasks(prev =>
      prev.map(t => t.id === task.id ? { ...t, isDone: newStatus } : t)
    );
    // Persist changes
    await updateTaskStatus(task.id, newStatus);
  };

  const handleOpenEdit = (task: Task) => {
    setSelectedTask(task);
    setIsModalVisible(true);
  };

  const handleSaveTask = async (updatedTask: Task) => {
    // Optimistically update UI
    setTasks(prev =>
      prev.map(t => t.id === updatedTask.id ? updatedTask : t)
    );
    // Presist to storage
    await updateTask(updatedTask);
    setIsModalVisible(false);
    setSelectedTask(null);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "high": return "#EF4444"; // Vibrant Red
      case "low": return "#10B981";  // Vibrant Green
      default: return "#F59E0B";      // Vibrant Amber
    }
  };

  const renderItem = ({ item }: { item: Task }) => {
    const isDone = item.isDone;

    return (
      <TouchableOpacity
        style={[styles.taskCard, isDone && styles.taskCardDone]}
        onLongPress={() => handleLongPress(item)}
        onPress={() => handleOpenEdit(item)}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <TouchableOpacity
            onPress={() => handleToggleDone(item)}
            style={styles.checkButton}
          >
            <View style={[styles.checkbox, isDone && styles.checkboxDone]}>
              {isDone && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
            </View>
          </TouchableOpacity>

          <View style={styles.priorityIndicatorContainer}>
            <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(item.priority) }]} />
            <Text style={styles.priorityText}>{item.priority.toUpperCase()}</Text>
          </View>
        </View>

        <Text style={[styles.taskTitle, isDone && styles.textStrikethrough]}>
          {item.text}
        </Text>

        <View style={styles.metricsRow}>
          <Text style={styles.metricPill}>{item.intent}</Text>
          <Text style={styles.metricPill}>{item.category}</Text>
          {item.location ? (
            <TouchableOpacity
              style={styles.metricLocationPill}
              onPress={() => {
                const q = encodeURIComponent(item.location as string);
                Linking.openURL(Platform.OS === 'ios' ? `maps://?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`);
              }}
            >
              <Ionicons name="location" size={12} color="#8B5CF6" style={{ marginRight: 4 }} />
              <Text style={styles.metricLocationPillText}>📍 {item.location}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {(item.date || item.time) && (
          <View style={styles.dateRow}>
            {item.date ? (
              <View style={styles.dateTimeChip}>
                <Ionicons name="calendar-outline" size={14} color="#6366F1" />
                <Text style={styles.dateText}>{item.date}</Text>
              </View>
            ) : null}
            {item.time ? (
              <View style={styles.dateTimeChip}>
                <Ionicons name="time-outline" size={14} color="#6366F1" />
                <Text style={styles.dateText}>{item.time}</Text>
              </View>
            ) : null}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const filteredTasks = tasks.filter(task =>
    selectedCategory === "All" || task.category === selectedCategory
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Your schedule</Text>
          <Text style={styles.title}>All Tasks</Text>
        </View>
        <TouchableOpacity style={styles.clearBtn} onPress={handleClearAll}>
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <View style={styles.categoriesWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContent}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryTab,
                selectedCategory === cat && styles.categoryTabActive
              ]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[
                styles.categoryTabText,
                selectedCategory === cat && styles.categoryTabTextActive
              ]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {filteredTasks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="sparkles-outline" size={48} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>All caught up!</Text>
          <Text style={styles.emptyText}>No tasks found in this category.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredTasks}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <EditTaskModal
        visible={isModalVisible}
        task={selectedTask}
        onClose={() => setIsModalVisible(false)}
        onSave={handleSaveTask}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC", // Deep slate background
    paddingTop: 60,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  greeting: {
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
  clearBtn: {
    backgroundColor: "#FEE2E2",
    padding: 10,
    borderRadius: 12,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  taskCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#64748B",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  taskCardDone: {
    opacity: 0.5,
    backgroundColor: "#F8FAFC",
    shadowOpacity: 0,
    elevation: 0,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  checkButton: {
    padding: 4,
    marginLeft: -4,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxDone: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  priorityIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
    letterSpacing: 0.5,
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0F172A",
    marginBottom: 16,
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  textStrikethrough: {
    textDecorationLine: "line-through",
    color: "#94A3B8",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  metricPill: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6366F1",
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    overflow: "hidden",
  },
  metricLocationPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EDE9FE",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    overflow: "hidden",
  },
  metricLocationPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8B5CF6",
  },
  dateRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 16,
  },
  dateTimeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#475569",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: "#94A3B8",
  },
  categoriesWrapper: {
    marginBottom: 24,
  },
  categoriesContent: {
    paddingHorizontal: 24,
    gap: 8,
  },
  categoryTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 99,
    backgroundColor: "#FFFFFF",
    marginRight: 8,
    shadowColor: "#64748B",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  categoryTabActive: {
    backgroundColor: "#0F172A",
    borderColor: "#0F172A",
    shadowOpacity: 0.15,
  },
  categoryTabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
  },
  categoryTabTextActive: {
    color: "#FFFFFF",
  }
});

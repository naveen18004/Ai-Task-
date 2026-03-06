import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ScrollView, Linking, Platform } from "react-native";
import { useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { getTasks, deleteTask, clearAllTasks, updateTaskStatus, updateTask, removeClipboardProcessed, Task } from "@/src/storage/asyncStorage";
import { Ionicons } from "@expo/vector-icons";
import EditTaskModal from "@/components/EditTaskModal";
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from "expo-linear-gradient";

const CATEGORIES = ["All", "Work", "Personal", "Education", "Health", "General"];

export default function ExploreScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const loadTasks = async () => {
    const fetchedTasks = await getTasks();
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
      "Task Options",
      `What do you want to do with "${task.text}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Edit",
          onPress: () => handleOpenEdit(task)
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteTask(task.id);
            await removeClipboardProcessed(task.text);
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
    setTasks(prev =>
      prev.map(t => t.id === task.id ? { ...t, isDone: newStatus } : t)
    );
    await updateTaskStatus(task.id, newStatus);
  };

  const handleOpenEdit = (task: Task) => {
    setSelectedTask(task);
    setIsModalVisible(true);
  };

  const handleSaveTask = async (updatedTask: Task) => {
    setTasks(prev =>
      prev.map(t => t.id === updatedTask.id ? updatedTask : t)
    );
    await updateTask(updatedTask);
    setIsModalVisible(false);
    setSelectedTask(null);
  };

  const renderItem = ({ item }: { item: Task }) => {
    const isDone = item.isDone;

    return (
      <TouchableOpacity
        style={[styles.taskCard, isDone && styles.taskCardDone]}
        onLongPress={() => handleLongPress(item)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={isDone ? ["#F8FAFC", "#F1F5F9"] : ["#FFFFFF", "#F8FAFC"]}
          style={styles.cardGradient}
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
              <View style={[styles.priorityDot, { backgroundColor: item.priority === "high" ? "#EF4444" : item.priority === "low" ? "#10B981" : "#F59E0B" }]} />
              <Text style={styles.priorityText}>{item.priority.toUpperCase()}</Text>
            </View>
          </View>

          <Text style={[styles.taskTitle, isDone && styles.textStrikethrough]}>
            {item.text}
          </Text>

          <View style={styles.metricsRow}>
            <View style={styles.metricPill}>
              <Text style={styles.metricPillText}>{item.intent}</Text>
            </View>
            <View style={[styles.metricPill, { backgroundColor: "#FDF4FF" }]}>
              <Text style={[styles.metricPillText, { color: "#C026D3" }]}>{item.category}</Text>
            </View>
            {item.location ? (
              <TouchableOpacity
                style={styles.metricLocationPill}
                onPress={() => {
                  const q = encodeURIComponent(item.location as string);
                  Linking.openURL(Platform.OS === 'ios' ? `maps://?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`);
                }}
              >
                <Ionicons name="location" size={12} color="#8B5CF6" style={{ marginRight: 4 }} />
                <Text style={styles.metricLocationPillText}>{item.location}</Text>
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
        </LinearGradient>
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
        <TouchableOpacity style={styles.clearBtn} onPress={handleClearAll} activeOpacity={0.7}>
          <LinearGradient
            colors={["#FEE2E2", "#FECACA"]}
            style={styles.clearBtnGradient}
          >
            <Ionicons name="trash-outline" size={20} color="#EF4444" />
          </LinearGradient>
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
              activeOpacity={0.8}
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
          <Ionicons name="sparkles-outline" size={64} color="#CBD5E1" />
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
    backgroundColor: "#F8FAFC",
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
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  title: {
    fontSize: 34,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -1,
  },
  clearBtn: {
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#EF4444",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  clearBtnGradient: {
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  taskCard: {
    borderRadius: 24,
    marginBottom: 20,
    backgroundColor: "#FFFFFF",
    shadowColor: "#64748B",
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    overflow: 'hidden',
  },
  cardGradient: {
    padding: 24,
  },
  taskCardDone: {
    opacity: 0.6,
    shadowOpacity: 0,
    elevation: 0,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  checkButton: {
    padding: 4,
    marginLeft: -4,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#CBD5E1",
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
    paddingHorizontal: 12,
    paddingVertical: 6,
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
    fontWeight: "800",
    color: "#475569",
    letterSpacing: 0.5,
  },
  taskTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 16,
    lineHeight: 28,
    letterSpacing: -0.5,
  },
  textStrikethrough: {
    textDecorationLine: "line-through",
    color: "#94A3B8",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  metricPill: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  metricPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6366F1",
  },
  metricLocationPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EDE9FE",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  metricLocationPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8B5CF6",
  },
  dateRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 16,
  },
  dateTimeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 60,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#334155",
    marginTop: 20,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  emptyText: {
    fontSize: 16,
    color: "#94A3B8",
    fontWeight: "500",
  },
  categoriesWrapper: {
    marginBottom: 24,
  },
  categoriesContent: {
    paddingHorizontal: 24,
    gap: 12,
    alignItems: "center",
  },
  categoryTab: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 99,
    backgroundColor: "#FFFFFF",
    marginRight: 0,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  categoryTabActive: {
    backgroundColor: "#0F172A",
    borderColor: "#0F172A",
    shadowColor: "#0F172A",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  categoryTabText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#64748B",
  },
  categoryTabTextActive: {
    color: "#FFFFFF",
  }
});

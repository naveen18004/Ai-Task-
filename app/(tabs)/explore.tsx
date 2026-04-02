import EditTaskModal from "@/components/EditTaskModal";
import { retrainModelOnCorrection } from "@/src/ai/custom-model/retrainer";
import { clearAllTasks, deleteTask, getNextAvailableDate, getTasks, removeClipboardProcessed, Task, updateTask, updateTaskStatus } from "@/src/storage/asyncStorage";
import { handleAIAgentAction } from "@/src/utils/aiAgentHelper";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const CATEGORIES = ["All", "Work", "Personal", "Education", "Health", "General"];

export default function ExploreScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isSmartSort, setIsSmartSort] = useState(false);
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const [focusTimeLeft, setFocusTimeLeft] = useState<number>(25 * 60);

  useEffect(() => {
    let interval: any;
    if (focusTaskId && focusTimeLeft > 0) {
      interval = setInterval(() => {
        setFocusTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (focusTimeLeft === 0 && focusTaskId) {
      Speech.speak("Focus session complete! Excellent work. I have marked the task as done.", { rate: 1.0 });
      const completedTask = tasks.find(t => t.id === focusTaskId);
      if (completedTask) handleToggleDone(completedTask);
      setFocusTaskId(null);
    }
    return () => clearInterval(interval);
  }, [focusTaskId, focusTimeLeft, tasks]);

  const toggleFocus = (taskId: string) => {
    if (focusTaskId === taskId) {
      setFocusTaskId(null);
    } else {
      setFocusTaskId(taskId);
      setFocusTimeLeft(25 * 60);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const loadTasks = async () => {
    const fetchedTasks = await getTasks();
    if (isSmartSort) {
      // Sort by smartScore (highest first), fallback to creation date
      fetchedTasks.sort((a, b) => (b.smartScore || 0) - (a.smartScore || 0) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else {
      // Sort by creation date
      fetchedTasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    setTasks(fetchedTasks);
  };

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [isSmartSort])
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
            if (currentClip && (currentClip === task.text || currentClip.includes(task.text) || task.text.includes(currentClip))) {
              await Clipboard.setStringAsync('');
            }
            // Always reset the anti-spam clipboard memory when a task is deleted 
            // so the user can re-copy it if they want.
            await AsyncStorage.removeItem('@ai_task_organizer_last_clipboard');
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
    const finalizeExploreSave = async (t: Task) => {
      // CONTINUOUS LEARNING HOOK: If user corrects AI, retrain the probability weights
      if (selectedTask && (selectedTask.intent !== t.intent || selectedTask.category !== t.category)) {
        await retrainModelOnCorrection(t.text, t.intent || 'task');
      }

      setTasks(prev =>
        prev.map(task => task.id === t.id ? t : task)
      );
      await updateTask(t);
      setIsModalVisible(false);
      setSelectedTask(null);
    };

    if (updatedTask.date && updatedTask.date !== selectedTask?.date) {
      const nextDate = await getNextAvailableDate(updatedTask.date);
      if (nextDate && nextDate !== updatedTask.date) {
        Alert.alert("Busy Schedule", `You already have 5 tasks on ${updatedTask.date}. Do you want to auto-reschedule this to ${nextDate}?`, [
          { text: "Keep Original", onPress: () => finalizeExploreSave(updatedTask) },
          { text: `Move to ${nextDate}`, onPress: () => finalizeExploreSave({ ...updatedTask, date: nextDate }) }
        ]);
        return;
      }
    }
    await finalizeExploreSave(updatedTask);
  };

  const handleIntentAction = async (task: Task) => {
    if (task.intent === 'call') {
      const phoneRegex = /\+?1?\s*\(?-*\.*(\d{3})\)?\.*-*\s*(\d{3})\.*-*\s*(\d{4})/;
      const match = task.text.match(phoneRegex);

      const phoneUrl = match ? `tel:${match[0].replace(/[^0-9+]/g, '')}` : 'tel:';
      const canOpen = await Linking.canOpenURL(phoneUrl);

      if (canOpen) {
        Linking.openURL(phoneUrl);
      } else {
        Alert.alert("Action Not Supported", "Your device does not support this action or no valid phone number was found.");
      }
    } else if (task.intent === 'meeting') {
      const urlRegex = /(https?:\/\/[^\s]+)/;
      const match = task.text.match(urlRegex);
      if (match) {
        Linking.openURL(match[0]);
      } else {
        Alert.alert("No Link Found", "Please edit the task to add a valid meeting URL (e.g., zoom.us/j/...).");
      }
    }
  };

  const startDailyAudioBriefing = () => {
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
      return;
    }

    const todayCount = filteredTasks.filter(t => !t.isDone).length;

    if (todayCount === 0) {
      Speech.speak("Good news! You have no pending tasks right now. Enjoy your day!", { rate: 1.0 });
      return;
    }

    let intro = `Good morning. You have ${todayCount} actionable task${todayCount > 1 ? 's' : ''} on your radar.`;

    const highPriority = filteredTasks.filter(t => !t.isDone && t.priority === 'high');

    if (highPriority.length > 0) {
      intro += ` Your top priority is to ${highPriority[0].text}.`;
      if (highPriority.length > 1) {
        intro += ` You also have ${highPriority.length - 1} other critical targets.`;
      }
    } else {
      intro += ` There are no urgent threats detected.`;
    }

    intro += ` Would you like me to execute any actions?`;

    setIsSpeaking(true);

    Speech.speak(intro, {
      language: 'en-US',
      pitch: 1.0,
      rate: 1.0,
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false)
    });
  };

  const renderItem = ({ item }: { item: Task }) => {
    const isDone = item.isDone;
    const isLocked = item.dependencyIds?.some(depId => !tasks.find(t => t.id === depId)?.isDone);

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
              onPress={() => { if (!isLocked) handleToggleDone(item); }}
              style={[styles.checkButton, isLocked && { opacity: 0.5 }]}
              disabled={isLocked}
            >
              <View style={[styles.checkbox, isDone && styles.checkboxDone, isLocked && { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' } as any]}>
                {isDone ? <Ionicons name="checkmark" size={18} color="#FFFFFF" /> : isLocked ? <Ionicons name="lock-closed" size={14} color="#94A3B8" /> : null}
              </View>
            </TouchableOpacity>

            <View style={styles.priorityIndicatorContainer}>
              <View style={[styles.priorityDot, { backgroundColor: item.priority === "high" ? "#EF4444" : item.priority === "low" ? "#10B981" : "#F59E0B" }]} />
              <Text style={styles.priorityText}>{item.priority.toUpperCase()}</Text>
            </View>
          </View>

          <Text
            style={[styles.taskTitle, isDone && styles.textStrikethrough]}
            numberOfLines={2}
          >
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
            {item.weatherAlert ? (
              <View style={[styles.metricLocationPill, { backgroundColor: "#FFE4E6" }]}>
                {item.weatherAlert.condition.includes("Rain") || item.weatherAlert.condition.includes("Storm") ? (
                  <Ionicons name="rainy" size={12} color="#E11D48" style={{ marginRight: 4 }} />
                ) : item.weatherAlert.condition.includes("Snow") ? (
                  <Ionicons name="snow" size={12} color="#E11D48" style={{ marginRight: 4 }} />
                ) : (
                  <Ionicons name="warning-outline" size={12} color="#E11D48" style={{ marginRight: 4 }} />
                )}
                <Text style={[styles.metricLocationPillText, { color: "#E11D48" }]}>
                  {item.weatherAlert.condition} ({item.weatherAlert.temp}°)
                </Text>
              </View>
            ) : null}
          </View>

          {(item.date || item.time || item.estimatedMinutes) && (
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
              {item.estimatedMinutes ? (
                <View style={styles.dateTimeChip}>
                  <Ionicons name="hourglass-outline" size={14} color="#F59E0B" />
                  <Text style={styles.dateText}>{item.estimatedMinutes} min</Text>
                </View>
              ) : null}
            </View>
          )}

          {item.subTasks && item.subTasks.length > 0 && (
            <View style={styles.subTaskContainer}>
              <Text style={styles.subTaskHeader}>Sub-tasks:</Text>
              {item.subTasks.map((sub, idx) => (
                <View key={idx} style={styles.subTaskRow}>
                  <Ionicons name="ellipse" size={6} color="#94A3B8" />
                  <Text style={[styles.subTaskText, isDone && styles.textStrikethrough]}>{sub}</Text>
                </View>
              ))}
            </View>
          )}

          {!isDone && (
            <TouchableOpacity
              style={{ backgroundColor: focusTaskId === item.id ? '#FEE2E2' : '#F3F4F6', padding: 12, borderRadius: 12, marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              onPress={() => toggleFocus(item.id)}
            >
              <Ionicons name={focusTaskId === item.id ? "stop-circle" : "timer"} size={16} color={focusTaskId === item.id ? "#EF4444" : "#4B5563"} />
              <Text style={{ color: focusTaskId === item.id ? '#EF4444' : '#4B5563', fontWeight: '700', fontSize: 14 }}>
                {focusTaskId === item.id ? `Focusing... ${formatTime(focusTimeLeft)}` : "Start 25m Focus"}
              </Text>
            </TouchableOpacity>
          )}

          {item.intent === 'meeting' && !isDone && (
            <TouchableOpacity
              style={{ backgroundColor: '#EFF6FF', padding: 12, borderRadius: 12, marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              onPress={() => handleIntentAction(item)}
            >
              <Ionicons name="videocam" size={16} color="#3B82F6" />
              <Text style={{ color: '#3B82F6', fontWeight: '700', fontSize: 14 }}>Join Virtual Meeting</Text>
            </TouchableOpacity>
          )}

          {item.intent === 'email' && !isDone && (
            <TouchableOpacity
              style={{ backgroundColor: '#FEF3C7', padding: 12, borderRadius: 12, marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              onPress={() => handleAIAgentAction('email', item.actionContact, item.actionPayload || item.text)}
            >
              <Ionicons name="mail" size={16} color="#D97706" />
              <Text style={{ color: '#D97706', fontWeight: '700', fontSize: 14 }}>Draft Email</Text>
            </TouchableOpacity>
          )}

          {item.intent === 'sms' && !isDone && (
            <TouchableOpacity
              style={{ backgroundColor: '#E0E7FF', padding: 12, borderRadius: 12, marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              onPress={() => handleAIAgentAction('sms', item.actionContact, item.actionPayload || item.text)}
            >
              <Ionicons name="chatbubble" size={16} color="#4338CA" />
              <Text style={{ color: '#4338CA', fontWeight: '700', fontSize: 14 }}>Send Text Message</Text>
            </TouchableOpacity>
          )}
          {item.intent === 'buy' && !isDone && (
            <TouchableOpacity
              style={{ backgroundColor: '#FFFBEB', padding: 12, borderRadius: 12, marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              onPress={() => Linking.openURL(`https://www.amazon.com/s?k=${encodeURIComponent(item.text)}`)}
            >
              <Ionicons name="cart" size={16} color="#D97706" />
              <Text style={{ color: '#D97706', fontWeight: '700', fontSize: 14 }}>Search on Amazon</Text>
            </TouchableOpacity>
          )}
          {item.intent === 'call' && !isDone && (
            <TouchableOpacity
              style={{ backgroundColor: '#ECFDF5', padding: 12, borderRadius: 12, marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              onPress={() => handleIntentAction(item)}
            >
              <Ionicons name="call" size={16} color="#059669" />
              <Text style={{ color: '#059669', fontWeight: '700', fontSize: 14 }}>Make Phone Call</Text>
            </TouchableOpacity>
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
        <View style={[styles.headerRight, { alignItems: 'center', flexDirection: 'row' }]}>
          <TouchableOpacity
            style={{ backgroundColor: isSpeaking ? '#EF4444' : '#E0E7FF', padding: 8, borderRadius: 20, marginRight: 8, elevation: 1 }}
            onPress={startDailyAudioBriefing}
          >
            <Ionicons name={isSpeaking ? "stop" : "volume-high"} size={20} color={isSpeaking ? "#fff" : "#4F46E5"} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortBtn, isSmartSort && styles.sortBtnActive]}
            onPress={() => setIsSmartSort(!isSmartSort)}
          >
            <Ionicons name="color-wand-outline" size={20} color={isSmartSort ? "#ffffff" : "#6366F1"} />
            <Text style={[styles.sortBtnText, isSmartSort && styles.sortBtnTextActive]}>Smart</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.clearBtn} onPress={handleClearAll} activeOpacity={0.7}>
            <LinearGradient
              colors={["#FEE2E2", "#FECACA"]}
              style={styles.clearBtnGradient}
            >
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
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
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sortBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    gap: 6
  },
  sortBtnActive: {
    backgroundColor: "#6366F1",
  },
  sortBtnText: {
    color: "#6366F1",
    fontWeight: "700",
    fontSize: 14,
  },
  sortBtnTextActive: {
    color: "#FFFFFF",
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
  subTaskContainer: {
    marginTop: 16,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 16,
  },
  subTaskHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  subTaskRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 10,
  },
  subTaskText: {
    fontSize: 14,
    color: "#475569",
    fontWeight: "500",
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

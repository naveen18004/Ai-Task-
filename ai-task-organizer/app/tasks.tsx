import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

// Define a type for our tasks
interface Task {
  id: string;
  title: string;
  sub: string;
  priority: "High Priority" | "Normal";
  status: "To Do" | "In Progress" | "Done";
}

const INITIAL_TASKS: Task[] = [
  {
    id: "1",
    title: "About Website Design",
    sub: "Creative Landing Page",
    priority: "High Priority",
    status: "To Do",
  },
  {
    id: "2",
    title: "Client Feedback",
    sub: "Review comments",
    priority: "Normal",
    status: "In Progress",
  },
];

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);

  const toggleTaskStatus = (taskId: string) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) => {
        if (task.id === taskId) {
          return {
            ...task,
            status: task.status === "Done" ? "To Do" : "Done",
          };
        }
        return task;
      })
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container}>
        <Text style={styles.title}>All Tasks</Text>

        {tasks.map((task) => {
          const isDone = task.status === "Done";
          return (
            <View key={task.id} style={[styles.taskCard, isDone && styles.taskCardDone]}>
              <View style={styles.headerRow}>
                <View
                  style={
                    task.priority === "High Priority"
                      ? styles.priorityHigh
                      : styles.priorityNormal
                  }
                >
                  <Text style={styles.priorityText}>{task.priority}</Text>
                </View>

                {/* Mark as Done Checkbox / Button */}
                <TouchableOpacity
                  onPress={() => toggleTaskStatus(task.id)}
                  style={styles.checkButton}
                >
                  <Ionicons
                    name={isDone ? "checkmark-circle" : "ellipse-outline"}
                    size={28}
                    color={isDone ? "#10B981" : "#D1D5DB"}
                  />
                </TouchableOpacity>
              </View>

              <Text style={[styles.taskTitle, isDone && styles.textStrikethrough]}>
                {task.title}
              </Text>
              <Text style={[styles.taskSub, isDone && styles.textStrikethrough]}>
                {task.sub}
              </Text>

              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusBadge,
                    task.status === "To Do" && styles.statusTodo,
                    task.status === "In Progress" && styles.statusProgress,
                    task.status === "Done" && styles.statusDone,
                  ]}
                >
                  <Text style={[styles.statusText, isDone && styles.statusTextDone]}>
                    {task.status}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
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
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 20,
  },
  taskCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  taskCardDone: {
    opacity: 0.6,
    backgroundColor: "#F9FAFB",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  priorityHigh: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priorityNormal: {
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: "600",
  },
  checkButton: {
    padding: 2,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  taskSub: {
    color: "#6B7280",
    marginTop: 4,
  },
  textStrikethrough: {
    textDecorationLine: "line-through",
    color: "#9CA3AF",
  },
  statusRow: {
    marginTop: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  statusTodo: {
    backgroundColor: "#DBEAFE",
  },
  statusProgress: {
    backgroundColor: "#FEF3C7",
  },
  statusDone: {
    backgroundColor: "#D1FAE5",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  statusTextDone: {
    color: "#065F46",
  },
});

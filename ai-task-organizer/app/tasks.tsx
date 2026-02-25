import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Tasks() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container}>

        <Text style={styles.title}>All Tasks</Text>

        {/* Task Card 1 */}
        <View style={styles.taskCard}>
          <View style={styles.priorityHigh}>
            <Text style={styles.priorityText}>High Priority</Text>
          </View>

          <Text style={styles.taskTitle}>About Website Design</Text>
          <Text style={styles.taskSub}>Creative Landing Page</Text>

          <View style={styles.statusRow}>
            <View style={styles.statusTodo}>
              <Text style={styles.statusText}>To Do</Text>
            </View>
          </View>
        </View>

        {/* Task Card 2 */}
        <View style={styles.taskCard}>
          <View style={styles.priorityNormal}>
            <Text style={styles.priorityText}>Normal</Text>
          </View>

          <Text style={styles.taskTitle}>Client Feedback</Text>
          <Text style={styles.taskSub}>Review comments</Text>

          <View style={styles.statusRow}>
            <View style={styles.statusProgress}>
              <Text style={styles.statusText}>In Progress</Text>
            </View>
          </View>
        </View>

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
  },

  priorityHigh: {
    backgroundColor: "#FEE2E2",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  priorityNormal: {
    backgroundColor: "#E5E7EB",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: "600",
  },

  taskTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  taskSub: {
    color: "#6B7280",
    marginTop: 4,
  },

  statusRow: {
    marginTop: 12,
  },
  statusTodo: {
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  statusProgress: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
});

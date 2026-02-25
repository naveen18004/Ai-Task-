import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useState } from "react";
import { router } from "expo-router";

import { parseTaskText } from "@/src/ai/taskParser";
import { setupNotifications, scheduleReminder } from "@/src/notifications/notificationService";
import { saveTaskStr, Task, getApiKey, getGroqApiKey } from "@/src/storage/asyncStorage";
import * as FileSystem from 'expo-file-system/legacy';
import { Audio } from 'expo-av';
import { transcribeAudioWithGroq } from "@/src/ai/groqAudio";

export default function AddTask() {
  const [taskText, setTaskText] = useState("");
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);

  const saveTask = async () => {
    if (!taskText.trim()) {
      Alert.alert("No task text");
      return;
    }

    // Ask notification permission
    await setupNotifications();

    // AI parsing
    const parsed = parseTaskText(taskText);
    console.log("AI OUTPUT:", parsed);

    const newTask: Task = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      text: taskText.trim(),
      intent: parsed.intent,
      category: parsed.category,
      date: parsed.date,
      time: parsed.time,
      priority: parsed.priority,
      createdAt: new Date().toISOString()
    };

    await saveTaskStr(newTask);

    // If date & time exist, schedule reminder
    if (parsed.date && parsed.time) {
      // Normalize: "2 PM" -> "2:00 PM"
      const normalizedTime = parsed.time.replace(/^(\d{1,2})\s?(AM|PM)$/i, '$1:00 $2');
      const timeMatch = normalizedTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
      const baseDateMs = new Date(parsed.date).setHours(0, 0, 0, 0);

      if (timeMatch && !isNaN(baseDateMs)) {
        let h = parseInt(timeMatch[1]), m = parseInt(timeMatch[2]);
        const period = (timeMatch[3] || '').toUpperCase();
        if (period === 'PM' && h !== 12) h += 12;
        if (period === 'AM' && h === 12) h = 0;
        const base = new Date(baseDateMs);
        const reminderDate = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0);
        const now = new Date();

        if (reminderDate > now) {
          await scheduleReminder("Task Reminder", taskText, reminderDate);
          Alert.alert("Reminder Set", `Task saved and reminder scheduled for ${parsed.time}`);
        } else {
          Alert.alert("Task Saved", "Task saved, but the time is already in the past — no reminder scheduled.");
        }
      } else {
        Alert.alert("Task Saved", "Task saved. Could not parse the time for a reminder.");
      }
    } else {
      Alert.alert("Task Saved", "No date/time detected, reminder not set");
    }

    router.back();
  };

  const startRecording = async () => {
    try {
      const apiKey = await getApiKey();
      if (!apiKey) {
        Alert.alert("API Key Missing", "Please add your Gemini API Key in the Settings tab first.");
        return;
      }

      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);

    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert("Permission Error", "Could not start the microphone.");
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      setRecording(null);
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      const uri = recording.getURI();
      if (!uri) return;

      setIsProcessingAudio(true);
      const apiKey = await getApiKey();
      const groqApiKey = await getGroqApiKey();

      if (!groqApiKey) {
        Alert.alert("Groq API Key Missing", "Please add your Free Groq API Key in Settings to use Voice features.");
        return;
      }

      // 1. Transcribe incredibly fast with Groq (bypasses Gemini Audio Limits)
      const transcribedText = await transcribeAudioWithGroq(uri, 'audio/m4a', groqApiKey);

      if (!transcribedText || transcribedText.trim().length === 0) {
        Alert.alert("No Speech Detected", "Groq could not hear any speech in the audio.");
        return;
      }

      // 2. We use the local rule-based NLP to avoid hitting the Gemini text rate limit
      setTaskText(transcribedText);

    } catch (error: any) {
      console.error(error);
      Alert.alert("Error", error.message || "Failed to process the audio file.");
    } finally {
      setIsProcessingAudio(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Task</Text>

      <TextInput
        placeholder="Paste, speak, or scan task"
        value={taskText}
        onChangeText={setTaskText}
        multiline
        style={styles.input}
      />

      <View style={styles.buttonRow}>
        {/* Toggle between Start/Stop Recording based on state */}
        <TouchableOpacity
          style={[styles.btnSecondary, recording ? styles.btnRecording : null]}
          onPress={recording ? stopRecording : startRecording}
          disabled={isProcessingAudio}
        >
          <Text style={[styles.btnTextSecondary, recording ? styles.btnTextRecording : null]}>
            {isProcessingAudio ? "Analyzing..." : recording ? "⏹️ Stop & Parse" : "🎙️ Speak Task"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnPrimary} onPress={saveTask}>
          <Text style={styles.btnTextPrimary}>Analyze & Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#F6F7FB",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 20,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    minHeight: 120,
    textAlignVertical: "top",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: "#E5E7EB",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  btnRecording: {
    backgroundColor: "#FEE2E2", // Light red to indicate live recording
    borderWidth: 1,
    borderColor: "#EF4444",
  },
  btnTextSecondary: {
    color: "#374151",
    fontWeight: "600",
  },
  btnTextRecording: {
    color: "#EF4444",
    fontWeight: "700"
  },
  btnPrimary: {
    flex: 2,
    backgroundColor: "#2563EB",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  btnTextPrimary: {
    color: "#fff",
    fontWeight: "600",
  },
});

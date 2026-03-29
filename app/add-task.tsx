import { router } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { enhanceTaskWithAI } from "@/src/ai/aiEnhancer";
import { transcribeAudioWithGroq } from "@/src/ai/groqAudio";
import { parseTaskText } from "@/src/ai/taskParser";
import { geocodeLocationString, startGeofenceForTask } from "@/src/notifications/locationService";
import { scheduleReminder, setupNotifications } from "@/src/notifications/notificationService";
import { getApiKey, getGroqApiKey, saveTaskStr, Task } from "@/src/storage/asyncStorage";
import { getWeatherForTask } from "@/src/weather/weatherService";
import { Audio } from 'expo-av';

export default function AddTask() {
  const [taskText, setTaskText] = useState("");
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);

  const saveTask = async () => {
    if (!taskText || !taskText.trim()) {
      Alert.alert("No task text", "Please enter or speak a task first.");
      return;
    }

    // Do not process if the text is exceptionally short, this might be a mistake.
    if (taskText.trim().length < 2) {
      Alert.alert("Invalid task", "Task text is too short.");
      return;
    }

    setIsProcessingAudio(true); // Re-using state for general loading

    try {
      // Ask notification permission
      await setupNotifications();

      // AI parsing
      const parsed = parseTaskText(taskText);
      console.log("AI OUTPUT:", parsed);

      let subTasks: string[] = [];
      let estimatedMinutes: number | undefined;

      // Optional AI enhancements if API key exists
      const apiKey = await getApiKey();
      if (apiKey) {
        try {
          const enhanced = await enhanceTaskWithAI(taskText, apiKey);
          subTasks = enhanced.subTasks;
          estimatedMinutes = enhanced.estimatedMinutes;
        } catch (e) {
          console.warn("AI Enhancement failed, proceeding with local parsing:", e);
        }
      }

      let locationCoords;
      let weatherAlert;

      if (parsed.location) {
        locationCoords = await geocodeLocationString(parsed.location);

        // If we have coordinates and a target date, fetch the forecast
        if (locationCoords && parsed.date) {
          const d = new Date(parsed.date);
          if (!isNaN(d.getTime())) {
            weatherAlert = await getWeatherForTask(locationCoords.latitude, locationCoords.longitude, d.toISOString());
          }
        }
      }

      const newTask: Task = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        text: parsed.text || taskText.trim(), // Use summary
        intent: parsed.intent,
        category: parsed.category,
        date: parsed.date,
        time: parsed.time,
        priority: parsed.priority,
        location: parsed.location,
        locationCoords: locationCoords || undefined,
        createdAt: new Date().toISOString(),
        smartScore: parsed.smartScore,
        subTasks,
        estimatedMinutes,
        weatherAlert
      };

      const saved = await saveTaskStr(newTask);
      if (!saved) {
        Alert.alert("Duplicate Task", "This exact task is already in your list.");
        router.back();
        return;
      }

      // If Location exists & geocoded, start Geofence
      if (parsed.location && locationCoords) {
        await startGeofenceForTask(newTask.id, newTask.text, locationCoords.latitude, locationCoords.longitude);
        Alert.alert("Geofence Set", `Reminders will trigger when you arrive at ${parsed.location}.`);
      }

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
      } else if (!parsed.location) {
        Alert.alert("Task Saved", "No date/time detected, reminder not set");
      }

      router.back();
    } catch (e) {
      console.error("Save Task Error", e);
      Alert.alert("Error", "Failed to save the task.");
    } finally {
      setIsProcessingAudio(false);
    }
  };

  const startRecording = async () => {
    try {
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
      const groqApiKey = await getGroqApiKey();

      if (!groqApiKey) {
        console.warn("Groq API key not found. Voice transcription skipped.");
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

      // 3. Optional: Automatically process the task after speech if text exists
      if (transcribedText && transcribedText.trim().length > 0) {
        // Just setting it is fine, the user can review and hit 'Analyze & Save'
      }

    } catch (error: any) {
      console.error(error);
      Alert.alert("Error", error.message || "Failed to process the audio file.");
    } finally {
      setIsProcessingAudio(false);
    }
  };


  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.subtitle}>New Entry</Text>
        <Text style={styles.title}>Create Task</Text>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          placeholder="Paste, speak, or type your task..."
          placeholderTextColor="#94A3B8"
          value={taskText}
          onChangeText={setTaskText}
          multiline
          style={styles.input}
        />
      </View>

      <View style={styles.buttonRow}>
        {/* Toggle between Start/Stop Recording based on state */}
        <TouchableOpacity
          style={[styles.btnSecondary, recording ? styles.btnRecording : null]}
          onPress={recording ? stopRecording : startRecording}
          disabled={isProcessingAudio}
          activeOpacity={0.8}
        >
          <Text style={[styles.btnTextSecondary, recording ? styles.btnTextRecording : null]}>
            {isProcessingAudio ? "Analyzing..." : recording ? "⏹️ Stop" : "🎙️ Speak"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={saveTask}
          activeOpacity={0.8}
        >
          <Text style={styles.btnTextPrimary}>Analyze & Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "#F8FAFC",
  },
  header: {
    marginTop: 40,
    marginBottom: 24,
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
  inputContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    shadowColor: "#64748B",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    marginBottom: 24,
  },
  input: {
    padding: 20,
    minHeight: 180,
    textAlignVertical: "top",
    fontSize: 18,
    lineHeight: 28,
    color: "#0F172A",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 16,
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#64748B",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  btnRecording: {
    backgroundColor: "#FEF2F2", // Very light red
    borderColor: "#FECACA",
  },
  btnTextSecondary: {
    color: "#475569",
    fontWeight: "700",
    fontSize: 16,
  },
  btnTextRecording: {
    color: "#EF4444",
  },
  btnPrimary: {
    flex: 2,
    backgroundColor: "#6366F1", // Indigo
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6366F1",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  btnTextPrimary: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.3,
  },
});

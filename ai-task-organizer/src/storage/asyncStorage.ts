import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Task {
  id: string;
  text: string;
  intent: string;
  category: string;
  date: string;
  time: string;
  priority: string;
  location?: string;
  locationCoords?: { latitude: number; longitude: number };
  createdAt: string;
  isDone?: boolean;
  subTasks?: string[];
  estimatedMinutes?: number;
  smartScore?: number;
  weatherAlert?: { condition: string, temp: number };
}

// Helper: Calculate Jaccard similarity between two strings using character bigrams
function getSimilarity(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;

  const getBigrams = (str: string) => {
    const bigrams = new Set<string>();
    const s = str.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (let i = 0; i < s.length - 1; i++) {
      bigrams.add(s.substring(i, i + 2));
    }
    return bigrams;
  };

  const bg1 = getBigrams(s1);
  const bg2 = getBigrams(s2);

  if (bg1.size === 0 || bg2.size === 0) return s1.toLowerCase() === s2.toLowerCase() ? 1 : 0;

  let intersection = 0;
  bg1.forEach(b => { if (bg2.has(b)) intersection++; });
  const union = bg1.size + bg2.size - intersection;

  return intersection / union;
}

const TASKS_STORAGE_KEY = '@ai_task_organizer_tasks';
const PROCESSED_CLIPBOARDS_KEY = '@ai_task_organizer_processed_clipboards';

export const saveTaskStr = async (task: Task): Promise<boolean> => {
  try {
    const existingTasks = await getTasks();

    // Deduplication Logic: Block if same date & time AND text is extremely similar (>80% bigram similarity).
    // This catches exact duplicates AND minor OCR/Transcription inaccuracies.
    const isDuplicate = existingTasks.some((t: Task) => {
      const isTimeMatch = t.date === task.date && t.time === task.time;
      if (!isTimeMatch) return false;

      const similarity = getSimilarity(t.text, task.text);
      return similarity > 0.8;
    });

    if (isDuplicate) {
      console.log('Skipping duplicate task:', task.text);
      return false;
    }

    const newTasks = [task, ...existingTasks];
    await AsyncStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(newTasks));
    return true;
  } catch (error) {
    console.error('Error saving task:', error);
    return false;
  }
};

export const getTasks = async (): Promise<Task[]> => {
  try {
    const tasksJson = await AsyncStorage.getItem(TASKS_STORAGE_KEY);
    return tasksJson ? JSON.parse(tasksJson) : [];
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return [];
  }
};

export const deleteTask = async (taskId: string): Promise<void> => {
  try {
    const existingTasks = await getTasks();
    const updatedTasks = existingTasks.filter(task => task.id !== taskId);
    await AsyncStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(updatedTasks));
  } catch (error) {
    console.error('Error deleting task:', error);
  }
};

export const updateTaskStatus = async (taskId: string, isDone: boolean): Promise<void> => {
  try {
    const existingTasks = await getTasks();
    const updatedTasks = existingTasks.map(task =>
      task.id === taskId ? { ...task, isDone } : task
    );
    await AsyncStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(updatedTasks));
  } catch (error) {
    console.error('Error updating task status:', error);
  }
};

export const updateTask = async (updatedTask: Task): Promise<void> => {
  try {
    const existingTasks = await getTasks();
    const updatedTasks = existingTasks.map(task =>
      task.id === updatedTask.id ? updatedTask : task
    );
    await AsyncStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(updatedTasks));
  } catch (error) {
    console.error('Error updating full task:', error);
  }
};

export const clearAllTasks = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(TASKS_STORAGE_KEY);
    await AsyncStorage.removeItem(PROCESSED_CLIPBOARDS_KEY);
    await AsyncStorage.removeItem('@ai_task_organizer_last_clipboard');
  } catch (error) {
    console.error('Error clearing tasks:', error);
  }
};

// Clipboard Memory
export const isClipboardProcessed = async (text: string): Promise<boolean> => {
  try {
    const processedJson = await AsyncStorage.getItem(PROCESSED_CLIPBOARDS_KEY);
    const processedList: string[] = processedJson ? JSON.parse(processedJson) : [];
    return processedList.includes(text);
  } catch (error) {
    return false;
  }
};

export const markClipboardProcessed = async (text: string): Promise<void> => {
  try {
    const processedJson = await AsyncStorage.getItem(PROCESSED_CLIPBOARDS_KEY);
    const processedList: string[] = processedJson ? JSON.parse(processedJson) : [];
    processedList.push(text);
    // Keep only the last 20 to avoid bloat
    if (processedList.length > 20) processedList.shift();
    await AsyncStorage.setItem(PROCESSED_CLIPBOARDS_KEY, JSON.stringify(processedList));
  } catch (error) {
    console.error('Error marking clipboard processed:', error);
  }
};

export const removeClipboardProcessed = async (text: string): Promise<void> => {
  try {
    const processedJson = await AsyncStorage.getItem(PROCESSED_CLIPBOARDS_KEY);
    if (!processedJson) return;
    let processedList: string[] = JSON.parse(processedJson);
    processedList = processedList.filter(item => item !== text);
    await AsyncStorage.setItem(PROCESSED_CLIPBOARDS_KEY, JSON.stringify(processedList));
  } catch (error) {
    console.error('Error removing clipboard processed:', error);
  }
};
// Settings
const API_KEY_STORAGE_KEY = '@ai_task_organizer_api_key';

export const getApiKey = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(API_KEY_STORAGE_KEY);
  } catch (error) {
    return null;
  }
};

export const saveApiKey = async (key: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(API_KEY_STORAGE_KEY, key);
  } catch (error) {
    console.error('Error saving API key:', error);
  }
};

const GROQ_API_KEY_STORAGE_KEY = '@ai_task_organizer_groq_api_key';

export const getGroqApiKey = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(GROQ_API_KEY_STORAGE_KEY);
  } catch (error) {
    return null;
  }
};

export const saveGroqApiKey = async (key: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(GROQ_API_KEY_STORAGE_KEY, key);
  } catch (error) {
    console.error('Error saving Groq API key:', error);
  }
};

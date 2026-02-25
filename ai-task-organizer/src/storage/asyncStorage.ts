import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Task {
  id: string;
  text: string;
  intent: string;
  category: string;
  date: string;
  time: string;
  priority: string;
  createdAt: string;
}

const TASKS_STORAGE_KEY = '@ai_task_organizer_tasks';
const PROCESSED_CLIPBOARDS_KEY = '@ai_task_organizer_processed_clipboards';

export const saveTaskStr = async (task: Task): Promise<void> => {
  try {
    const existingTasks = await getTasks();
    const newTasks = [task, ...existingTasks];
    await AsyncStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(newTasks));
  } catch (error) {
    console.error('Error saving task:', error);
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

export const clearAllTasks = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(TASKS_STORAGE_KEY);
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

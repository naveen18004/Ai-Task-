import React, { useState, useEffect } from "react";
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    TouchableWithoutFeedback,
    Keyboard,
    ViewStyle,
    TextStyle,
    StyleProp
} from "react-native";
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Task } from "@/src/storage/asyncStorage";

interface EditTaskModalProps {
    visible: boolean;
    task: Task | null;
    onClose: () => void;
    onSave: (updatedTask: Task) => void;
}

const CATEGORIES = ["Work", "Personal", "Education", "Health", "General"];
const PRIORITIES = ["High", "Medium", "Low"];

export default function EditTaskModal({ visible, task, onClose, onSave }: EditTaskModalProps) {
    const [text, setText] = useState("");
    const [date, setDate] = useState("");
    const [time, setTime] = useState("");
    const [location, setLocation] = useState("");
    const [category, setCategory] = useState("General");
    const [priority, setPriority] = useState("Medium");

    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [pickerDate, setPickerDate] = useState(new Date());

    useEffect(() => {
        if (task && visible) {
            setText(task.text || "");
            setDate(task.date || "");
            setTime(task.time || "");
            setLocation(task.location || "");
            setCategory(task.category || "General");

            const p = task.priority?.toLowerCase() || "medium";
            let matchedPriority = "Medium";
            if (p.includes("high")) matchedPriority = "High";
            if (p.includes("low")) matchedPriority = "Low";
            setPriority(matchedPriority);

            try {
                let initDate = new Date();
                if (task.date) {
                    const d = new Date(task.date);
                    if (!isNaN(d.getTime())) initDate = d;
                }
                if (task.time && !isNaN(initDate.getTime())) {
                    const timeMatch = task.time.match(/(\d+):(\d+)\s+(AM|PM)/i);
                    if (timeMatch) {
                        let h = parseInt(timeMatch[1]);
                        let m = parseInt(timeMatch[2]);
                        const isPm = timeMatch[3].toUpperCase() === 'PM';
                        if (isPm && h !== 12) h += 12;
                        if (!isPm && h === 12) h = 0;
                        initDate.setHours(h, m, 0, 0);
                    }
                }
                setPickerDate(initDate);
            } catch (e) {
                // fallback
            }
        }
    }, [task, visible]);

    if (!task) return null;

    const handleSave = () => {
        onSave({
            ...task,
            text,
            date,
            time,
            location,
            category,
            priority: priority.toLowerCase()
        });
    };

    const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        setShowDatePicker(false);
        if (selectedDate) {
            setPickerDate(selectedDate);
            setDate(selectedDate.toDateString());
        }
    };

    const onTimeChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        setShowTimePicker(false);
        if (selectedDate) {
            setPickerDate(selectedDate);
            let hours = selectedDate.getHours();
            let minutes = selectedDate.getMinutes();
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            const strMinutes = minutes < 10 ? '0' + minutes : minutes.toString();
            setTime(`${hours}:${strMinutes} ${ampm}`);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.overlay as StyleProp<ViewStyle>}
                >
                    <View style={styles.modalContainer as StyleProp<ViewStyle>}>
                        <View style={styles.header as StyleProp<ViewStyle>}>
                            <Text style={styles.title}>Edit Task</Text>
                            <TouchableOpacity onPress={onClose} style={styles.closeBtn as StyleProp<ViewStyle>}>
                                <Text style={styles.closeBtnText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.formGroup as StyleProp<ViewStyle>}>
                            <Text style={styles.label}>Task Title</Text>
                            <TextInput
                                style={styles.input as any}
                                value={text}
                                onChangeText={setText}
                                placeholder="E.g., Call John about the project"
                                multiline
                            />
                        </View>

                        <View style={styles.formGroup as StyleProp<ViewStyle>}>
                            <Text style={styles.label}>Location</Text>
                            <TextInput
                                style={styles.input as any}
                                value={location}
                                onChangeText={setLocation}
                                placeholder="E.g., Conference Room A (Optional)"
                            />
                        </View>

                        <View style={styles.row as StyleProp<ViewStyle>}>
                            <View style={[styles.formGroup as StyleProp<ViewStyle>, { flex: 1, marginRight: 8 }]}>
                                <Text style={styles.label}>Date</Text>
                                <TouchableOpacity
                                    style={styles.pickerButton as StyleProp<ViewStyle>}
                                    onPress={() => setShowDatePicker(true)}
                                >
                                    <Text style={[styles.pickerButtonText, !date && styles.pickerButtonPlaceholder] as any}>
                                        {date || "Select Date"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            <View style={[styles.formGroup as StyleProp<ViewStyle>, { flex: 1, marginLeft: 8 }]}>
                                <Text style={styles.label}>Time</Text>
                                <TouchableOpacity
                                    style={styles.pickerButton as StyleProp<ViewStyle>}
                                    onPress={() => setShowTimePicker(true)}
                                >
                                    <Text style={[styles.pickerButtonText, !time && styles.pickerButtonPlaceholder] as any}>
                                        {time || "Select Time"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {showDatePicker && (
                            <DateTimePicker
                                value={pickerDate}
                                mode="date"
                                display="default"
                                onChange={onDateChange}
                            />
                        )}
                        {showTimePicker && (
                            <DateTimePicker
                                value={pickerDate}
                                mode="time"
                                display="default"
                                onChange={onTimeChange}
                            />
                        )}

                        <View style={styles.formGroup as StyleProp<ViewStyle>}>
                            <Text style={styles.label}>Category</Text>
                            <View style={styles.pillContainer as StyleProp<ViewStyle>}>
                                {CATEGORIES.map(c => (
                                    <TouchableOpacity
                                        key={c}
                                        style={[styles.pill as StyleProp<ViewStyle>, category === c && (styles.pillActive as StyleProp<ViewStyle>)]}
                                        onPress={() => setCategory(c)}
                                    >
                                        <Text style={[styles.pillText as any, category === c && (styles.pillTextActive as any)]}>
                                            {c}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.formGroup as StyleProp<ViewStyle>}>
                            <Text style={styles.label}>Priority</Text>
                            <View style={styles.pillContainer as StyleProp<ViewStyle>}>
                                {PRIORITIES.map(p => {
                                    const isActive = priority === p;
                                    const activeBgColor = p === "High" ? "#EF4444" : p === "Low" ? "#10B981" : "#F59E0B";
                                    return (
                                        <TouchableOpacity
                                            key={p}
                                            style={[
                                                styles.pill as StyleProp<ViewStyle>,
                                                isActive && { backgroundColor: activeBgColor } as StyleProp<ViewStyle>
                                            ]}
                                            onPress={() => setPriority(p)}
                                        >
                                            <Text style={[styles.pillText as any, isActive && (styles.pillTextActive as any)]}>
                                                {p}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        <TouchableOpacity style={styles.saveBtn as StyleProp<ViewStyle>} onPress={handleSave}>
                            <Text style={styles.saveBtnText}>Save Task</Text>
                        </TouchableOpacity>

                    </View>
                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(15, 23, 42, 0.6)", // Darker, more premium transparent slate overlay
        justifyContent: "flex-end",
    } as ViewStyle,
    modalContainer: {
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        maxHeight: "90%",
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: -10 },
        elevation: 10,
    } as ViewStyle,
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 24,
    } as ViewStyle,
    title: {
        fontSize: 24,
        fontWeight: "800",
        color: "#0F172A",
        letterSpacing: -0.5,
    } as TextStyle,
    closeBtn: {
        padding: 8,
        backgroundColor: "#F1F5F9",
        borderRadius: 99,
        paddingHorizontal: 16,
    } as ViewStyle,
    closeBtnText: {
        color: "#475569",
        fontSize: 14,
        fontWeight: "700",
    } as TextStyle,
    formGroup: {
        marginBottom: 24,
    } as ViewStyle,
    label: {
        fontSize: 13,
        fontWeight: "700",
        color: "#64748B",
        textTransform: "uppercase",
        letterSpacing: 0.8,
        marginBottom: 8,
    } as TextStyle,
    input: {
        backgroundColor: "#F8FAFC",
        borderRadius: 16,
        padding: 16,
        fontSize: 16,
        color: "#0F172A",
        borderWidth: 1,
        borderColor: "#E2E8F0",
    } as ViewStyle,
    pickerButton: {
        backgroundColor: "#F8FAFC",
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    } as ViewStyle,
    pickerButtonText: {
        fontSize: 16,
        color: "#0F172A",
        fontWeight: "500",
    } as TextStyle,
    pickerButtonPlaceholder: {
        color: "#94A3B8"
    } as TextStyle,
    row: {
        flexDirection: "row",
        justifyContent: "space-between",
    } as ViewStyle,
    pillContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    } as ViewStyle,
    pill: {
        backgroundColor: "#F1F5F9",
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "transparent",
    } as ViewStyle,
    pillActive: {
        backgroundColor: "#EEF2FF", // Light indigo
        borderColor: "#6366F1",
    } as ViewStyle,
    pillText: {
        color: "#64748B",
        fontWeight: "600",
        fontSize: 14,
    } as TextStyle,
    pillTextActive: {
        color: "#6366F1",
    } as TextStyle,
    saveBtn: {
        backgroundColor: "#6366F1",
        padding: 18,
        borderRadius: 16,
        alignItems: "center",
        marginTop: 8,
        marginBottom: 20,
        shadowColor: "#6366F1",
        shadowOpacity: 0.3,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
    } as ViewStyle,
    saveBtnText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "700",
        letterSpacing: 0.5,
    } as TextStyle
});

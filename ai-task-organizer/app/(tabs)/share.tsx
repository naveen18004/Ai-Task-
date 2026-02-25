import { View, Text, StyleSheet } from "react-native";

export default function ShareScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Share Tasks</Text>
            <Text style={styles.subtitle}>Feature coming soon: Sync and share your tasks with others!</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 24,
        backgroundColor: "#F6F7FB",
        alignItems: "center",
        justifyContent: "center",
    },
    title: {
        fontSize: 26,
        fontWeight: "700",
        marginBottom: 12,
        color: "#1F2937",
    },
    subtitle: {
        fontSize: 16,
        color: "#6B7280",
        textAlign: "center",
    }
});

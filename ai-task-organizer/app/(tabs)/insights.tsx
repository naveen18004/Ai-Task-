import { View, Text, StyleSheet, ScrollView, Dimensions } from "react-native";
import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { getTasks, Task } from "@/src/storage/asyncStorage";
import { Ionicons } from "@expo/vector-icons";
import { PieChart, BarChart } from "react-native-chart-kit";
import { LinearGradient } from "expo-linear-gradient";

const screenWidth = Dimensions.get("window").width;

export default function InsightsScreen() {
    const [tasks, setTasks] = useState<Task[]>([]);

    const loadTasks = async () => {
        const fetchedTasks = await getTasks();
        setTasks(fetchedTasks);
    };

    useFocusEffect(
        useCallback(() => {
            loadTasks();
        }, [])
    );

    // --- Metrics Calculation ---
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.isDone).length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const aiMinutesSaved = tasks.reduce((acc, t) => acc + (t.estimatedMinutes || 0), 0);

    // --- Pie Chart: Category Distribution ---
    const categoryCount: Record<string, number> = {};
    tasks.forEach(t => {
        categoryCount[t.category] = (categoryCount[t.category] || 0) + 1;
    });

    const colors = ["#6366F1", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"];
    const pieData = Object.keys(categoryCount).map((key, index) => ({
        name: key,
        population: categoryCount[key],
        color: colors[index % colors.length],
        legendFontColor: "#475569",
        legendFontSize: 13
    })).sort((a, b) => b.population - a.population);

    // --- Bar Chart: Last 7 Days Completion Trend ---
    const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
    }).reverse();

    const completionByDate: Record<string, number> = {};
    tasks.filter(t => t.isDone).forEach(t => {
        // Very naive matching of ISO creation/date to our 7-day array
        // In a real app we'd track "completedAt" but we'll use "createdAt" or "date" as a proxy for the demo.
        const taskDateNum = t.date ? new Date(t.date).getTime() : new Date(t.createdAt).getTime();
        const simpleDate = new Date(taskDateNum).toISOString().split('T')[0];
        completionByDate[simpleDate] = (completionByDate[simpleDate] || 0) + 1;
    });

    const barData = {
        labels: last7Days.map(d => d.substring(5, 10).replace('-', '/')), // "MM/DD"
        datasets: [
            {
                data: last7Days.map(d => completionByDate[d] || 0)
            }
        ]
    };

    const chartConfig = {
        backgroundColor: "#ffffff",
        backgroundGradientFrom: "#ffffff",
        backgroundGradientTo: "#ffffff",
        decimalPlaces: 0,
        color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
        labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
        style: {
            borderRadius: 16
        },
        propsForDots: {
            r: "6",
            strokeWidth: "2",
            stroke: "#4338ca"
        }
    };


    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
                <Text style={styles.greeting}>Your Productivity</Text>
                <Text style={styles.title}>Insights</Text>
            </View>

            {/* Top Metrics Row */}
            <View style={styles.metricsRow}>
                <View style={styles.metricCard}>
                    <View style={[styles.iconWrapper, { backgroundColor: "#EEF2FF" }]}>
                        <Ionicons name="checkmark-done" size={24} color="#6366F1" />
                    </View>
                    <Text style={styles.metricValue}>{completionRate}%</Text>
                    <Text style={styles.metricLabel}>Completion Rate</Text>
                </View>

                <View style={styles.metricCard}>
                    <View style={[styles.iconWrapper, { backgroundColor: "#FEF3C7" }]}>
                        <Ionicons name="flash" size={24} color="#F59E0B" />
                    </View>
                    <Text style={styles.metricValue}>{aiMinutesSaved}m</Text>
                    <Text style={styles.metricLabel}>Est. Processed</Text>
                </View>
            </View>

            {/* Category Distribution Pie Chart */}
            <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Category Distribution</Text>
                {pieData.length > 0 ? (
                    <PieChart
                        data={pieData}
                        width={screenWidth - 80}
                        height={200}
                        chartConfig={chartConfig}
                        accessor={"population"}
                        backgroundColor={"transparent"}
                        paddingLeft={"15"}
                        center={[10, 0]}
                        absolute
                    />
                ) : (
                    <View style={styles.emptyChart}>
                        <Text style={styles.emptyChartText}>No category data yet.</Text>
                    </View>
                )}
            </View>

            {/* Completion Trend Bar Chart */}
            <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>7-Day Output Trend</Text>
                {totalTasks > 0 ? (
                    <BarChart
                        data={barData}
                        width={screenWidth - 80}
                        height={220}
                        yAxisLabel=""
                        yAxisSuffix=""
                        chartConfig={chartConfig}
                        verticalLabelRotation={0}
                        showValuesOnTopOfBars={true}
                        withInnerLines={false}
                        style={styles.barStyle}
                    />
                ) : (
                    <View style={styles.emptyChart}>
                        <Text style={styles.emptyChartText}>No completed tasks in the last 7 days.</Text>
                    </View>
                )}
            </View>

            <View style={{ height: 100 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8FAFC",
        paddingTop: 60,
        paddingHorizontal: 24,
    },
    header: {
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
    metricsRow: {
        flexDirection: "row",
        gap: 16,
        marginBottom: 24,
    },
    metricCard: {
        flex: 1,
        backgroundColor: "#FFFFFF",
        borderRadius: 24,
        padding: 24,
        shadowColor: "#64748B",
        shadowOpacity: 0.05,
        shadowRadius: 15,
        shadowOffset: { width: 0, height: 8 },
        elevation: 4,
        borderWidth: 1,
        borderColor: "#F1F5F9",
    },
    iconWrapper: {
        width: 48,
        height: 48,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
    },
    metricValue: {
        fontSize: 28,
        fontWeight: "800",
        color: "#0F172A",
        marginBottom: 4,
    },
    metricLabel: {
        fontSize: 13,
        color: "#64748B",
        fontWeight: "600",
    },
    chartCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 24,
        padding: 24,
        marginBottom: 24,
        shadowColor: "#64748B",
        shadowOpacity: 0.05,
        shadowRadius: 15,
        shadowOffset: { width: 0, height: 8 },
        elevation: 4,
        borderWidth: 1,
        borderColor: "#F1F5F9",
    },
    chartTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: "#1E293B",
        marginBottom: 20,
    },
    barStyle: {
        marginVertical: 8,
        borderRadius: 16,
    },
    emptyChart: {
        height: 120,
        alignItems: "center",
        justifyContent: "center",
    },
    emptyChartText: {
        color: "#94A3B8",
        fontWeight: "500"
    }
});

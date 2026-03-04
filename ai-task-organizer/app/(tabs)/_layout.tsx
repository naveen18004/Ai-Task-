import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#6366F1", // Indigo accent color
        tabBarInactiveTintColor: "#94A3B8", // Slate inactive
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopWidth: 0,
          elevation: 10,
          shadowColor: "#64748B",
          shadowOpacity: 0.1,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: -5 },
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        }
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="paperplane.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="ocr"
        options={{
          title: 'OCR',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="camera.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="share"
        options={{
          title: 'Share',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="arrow.up.right.square.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="voice"
        options={{
          title: 'Voice Check',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="mic.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
          title: 'Settings',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="gear" color={color} />,
        }}
      />
    </Tabs>
  );
}

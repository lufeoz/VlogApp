import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getTodayProjectSummary, TodayProjectSummary } from '../services/projectService';

export default function HomeScreen() {
  const [summary, setSummary] = useState<TodayProjectSummary | null>(null);

  useFocusEffect(
    useCallback(() => {
      getTodayProjectSummary().then(setSummary);
    }, [])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Vlog</Text>
      <Text style={styles.summary}>
        {summary?.project
          ? `오늘 프로젝트: ${summary.project.status} · 클립 ${summary.clipCount}개`
          : '오늘 촬영한 클립이 아직 없어요'}
      </Text>
      <Pressable style={styles.button} onPress={() => router.push('/camera')}>
        <Text style={styles.buttonText}>촬영하기</Text>
      </Pressable>
      {summary?.project && (
        <Pressable
          style={styles.secondaryButton}
          onPress={() => router.push(`/project/${summary.project!.id}`)}
        >
          <Text style={styles.secondaryButtonText}>편집하기</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  summary: {
    fontSize: 14,
    color: '#666',
  },
  button: {
    backgroundColor: '#e53935',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
  },
  secondaryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: '#e53935',
    fontWeight: '600',
  },
});

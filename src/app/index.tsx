import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Project } from '../domain/project/types';
import { createProject, getTodayProjectSummary, listProjects, TodayProjectSummary } from '../services/projectService';

export default function HomeScreen() {
  const [summary, setSummary] = useState<TodayProjectSummary | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const reload = useCallback(() => {
    getTodayProjectSummary().then(setSummary);
    listProjects().then(setProjects);
  }, []);

  useFocusEffect(reload);

  const handleCreateProject = async () => {
    setIsCreating(true);
    try {
      const project = await createProject();
      router.push(`/project/${project.id}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
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
          <Pressable style={styles.secondaryButton} onPress={() => router.push(`/project/${summary.project!.id}`)}>
            <Text style={styles.secondaryButtonText}>오늘 프로젝트 편집하기</Text>
          </Pressable>
        )}
        <Pressable style={styles.newProjectButton} onPress={handleCreateProject} disabled={isCreating}>
          <Text style={styles.newProjectButtonText}>
            {isCreating ? '만드는 중...' : '+ 새 프로젝트 (기존 영상 편집용)'}
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={<Text style={styles.listTitle}>모든 프로젝트</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.projectRow} onPress={() => router.push(`/project/${item.id}`)}>
            <Text style={styles.projectRowTitle}>{item.title}</Text>
            <Text style={styles.projectRowMeta}>
              {item.date} · {item.status}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, gap: 12, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '600' },
  summary: { fontSize: 14, color: '#666' },
  button: {
    backgroundColor: '#e53935',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: { color: 'white', fontWeight: '600' },
  secondaryButton: { paddingHorizontal: 24, paddingVertical: 4 },
  secondaryButtonText: { color: '#e53935', fontWeight: '600' },
  newProjectButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#1565c0',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  newProjectButtonText: { color: '#1565c0', fontWeight: '600' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  listTitle: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 8 },
  projectRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  projectRowTitle: { fontSize: 15, fontWeight: '600' },
  projectRowMeta: { fontSize: 12, color: '#888', marginTop: 2 },
});

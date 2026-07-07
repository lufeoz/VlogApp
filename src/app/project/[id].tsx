import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';

import { hideClipById, reorderClips, restoreClipById, trimClip } from '../../services/clipEditingService';
import { exportProject } from '../../services/exportService';
import { ClipWithAsset, getProjectDetail, ProjectDetail } from '../../services/projectService';
import { ClipListItem } from '../../ui/components/ClipListItem';

// UI only: renders project detail and forwards user actions to
// clipEditingService. No editing rules live in this file.
export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const reload = useCallback(() => {
    if (!id) return;
    getProjectDetail(id).then(setDetail);
  }, [id]);

  useFocusEffect(reload);

  if (!detail) {
    return <View style={styles.container} />;
  }

  // Arrow function expressions (not hoisted function declarations) so
  // TypeScript's null-narrowing of `detail` from the guard above still holds.
  const handleTrimChange = async (clipId: string, trimStart: number, trimEnd: number) => {
    try {
      await trimClip(clipId, trimStart, trimEnd);
      reload();
    } catch (error) {
      console.error('Trim failed', error);
    }
  };

  const handleHide = async (clipId: string) => {
    await hideClipById(clipId);
    reload();
  };

  const handleRestore = async (clipId: string) => {
    await restoreClipById(clipId);
    reload();
  };

  const handleDragEnd = async (data: ClipWithAsset[]) => {
    setDetail((prev) => (prev ? { ...prev, visibleClips: data } : prev));
    await reorderClips(
      detail.videoTrack.id,
      data.map((c) => c.clip.id)
    );
    reload();
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportProject(detail.project.id);
      Alert.alert('완료', '영상이 사진첩에 저장되었습니다.');
      reload();
    } catch (error) {
      console.error('Export failed', error);
      Alert.alert('내보내기 실패', error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{detail.project.title}</Text>
        <Text style={styles.status}>{detail.project.status}</Text>
      </View>

      <DraggableFlatList
        data={detail.visibleClips}
        keyExtractor={(item) => item.clip.id}
        onDragEnd={({ data }) => handleDragEnd(data)}
        renderItem={({ item, drag, isActive }: RenderItemParams<ClipWithAsset>) => (
          <ClipListItem item={item} isActive={isActive} onDrag={drag} onTrimChange={handleTrimChange} onHide={handleHide} />
        )}
      />

      {detail.hiddenClips.length > 0 && (
        <View style={styles.hiddenSection}>
          <Text style={styles.hiddenTitle}>숨긴 클립</Text>
          {detail.hiddenClips.map(({ clip, asset }) => (
            <View key={clip.id} style={styles.hiddenRow}>
              <Image source={{ uri: asset.thumbnailUri }} style={styles.hiddenThumbnail} />
              <Pressable style={styles.restoreButton} onPress={() => handleRestore(clip.id)}>
                <Text style={styles.restoreButtonText}>복원</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <Pressable style={styles.recordButton} onPress={() => router.push('/camera')}>
        <Text style={styles.recordButtonText}>촬영 추가하기</Text>
      </Pressable>

      <Pressable
        style={[styles.exportButton, (isExporting || detail.visibleClips.length === 0) && styles.exportButtonDisabled]}
        onPress={handleExport}
        disabled={isExporting || detail.visibleClips.length === 0}
      >
        <Text style={styles.exportButtonText}>{isExporting ? '내보내는 중...' : '완료'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, gap: 4 },
  title: { fontSize: 18, fontWeight: '700' },
  status: { fontSize: 12, color: '#666' },
  hiddenSection: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#ddd' },
  hiddenTitle: { fontSize: 13, fontWeight: '600', marginBottom: 8, color: '#666' },
  hiddenRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  hiddenThumbnail: { width: 48, height: 48, borderRadius: 6, backgroundColor: '#eee' },
  restoreButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#e8f5e9' },
  restoreButtonText: { fontSize: 12, color: '#2e7d32' },
  recordButton: { margin: 16, backgroundColor: '#e53935', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  recordButtonText: { color: 'white', fontWeight: '600' },
  exportButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#1565c0',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  exportButtonDisabled: { backgroundColor: '#90a4ae' },
  exportButtonText: { color: 'white', fontWeight: '600' },
});

import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';

import {
  getHighlightRecommendations,
  HighlightRecommendation,
  listProjectCaptions,
  pollHighlightJob,
  pollNarrationJob,
  pollSubtitleJob,
  requestHighlightDetection,
  requestNarrationGeneration,
  requestSubtitleGeneration,
} from '../../services/aiService';
import { hideClipById, reorderClips, restoreClipById, trimClip } from '../../services/clipEditingService';
import { exportProject } from '../../services/exportService';
import { importVideosIntoProject } from '../../services/importService';
import { requestBackgroundMusic } from '../../services/musicService';
import { ClipWithAsset, getProjectDetail, ProjectDetail } from '../../services/projectService';
import { retryProjectSync } from '../../services/syncService';
import { ClipListItem } from '../../ui/components/ClipListItem';
import { AiJob } from '../../domain/aiJob/types';
import { CaptionCue } from '../../domain/caption/types';

// UI only: renders project detail and forwards user actions to
// clipEditingService. No editing rules live in this file.
export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [captions, setCaptions] = useState<CaptionCue[]>([]);
  const [subtitleJobId, setSubtitleJobId] = useState<string | null>(null);
  const [subtitleJobStatus, setSubtitleJobStatus] = useState<AiJob['status'] | null>(null);
  const [narrationScript, setNarrationScript] = useState('');
  const [narrationJobId, setNarrationJobId] = useState<string | null>(null);
  const [narrationJobStatus, setNarrationJobStatus] = useState<AiJob['status'] | null>(null);
  const [isAddingMusic, setIsAddingMusic] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [highlightJobId, setHighlightJobId] = useState<string | null>(null);
  const [highlightJobStatus, setHighlightJobStatus] = useState<AiJob['status'] | null>(null);
  const [highlights, setHighlights] = useState<HighlightRecommendation[]>([]);

  const reload = useCallback(() => {
    if (!id) return;
    getProjectDetail(id).then(setDetail);
    listProjectCaptions(id).then(setCaptions);
  }, [id]);

  useFocusEffect(reload);

  // Poll the in-flight subtitle job every 3s until it reaches a terminal state.
  useEffect(() => {
    if (!subtitleJobId || subtitleJobStatus === 'completed' || subtitleJobStatus === 'failed') return;

    const interval = setInterval(async () => {
      try {
        const job = await pollSubtitleJob(subtitleJobId);
        setSubtitleJobStatus(job.status);
        if (job.status === 'completed' && id) {
          const cues = await listProjectCaptions(id);
          setCaptions(cues);
        }
      } catch (error) {
        console.error('Subtitle job poll failed', error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [subtitleJobId, subtitleJobStatus, id]);

  // Poll the in-flight narration job every 3s until it reaches a terminal state.
  useEffect(() => {
    if (!narrationJobId || narrationJobStatus === 'completed' || narrationJobStatus === 'failed') return;

    const interval = setInterval(async () => {
      try {
        const job = await pollNarrationJob(narrationJobId);
        setNarrationJobStatus(job.status);
      } catch (error) {
        console.error('Narration job poll failed', error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [narrationJobId, narrationJobStatus]);

  // Poll the in-flight highlight-detection job every 3s until terminal.
  useEffect(() => {
    if (!highlightJobId || highlightJobStatus === 'completed' || highlightJobStatus === 'failed') return;

    const interval = setInterval(async () => {
      try {
        const job = await pollHighlightJob(highlightJobId);
        setHighlightJobStatus(job.status);
        if (job.status === 'completed') {
          setHighlights(getHighlightRecommendations(job));
        }
      } catch (error) {
        console.error('Highlight job poll failed', error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [highlightJobId, highlightJobStatus]);

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

  const handleRetrySync = async () => {
    setIsSyncing(true);
    try {
      await retryProjectSync(detail.project.id);
      reload();
    } catch (error) {
      console.error('Retry sync failed', error);
      Alert.alert('재동기화 실패', error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleGenerateSubtitles = async () => {
    try {
      const jobId = await requestSubtitleGeneration(detail.project.id);
      setSubtitleJobId(jobId);
      setSubtitleJobStatus('queued');
    } catch (error) {
      Alert.alert('자막 생성 실패', error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    }
  };

  const isGeneratingSubtitles = subtitleJobStatus === 'queued' || subtitleJobStatus === 'running';

  const handleGenerateNarration = async () => {
    try {
      const jobId = await requestNarrationGeneration(detail.project.id, narrationScript);
      setNarrationJobId(jobId);
      setNarrationJobStatus('queued');
    } catch (error) {
      Alert.alert('내레이션 생성 실패', error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    }
  };

  const isGeneratingNarration = narrationJobStatus === 'queued' || narrationJobStatus === 'running';

  const handleAddMusic = async () => {
    setIsAddingMusic(true);
    try {
      await requestBackgroundMusic(detail.project.id);
      Alert.alert('완료', '무료 배경음악이 추가되었습니다.');
    } catch (error) {
      Alert.alert('배경음악 추가 실패', error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsAddingMusic(false);
    }
  };

  const handleDetectHighlights = async () => {
    try {
      const jobId = await requestHighlightDetection(detail.project.id);
      setHighlightJobId(jobId);
      setHighlightJobStatus('queued');
      setHighlights([]);
    } catch (error) {
      Alert.alert('하이라이트 추천 실패', error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    }
  };

  const isDetectingHighlights = highlightJobStatus === 'queued' || highlightJobStatus === 'running';

  const handleHideFromHighlight = async (clipId: string) => {
    await handleHide(clipId);
    setHighlights((prev) => prev.filter((item) => item.clipId !== clipId));
  };

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const count = await importVideosIntoProject(detail.project.id);
      if (count > 0) {
        Alert.alert('가져오기 완료', `${count}개의 영상을 가져왔습니다.`);
        reload();
      }
    } catch (error) {
      Alert.alert('가져오기 실패', error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{detail.project.title}</Text>
        <Text style={styles.status}>{detail.project.status}</Text>
        {detail.failedSyncTaskCount > 0 && (
          <View style={styles.recoveryBanner}>
            <Text style={styles.recoveryBannerText}>
              백업 중 문제가 발생했습니다 ({detail.failedSyncTaskCount}건)
            </Text>
            <Pressable style={styles.retrySyncButton} onPress={handleRetrySync} disabled={isSyncing}>
              <Text style={styles.retrySyncButtonText}>{isSyncing ? '재동기화 중...' : '재동기화'}</Text>
            </Pressable>
          </View>
        )}
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
        style={[styles.importButton, isImporting && styles.exportButtonDisabled]}
        onPress={handleImport}
        disabled={isImporting}
      >
        <Text style={styles.recordButtonText}>{isImporting ? '가져오는 중...' : '기존 영상 가져오기'}</Text>
      </Pressable>

      <Pressable
        style={[styles.exportButton, (isExporting || detail.visibleClips.length === 0) && styles.exportButtonDisabled]}
        onPress={handleExport}
        disabled={isExporting || detail.visibleClips.length === 0}
      >
        <Text style={styles.exportButtonText}>{isExporting ? '내보내는 중...' : '완료'}</Text>
      </Pressable>

      <View style={styles.aiSection}>
        <Pressable
          style={[styles.subtitleButton, isGeneratingSubtitles && styles.exportButtonDisabled]}
          onPress={handleGenerateSubtitles}
          disabled={isGeneratingSubtitles}
        >
          <Text style={styles.subtitleButtonText}>
            {isGeneratingSubtitles ? `자막 생성 중... (${subtitleJobStatus})` : 'AI 자막 생성'}
          </Text>
        </Pressable>

        {captions.length > 0 && (
          <View style={styles.captionList}>
            {captions.map((cue) => (
              <Text key={cue.id} style={styles.captionText}>
                [{(cue.startMs / 1000).toFixed(1)}s] {cue.text}
              </Text>
            ))}
          </View>
        )}

        <TextInput
          style={styles.narrationInput}
          placeholder="내레이션 대본을 입력하세요"
          value={narrationScript}
          onChangeText={setNarrationScript}
          multiline
        />
        <Pressable
          style={[styles.narrationButton, isGeneratingNarration && styles.exportButtonDisabled]}
          onPress={handleGenerateNarration}
          disabled={isGeneratingNarration}
        >
          <Text style={styles.subtitleButtonText}>
            {isGeneratingNarration ? `내레이션 생성 중... (${narrationJobStatus})` : 'AI 내레이션 생성'}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.musicButton, isAddingMusic && styles.exportButtonDisabled]}
          onPress={handleAddMusic}
          disabled={isAddingMusic}
        >
          <Text style={styles.subtitleButtonText}>
            {isAddingMusic ? '배경음악 찾는 중...' : '무료 배경음악 추가'}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.highlightButton, isDetectingHighlights && styles.exportButtonDisabled]}
          onPress={handleDetectHighlights}
          disabled={isDetectingHighlights}
        >
          <Text style={styles.subtitleButtonText}>
            {isDetectingHighlights ? `분석 중... (${highlightJobStatus})` : 'AI 하이라이트 추천받기'}
          </Text>
        </Pressable>

        {highlights.length > 0 && (
          <View style={styles.highlightList}>
            {highlights.map((item) => (
              <View key={item.clipId} style={styles.highlightRow}>
                <Text style={styles.highlightText}>
                  [{item.score}점, {item.suggestion === 'hide' ? '숨김 추천' : '유지 추천'}] {item.reason}
                </Text>
                {item.suggestion === 'hide' && (
                  <Pressable style={styles.hideSuggestionButton} onPress={() => handleHideFromHighlight(item.clipId)}>
                    <Text style={styles.hideSuggestionButtonText}>숨기기</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}
      </View>
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
  importButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#6d4c41',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
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
  recoveryBanner: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff3e0',
    padding: 10,
    borderRadius: 8,
  },
  recoveryBannerText: { fontSize: 12, color: '#e65100', flex: 1, marginRight: 8 },
  retrySyncButton: { backgroundColor: '#e65100', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  retrySyncButtonText: { color: 'white', fontSize: 12, fontWeight: '600' },
  aiSection: { marginHorizontal: 16, marginBottom: 16 },
  subtitleButton: {
    backgroundColor: '#6a1b9a',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  subtitleButtonText: { color: 'white', fontWeight: '600' },
  captionList: { marginTop: 12, gap: 4 },
  captionText: { fontSize: 12, color: '#444' },
  narrationInput: {
    marginTop: 12,
    minHeight: 60,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  narrationButton: {
    marginTop: 8,
    backgroundColor: '#00695c',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  musicButton: {
    marginTop: 8,
    backgroundColor: '#ef6c00',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  highlightButton: {
    marginTop: 8,
    backgroundColor: '#37474f',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  highlightList: { marginTop: 12, gap: 8 },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  highlightText: { fontSize: 12, color: '#444', flex: 1 },
  hideSuggestionButton: {
    backgroundColor: '#ffebee',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  hideSuggestionButtonText: { fontSize: 12, color: '#c62828' },
});

import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { ClipWithAsset } from '../../services/projectService';

const TRIM_STEP_MS = 250;

interface ClipListItemProps {
  item: ClipWithAsset;
  isActive: boolean;
  onDrag: () => void;
  onTrimChange: (clipId: string, trimStart: number, trimEnd: number) => void;
  onHide: (clipId: string) => void;
}

function formatMs(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function ClipListItem({ item, isActive, onDrag, onTrimChange, onHide }: ClipListItemProps) {
  const { clip, asset } = item;

  return (
    <Pressable
      onLongPress={onDrag}
      disabled={isActive}
      style={[styles.container, isActive && styles.containerActive]}
    >
      <Image source={{ uri: asset.thumbnailUri }} style={styles.thumbnail} resizeMode="cover" />

      <View style={styles.details}>
        <Text style={styles.duration}>{formatMs(clip.trimEnd - clip.trimStart)}</Text>

        <View style={styles.trimRow}>
          <Text style={styles.trimLabel}>시작</Text>
          <Pressable
            style={styles.stepButton}
            onPress={() => onTrimChange(clip.id, Math.max(0, clip.trimStart - TRIM_STEP_MS), clip.trimEnd)}
          >
            <Text style={styles.stepButtonText}>-</Text>
          </Pressable>
          <Pressable
            style={styles.stepButton}
            onPress={() => onTrimChange(clip.id, clip.trimStart + TRIM_STEP_MS, clip.trimEnd)}
          >
            <Text style={styles.stepButtonText}>+</Text>
          </Pressable>

          <Text style={styles.trimLabel}>끝</Text>
          <Pressable
            style={styles.stepButton}
            onPress={() => onTrimChange(clip.id, clip.trimStart, clip.trimEnd - TRIM_STEP_MS)}
          >
            <Text style={styles.stepButtonText}>-</Text>
          </Pressable>
          <Pressable
            style={styles.stepButton}
            onPress={() => onTrimChange(clip.id, clip.trimStart, Math.min(asset.duration, clip.trimEnd + TRIM_STEP_MS))}
          >
            <Text style={styles.stepButtonText}>+</Text>
          </Pressable>
        </View>
      </View>

      <Pressable style={styles.hideButton} onPress={() => onHide(clip.id)}>
        <Text style={styles.hideButtonText}>숨기기</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 8,
    backgroundColor: 'white',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  containerActive: {
    backgroundColor: '#f0f0f0',
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 6,
    backgroundColor: '#eee',
  },
  details: {
    flex: 1,
    gap: 4,
  },
  duration: {
    fontSize: 13,
    fontWeight: '600',
  },
  trimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trimLabel: {
    fontSize: 11,
    color: '#666',
  },
  stepButton: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  hideButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
  },
  hideButtonText: {
    fontSize: 12,
    color: '#c62828',
  },
});

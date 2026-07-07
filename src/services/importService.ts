import * as ImagePicker from 'expo-image-picker';

import { localRepositories } from '../database';
import { buildRecordedAsset } from '../domain/asset/logic';
import { buildRecordedClip } from '../domain/clip/logic';
import { afterClipEdited, afterClipRecorded, canEditClips } from '../domain/project/logic';
import { logEvent } from './eventLogger';
import { generateId } from './id';
import { assertNativeFeatureAvailable } from './platformSupport';
import { generateThumbnails } from './thumbnails';

// Phase 3: bring previously-shot videos into a project's timeline through
// the exact same Clip/Asset/Composition pipeline as recorded clips — an
// imported video is just a new Asset. This is the entire reason Asset/Clip
// were split apart in Phase 1 (architecture doc v4.1 §7): nothing else here
// needed to change for this feature to exist.
//
// Web-gated even though expo-image-picker itself has web support: the
// returned URI is an ephemeral blob: URL there (doesn't survive a reload),
// and thumbnail generation (expo-video-thumbnails) is native-only, so the
// result would be unreliable rather than cleanly unsupported.
export async function importVideosIntoProject(projectId: string): Promise<number> {
  assertNativeFeatureAvailable('영상 가져오기');

  const project = await localRepositories.projects.getById(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);
  if (!canEditClips(project.status)) {
    throw new Error(`Cannot import while project is ${project.status}`);
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (permission.status !== 'granted') {
    throw new Error('사진첩 접근 권한이 필요합니다.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    allowsMultipleSelection: true,
  });
  if (result.canceled) return 0;

  const videoTrack = await localRepositories.tracks.getByProjectAndType(projectId, 'video');
  if (!videoTrack) throw new Error(`Invariant violated: project ${projectId} has no video track`);

  let importedCount = 0;

  for (const pickedAsset of result.assets) {
    if (pickedAsset.type !== 'video' || !pickedAsset.duration) continue;

    const durationMs = pickedAsset.duration;
    const { thumbnailUri, posterFrameUri } = await generateThumbnails(pickedAsset.uri, durationMs);
    const now = new Date().toISOString();

    const asset = buildRecordedAsset({
      id: generateId(),
      projectId,
      localUri: pickedAsset.uri,
      durationMs,
      // The picker doesn't report fps — unlike recorded clips (where we know
      // the camera's configured fps), imported footage's true fps is unknown
      // without deeper file probing. Not currently read by the native
      // composer (informational only), so an approximation is low-risk here.
      fps: 30,
      resolution: { width: pickedAsset.width, height: pickedAsset.height },
      thumbnailUri,
      posterFrameUri,
      now,
    });
    await localRepositories.assets.create(asset);

    const existingClips = await localRepositories.clips.listByTrack(videoTrack.id, { includeHidden: true });
    const clip = buildRecordedClip({
      id: generateId(),
      projectId,
      trackId: videoTrack.id,
      assetId: asset.id,
      orderIndex: existingClips.length,
      durationMs,
      now,
    });
    await localRepositories.clips.create(clip);

    await logEvent(projectId, 'ClipRecorded', {
      clipId: clip.id,
      assetId: asset.id,
      orderIndex: clip.orderIndex,
      source: 'import',
    });
    importedCount++;
  }

  if (importedCount > 0) {
    // Covers both a `draft` project's first clip and re-opening an already
    // `completed`/`synced`/`error` project — composing the two existing
    // transition rules handles every starting status correctly (see
    // domain/project/logic.ts for each rule individually).
    const nextStatus = afterClipEdited(afterClipRecorded(project.status));
    await localRepositories.projects.update(projectId, {
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    });
  }

  return importedCount;
}

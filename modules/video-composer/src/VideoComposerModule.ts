import { NativeModule, requireNativeModule } from 'expo';

import { CompositionSpec } from '../../../src/domain/composition/types';
import { ComposeResult } from './VideoComposer.types';

// Public contract for the composition layer (architecture doc v4.1 §1).
// Phase 1 (M3) implements iOS via AVMutableComposition/AVAssetExportSession and
// Android via Media3 Transformer, reading only the `video` track and ignoring
// transitionIn/effects/rotation/crop/transform. This signature must not change
// when those fields become load-bearing later — only the native bodies grow.
declare class VideoComposerModule extends NativeModule<{}> {
  composeAsync(spec: CompositionSpec): Promise<ComposeResult>;
}

export default requireNativeModule<VideoComposerModule>('VideoComposer');

import { registerWebModule, NativeModule } from 'expo';

// VideoComposerModule is not available on the web platform.
class VideoComposerModule extends NativeModule<{}> {}

export default registerWebModule(VideoComposerModule, 'VideoComposerModule');

import AVFoundation
import ExpoModulesCore

enum VideoComposerError: Error, CustomStringConvertible {
  case invalidSpec(String)
  case compositionFailed(String)

  var description: String {
    switch self {
    case .invalidSpec(let message): return "Invalid CompositionSpec: \(message)"
    case .compositionFailed(let message): return "Composition failed: \(message)"
    }
  }
}

// Phase 1: hard-cut concatenation of the `video` track only, via
// AVMutableComposition + AVAssetExportSession. transitionIn/effects/rotation/
// crop/transform are part of CompositionSpec (architecture doc v4.1 §1) but
// intentionally ignored here — only this body grows later.
//
// Uses `exportAsynchronously(completionHandler:)` rather than the newer
// `export(to:as:) async` API, which is iOS 18+ only — Expo SDK 57's minimum
// deployment target is 16.4, so the older API is the one that actually covers
// the supported range.
public class VideoComposerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VideoComposer")

    AsyncFunction("composeAsync") { (spec: [String: Any]) async throws -> [String: Any] in
      let (exportSession, outputUrl) = try Self.buildExportSession(spec: spec)

      try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
        exportSession.exportAsynchronously {
          switch exportSession.status {
          case .completed:
            continuation.resume(returning: ())
          default:
            let message = exportSession.error?.localizedDescription
              ?? "export did not complete (status: \(exportSession.status.rawValue))"
            continuation.resume(throwing: VideoComposerError.compositionFailed(message))
          }
        }
      }

      let durationMs = try Self.durationMs(of: outputUrl)
      return ["outputUri": outputUrl.absoluteString, "durationMs": durationMs]
    }
  }

  private static func buildExportSession(spec: [String: Any]) throws -> (AVAssetExportSession, URL) {
    guard let tracks = spec["tracks"] as? [[String: Any]] else {
      throw VideoComposerError.invalidSpec("missing tracks")
    }
    guard let videoTrackSpec = tracks.first(where: { ($0["type"] as? String) == "video" }) else {
      throw VideoComposerError.invalidSpec("missing video track")
    }
    guard let items = videoTrackSpec["items"] as? [[String: Any]], !items.isEmpty else {
      throw VideoComposerError.invalidSpec("video track has no items")
    }

    let composition = AVMutableComposition()
    guard
      let compositionVideoTrack = composition.addMutableTrack(
        withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid),
      let compositionAudioTrack = composition.addMutableTrack(
        withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)
    else {
      throw VideoComposerError.compositionFailed("could not create composition tracks")
    }

    var cursor: CMTime = .zero

    for item in items {
      guard (item["mediaType"] as? String) == "video" else {
        throw VideoComposerError.invalidSpec("unsupported mediaType for composition: \(item["mediaType"] ?? "nil")")
      }
      guard
        let sourceUriString = item["sourceUri"] as? String,
        let sourceUrl = URL(string: sourceUriString),
        let trimStartMs = item["trimStart"] as? Double,
        let trimEndMs = item["trimEnd"] as? Double
      else {
        throw VideoComposerError.invalidSpec("invalid composition item")
      }

      let sourceAsset = AVURLAsset(url: sourceUrl)
      let timeRange = CMTimeRange(
        start: CMTime(seconds: trimStartMs / 1000, preferredTimescale: 600),
        end: CMTime(seconds: trimEndMs / 1000, preferredTimescale: 600)
      )

      if let sourceVideoTrack = sourceAsset.tracks(withMediaType: .video).first {
        try compositionVideoTrack.insertTimeRange(timeRange, of: sourceVideoTrack, at: cursor)
      }
      if let sourceAudioTrack = sourceAsset.tracks(withMediaType: .audio).first {
        try compositionAudioTrack.insertTimeRange(timeRange, of: sourceAudioTrack, at: cursor)
      }

      cursor = CMTimeAdd(cursor, timeRange.duration)
    }

    let totalDuration = cursor

    // Phase 2: additional audio tracks (AI narration/music) layered on top of
    // the original per-clip camera audio. Each is placed starting at t=0 and
    // clipped to the overall video duration — fadeIn/fadeOut are part of
    // AudioCompositionItem but not implemented yet (volume is constant).
    var audioMixParameters: [AVMutableAudioMixInputParameters] = []
    let audioTrackSpecs = tracks.filter { ($0["type"] as? String) == "audio" }

    for audioTrackSpec in audioTrackSpecs {
      guard let audioItems = audioTrackSpec["items"] as? [[String: Any]] else { continue }

      for audioItem in audioItems {
        guard
          let sourceUriString = audioItem["sourceUri"] as? String,
          let sourceUrl = URL(string: sourceUriString),
          let trimStartMs = audioItem["trimStart"] as? Double,
          let trimEndMs = audioItem["trimEnd"] as? Double
        else {
          continue
        }

        let sourceAsset = AVURLAsset(url: sourceUrl)
        guard let sourceAudioTrack = sourceAsset.tracks(withMediaType: .audio).first else { continue }
        guard
          let overlayCompositionTrack = composition.addMutableTrack(
            withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)
        else { continue }

        let requestedRange = CMTimeRange(
          start: CMTime(seconds: trimStartMs / 1000, preferredTimescale: 600),
          end: CMTime(seconds: trimEndMs / 1000, preferredTimescale: 600)
        )
        let clippedDuration = CMTimeMinimum(requestedRange.duration, totalDuration)
        let clippedRange = CMTimeRange(start: requestedRange.start, duration: clippedDuration)

        try overlayCompositionTrack.insertTimeRange(clippedRange, of: sourceAudioTrack, at: .zero)

        let volume = (audioItem["volume"] as? Double).map { Float($0) } ?? 1.0
        let inputParams = AVMutableAudioMixInputParameters(track: overlayCompositionTrack)
        inputParams.setVolume(volume, at: .zero)
        audioMixParameters.append(inputParams)
      }
    }

    let outputUrl = FileManager.default.temporaryDirectory
      .appendingPathComponent(ProcessInfo.processInfo.globallyUniqueString)
      .appendingPathExtension("mp4")

    guard
      let exportSession = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetHighestQuality)
    else {
      throw VideoComposerError.compositionFailed("could not create export session")
    }
    exportSession.outputURL = outputUrl
    exportSession.outputFileType = .mp4

    if !audioMixParameters.isEmpty {
      let audioMix = AVMutableAudioMix()
      audioMix.inputParameters = audioMixParameters
      exportSession.audioMix = audioMix
    }

    return (exportSession, outputUrl)
  }

  private static func durationMs(of url: URL) throws -> Double {
    let asset = AVURLAsset(url: url)
    return CMTimeGetSeconds(asset.duration) * 1000
  }
}

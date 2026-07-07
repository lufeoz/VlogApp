package com.vlogapp.videocomposer

import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.EditedMediaItemSequence
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.Transformer
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class VideoComposeException(message: String) : CodedException(message)

// Phase 1: hard-cut concatenation of the `video` track only, via Media3
// Transformer (androidx.media3:media3-transformer:1.10.1). transitionIn/
// effects/rotation/crop/transform are part of CompositionSpec (architecture
// doc v4.1 §1) but intentionally ignored here — only this body grows later.
class VideoComposerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("VideoComposer")

    AsyncFunction("composeAsync") { spec: Map<String, Any?>, promise: Promise ->
      // Transformer must be built/started/callback-notified on a thread with a
      // Looper (main thread) — Expo AsyncFunction bodies aren't guaranteed to
      // run there, so this is dispatched explicitly.
      Handler(Looper.getMainLooper()).post {
        try {
          val (transformer, composition, outputFile) = buildTransformer(spec, promise)
          transformer.start(composition, outputFile.absolutePath)
        } catch (e: Exception) {
          promise.reject(VideoComposeException(e.message ?: "unknown composition error"))
        }
      }
    }
  }

  private fun buildTransformer(
    spec: Map<String, Any?>,
    promise: Promise
  ): Triple<Transformer, Composition, File> {
    val reactContext = appContext.reactContext ?: throw VideoComposeException("React context unavailable")

    @Suppress("UNCHECKED_CAST")
    val tracks = spec["tracks"] as? List<Map<String, Any?>>
      ?: throw VideoComposeException("missing tracks")
    val videoTrackSpec = tracks.firstOrNull { it["type"] == "video" }
      ?: throw VideoComposeException("missing video track")
    @Suppress("UNCHECKED_CAST")
    val items = videoTrackSpec["items"] as? List<Map<String, Any?>>
    if (items.isNullOrEmpty()) throw VideoComposeException("video track has no items")

    val editedItems = items.map { item ->
      val mediaType = item["mediaType"] as? String
      if (mediaType != "video") {
        throw VideoComposeException("unsupported mediaType for composition: $mediaType")
      }
      val sourceUri = item["sourceUri"] as? String
        ?: throw VideoComposeException("composition item missing sourceUri")
      val trimStartMs = (item["trimStart"] as? Number)?.toLong()
        ?: throw VideoComposeException("composition item missing trimStart")
      val trimEndMs = (item["trimEnd"] as? Number)?.toLong()
        ?: throw VideoComposeException("composition item missing trimEnd")

      val mediaItem = MediaItem.Builder()
        .setUri(sourceUri)
        .setClippingConfiguration(
          MediaItem.ClippingConfiguration.Builder()
            .setStartPositionMs(trimStartMs)
            .setEndPositionMs(trimEndMs)
            .build()
        )
        .build()

      EditedMediaItem.Builder(mediaItem).build()
    }

    val videoSequence = EditedMediaItemSequence.withAudioAndVideoFrom(editedItems)
    val sequences = mutableListOf(videoSequence)

    // Phase 2: additional audio tracks (AI narration/music) layered on top of
    // the original per-clip camera audio. Placed as their own sequence so
    // Media3 mixes them with the video sequence's audio rather than replacing
    // it. Volume/fade control (media3-effect) isn't implemented yet — always
    // plays at source volume, unlike iOS which does apply AudioMix volume.
    val audioTrackSpecs = tracks.filter { it["type"] == "audio" }
    for (audioTrackSpec in audioTrackSpecs) {
      @Suppress("UNCHECKED_CAST")
      val audioItems = audioTrackSpec["items"] as? List<Map<String, Any?>> ?: continue

      val overlayEditedItems = audioItems.mapNotNull { audioItem ->
        val sourceUri = audioItem["sourceUri"] as? String ?: return@mapNotNull null
        val trimStartMs = (audioItem["trimStart"] as? Number)?.toLong() ?: 0L
        val trimEndMs = (audioItem["trimEnd"] as? Number)?.toLong() ?: return@mapNotNull null

        val mediaItem = MediaItem.Builder()
          .setUri(sourceUri)
          .setClippingConfiguration(
            MediaItem.ClippingConfiguration.Builder()
              .setStartPositionMs(trimStartMs)
              .setEndPositionMs(trimEndMs)
              .build()
          )
          .build()

        EditedMediaItem.Builder(mediaItem).build()
      }

      if (overlayEditedItems.isNotEmpty()) {
        sequences.add(EditedMediaItemSequence.withAudioFrom(overlayEditedItems))
      }
    }

    val composition = Composition.Builder(*sequences.toTypedArray()).build()

    val outputFile = File.createTempFile("export-", ".mp4", reactContext.cacheDir)

    val transformer = Transformer.Builder(reactContext)
      .setVideoMimeType(MimeTypes.VIDEO_H265)
      .addListener(object : Transformer.Listener {
        override fun onCompleted(composition: Composition, exportResult: ExportResult) {
          promise.resolve(
            mapOf(
              "outputUri" to Uri.fromFile(outputFile).toString(),
              "durationMs" to exportResult.durationMs
            )
          )
        }

        override fun onError(
          composition: Composition,
          exportResult: ExportResult,
          exportException: ExportException
        ) {
          promise.reject(VideoComposeException(exportException.message ?: "export failed"))
        }
      })
      .build()

    return Triple(transformer, composition, outputFile)
  }
}

package expo.modules.receiptocr

import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** F04: reconocimiento de texto local con Google ML Kit (modelo incluido, sin internet). */
class ReceiptOcrModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ReceiptOcr")

    AsyncFunction("recognizeText") { uri: String, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("ERR_OCR_CONTEXT", "El contexto de la app no está disponible", null)
        return@AsyncFunction
      }

      val image = try {
        // fromFilePath respeta la rotación EXIF de la foto
        InputImage.fromFilePath(context, Uri.parse(uri))
      } catch (e: Exception) {
        promise.reject("ERR_OCR_IMAGE", "No se pudo abrir la imagen", e)
        return@AsyncFunction
      }

      val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
      recognizer.process(image)
        .addOnSuccessListener { result ->
          val lines = result.textBlocks.flatMap { block ->
            block.lines.mapNotNull { line ->
              val box = line.boundingBox ?: return@mapNotNull null
              mapOf(
                "text" to line.text,
                "frame" to mapOf(
                  "left" to box.left,
                  "top" to box.top,
                  "width" to box.width(),
                  "height" to box.height()
                )
              )
            }
          }
          promise.resolve(mapOf("lines" to lines))
        }
        .addOnFailureListener { e -> promise.reject("ERR_OCR_FAILED", "No se pudo leer la imagen", e) }
        .addOnCompleteListener { recognizer.close() }
    }
  }
}

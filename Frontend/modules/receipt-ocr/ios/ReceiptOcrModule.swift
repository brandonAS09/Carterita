import ExpoModulesCore
import ImageIO
import UIKit
import Vision

/// F04: reconocimiento de texto local con Apple Vision.
/// Sin validar: no hay Mac ni cuenta de desarrollador disponibles (R3 del Sprint 4).
public class ReceiptOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ReceiptOcr")

    AsyncFunction("recognizeText") { (uri: URL, promise: Promise) in
      guard let image = UIImage(contentsOfFile: uri.path), let cgImage = image.cgImage else {
        promise.reject("ERR_OCR_IMAGE", "No se pudo abrir la imagen")
        return
      }

      let request = VNRecognizeTextRequest { request, error in
        if let error {
          promise.reject("ERR_OCR_FAILED", error.localizedDescription)
          return
        }
        let width = image.size.width
        let height = image.size.height
        let observations = request.results as? [VNRecognizedTextObservation] ?? []
        let lines: [[String: Any]] = observations.compactMap { observation in
          guard let text = observation.topCandidates(1).first?.string else { return nil }
          // Vision usa coordenadas normalizadas con el origen abajo a la izquierda
          let box = observation.boundingBox
          return [
            "text": text,
            "frame": [
              "left": box.minX * width,
              "top": (1 - box.maxY) * height,
              "width": box.width * width,
              "height": box.height * height,
            ],
          ]
        }
        promise.resolve(["lines": lines])
      }
      request.recognitionLevel = .accurate
      request.usesLanguageCorrection = false
      request.recognitionLanguages = ["es-MX", "es-ES", "en-US"]

      let orientation = CGImagePropertyOrientation(image.imageOrientation)
      let handler = VNImageRequestHandler(cgImage: cgImage, orientation: orientation)
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          try handler.perform([request])
        } catch {
          promise.reject("ERR_OCR_FAILED", error.localizedDescription)
        }
      }
    }
  }
}

private extension CGImagePropertyOrientation {
  init(_ orientation: UIImage.Orientation) {
    switch orientation {
    case .up: self = .up
    case .upMirrored: self = .upMirrored
    case .down: self = .down
    case .downMirrored: self = .downMirrored
    case .left: self = .left
    case .leftMirrored: self = .leftMirrored
    case .right: self = .right
    case .rightMirrored: self = .rightMirrored
    @unknown default: self = .up
    }
  }
}

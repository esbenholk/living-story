/**
 * useFaceCrops.js
 *
 * Runs MediaPipe FaceLandmarker and returns hard polygon-masked PNG blobs
 * for left eye, right eye, and mouth.
 *
 * Coordinate fix: MediaPipe may return landmarks in either normalised (0-1)
 * or pixel-space coordinates depending on version/platform. We auto-detect
 * by checking whether maxX > 1, and scale accordingly.
 *
 * Masking: uses document.createElement("canvas") + destination-in composite.
 * No OffscreenCanvas (avoids GPU context / getImageData zero-pixel bugs).
 */

import { useState, useCallback } from "react";
import {
  FaceLandmarker,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/+esm";

// ---------------------------------------------------------------------------
// Landmark contour indices (478-point mesh)
// ---------------------------------------------------------------------------

const LEFT_EYE_CONTOUR = [
  33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7,
];
const RIGHT_EYE_CONTOUR = [
  362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381,
  382,
];
const MOUTH_OUTER_CONTOUR = [
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84,
  181, 91, 146,
];
const MOUTH_INNER_CONTOUR = [
  78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87,
  178, 88, 95,
];

const EYE_PADDING = 0.55;
const MOUTH_PADDING = 0.45;

// ---------------------------------------------------------------------------
// Singleton FaceLandmarker
// ---------------------------------------------------------------------------

let _landmarkerPromise = null;
async function getLandmarker() {
  if (_landmarkerPromise) return _landmarkerPromise;
  _landmarkerPromise = (async () => {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm",
    );
    return FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "IMAGE",
      numFaces: 1,
    });
  })();
  return _landmarkerPromise;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function paddedBBox(points, imgW, imgH, padding) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const pw = (maxX - minX) * padding;
  const ph = (maxY - minY) * padding;
  const x = Math.max(0, Math.floor(minX - pw));
  const y = Math.max(0, Math.floor(minY - ph));
  const x2 = Math.min(imgW, Math.ceil(maxX + pw));
  const y2 = Math.min(imgH, Math.ceil(maxY + ph));
  return { x, y, w: Math.max(1, x2 - x), h: Math.max(1, y2 - y) };
}

/**
 * Crop sourceImg at bbox, then mask with the landmark polygon.
 * Uses two regular canvas elements + destination-in compositing.
 *
 *   Canvas A: the image crop
 *   Canvas B: white polygon on transparent background (the mask)
 *   Canvas A: draw B onto A with "destination-in"
 *             → pixels outside polygon become transparent
 *             → pixels inside keep original colour
 */
function cropWithPolygon(sourceImg, points, bbox, innerPoints = null) {
  const { x, y, w, h } = bbox;

  // Canvas A — image crop
  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = w;
  cropCanvas.height = h;
  const cropCtx = cropCanvas.getContext("2d");
  cropCtx.drawImage(sourceImg, x, y, w, h, 0, 0, w, h);

  // Canvas B — white polygon mask on transparent background
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = w;
  maskCanvas.height = h;
  const maskCtx = maskCanvas.getContext("2d");

  maskCtx.fillStyle = "#ffffff";
  maskCtx.beginPath();
  points.forEach((p, i) => {
    // Translate points to be relative to the crop box origin
    i === 0
      ? maskCtx.moveTo(p.x - x, p.y - y)
      : maskCtx.lineTo(p.x - x, p.y - y);
  });
  maskCtx.closePath();

  if (innerPoints) {
    // Evenodd punches a hole — used for mouth opening
    innerPoints.forEach((p, i) => {
      i === 0
        ? maskCtx.moveTo(p.x - x, p.y - y)
        : maskCtx.lineTo(p.x - x, p.y - y);
    });
    maskCtx.closePath();
  }

  maskCtx.fill(innerPoints ? "evenodd" : "nonzero");

  // Apply mask onto the crop: keep crop pixels only where mask is opaque
  cropCtx.globalCompositeOperation = "destination-in";
  cropCtx.drawImage(maskCanvas, 0, 0);
  cropCtx.globalCompositeOperation = "source-over"; // reset

  return new Promise((resolve) => cropCanvas.toBlob(resolve, "image/png"));
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFaceCrops() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const extractCrops = useCallback(async (file) => {
    setLoading(true);
    setError(null);

    try {
      const url = URL.createObjectURL(file);
      const img = await new Promise((res, rej) => {
        const el = new Image();
        el.onload = () => res(el);
        el.onerror = rej;
        el.src = url;
      });
      URL.revokeObjectURL(url);

      const W = img.naturalWidth;
      const H = img.naturalHeight;

      const landmarker = await getLandmarker();
      const result = landmarker.detect(img);

      if (!result.faceLandmarks?.length) {
        console.log("[useFaceCrops] No face detected.");
        return { leftEye: null, rightEye: null, mouth: null };
      }

      const lm = result.faceLandmarks[0];

      // Auto-detect coordinate space
      const maxX = Math.max(...lm.map((p) => p.x));
      const isPixelSpace = maxX > 1;

      const toPixels = (indices) =>
        indices.map((i) => ({
          x: isPixelSpace ? lm[i].x : lm[i].x * W,
          y: isPixelSpace ? lm[i].y : lm[i].y * H,
        }));

      const leftEyePts = toPixels(LEFT_EYE_CONTOUR);
      const rightEyePts = toPixels(RIGHT_EYE_CONTOUR);
      const mouthOuterPts = toPixels(MOUTH_OUTER_CONTOUR);
      const mouthInnerPts = toPixels(MOUTH_INNER_CONTOUR);

      const [leftEye, rightEye, mouth] = await Promise.all([
        cropWithPolygon(
          img,
          leftEyePts,
          paddedBBox(leftEyePts, W, H, EYE_PADDING),
        ),
        cropWithPolygon(
          img,
          rightEyePts,
          paddedBBox(rightEyePts, W, H, EYE_PADDING),
        ),
        cropWithPolygon(
          img,
          mouthOuterPts,
          paddedBBox(mouthOuterPts, W, H, MOUTH_PADDING),
        ),
      ]);

      return { leftEye, rightEye, mouth };
    } catch (err) {
      console.error("[useFaceCrops] error:", err);
      setError(err);
      return { leftEye: null, rightEye: null, mouth: null };
    } finally {
      setLoading(false);
    }
  }, []);

  return { extractCrops, loading, error };
}

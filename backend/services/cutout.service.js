/**
 * cutout.service.js
 *
 * Calls the Python sidecar's /cutout endpoint using Node's native fetch and
 * FormData (Node 18+) — no extra dependencies needed.
 *
 * When the frontend has run MediaPipe and sent pre-cropped face PNGs, those
 * buffers are forwarded to the sidecar so it can skip detection and upload
 * them straight to Cloudinary.
 */

const SIDECAR_URL = process.env.REMBG_URL || "http://localhost:5001";

/**
 * @param {string} imageUrl        — Cloudinary URL of the uploaded photo
 * @param {{ day: string|number, uploaderName: string }} meta
 * @param {{ left_eye?, right_eye?, mouth? }} [cropFiles] — multer file objects (optional)
 */
export async function getCutouts(imageUrl, meta, cropFiles = {}) {
  const form = new FormData();
  form.append("image_url", imageUrl);
  form.append("day", String(meta.day ?? ""));
  form.append("uploaderName", meta.uploaderName ?? "");

  // Forward pre-cropped face PNG buffers when the frontend supplied them
  for (const key of ["left_eye", "right_eye", "mouth"]) {
    const f = cropFiles[key];
    if (f?.buffer) {
      form.append(
        key,
        new Blob([f.buffer], { type: f.mimetype || "image/png" }),
        `${key}.png`,
      );
    }
  }

  const res = await fetch(`${SIDECAR_URL}/cutout`, {
    method: "POST",
    body: form,
    // Do NOT set Content-Type manually — fetch sets it automatically with the
    // correct multipart boundary when the body is a FormData instance.
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sidecar /cutout failed (${res.status}): ${text}`);
  }

  return res.json();
}

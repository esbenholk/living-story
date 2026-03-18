/**
 * upload.js
 *
 * XHR progress is capped at 85% — that represents "data fully sent to server".
 * The remaining 0→85 comes from upload.onprogress, and 85→100 fires only when
 * the server responds (i.e. the full pipeline is complete: Cloudinary, sidecar,
 * LLaVA, Mistral). This prevents the progress bar from sitting at 100% for a
 * long time while the server is still working.
 */

export async function uploadImage(
  { file, uploaderName, faceCrops, heroTagId },
  onProgress,
) {
  const formData = new FormData();
  formData.append("image", file);

  if (uploaderName) formData.append("uploaderName", uploaderName);
  if (heroTagId) formData.append("heroTagId", heroTagId);

  if (faceCrops) {
    if (faceCrops.leftEye)
      formData.append("left_eye", faceCrops.leftEye, "left_eye.png");
    if (faceCrops.rightEye)
      formData.append("right_eye", faceCrops.rightEye, "right_eye.png");
    if (faceCrops.mouth) formData.append("mouth", faceCrops.mouth, "mouth.png");
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const base = import.meta.env.VITE_API_URL || "http://localhost:3001";
    xhr.open("POST", `${base}/api/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        // Cap at 85 — the server pipeline hasn't finished yet
        const pct = Math.round((e.loaded / e.total) * 85);
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        onProgress(100); // server fully done
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(xhr.responseText));
      }
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(formData);
  });
}

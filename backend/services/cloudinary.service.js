import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadImage(buffer, filename, context = {}) {
  const contextStr = Object.entries(context)
    .map(([k, v]) => `${k}=${String(v).replace(/[|=]/g, " ")}`)
    .join("|");

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "living-story/originals",
        public_id: filename,
        categorization: "google_tagging",
        auto_tagging: 0.6,
        colors: true,
        context: contextStr || undefined,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );
    stream.end(buffer);
  });
}

export async function updateContext(publicIds, context) {
  // Cloudinary context is key=value pairs joined by |
  const contextStr = Object.entries(context)
    .map(([k, v]) => `${k}=${String(v).replace(/[|=]/g, " ")}`) // sanitise | and =
    .join("|");

  // Update all assets in parallel
  await Promise.all(
    publicIds.map((id) =>
      cloudinary.uploader
        .add_context(contextStr, [id])
        .catch((e) =>
          console.warn(`Failed to update context for ${id}:`, e.message),
        ),
    ),
  );
}

export function extractPublicIds(cloudResult, cutouts) {
  const ids = [cloudResult.public_id];
  for (const url of Object.values(cutouts)) {
    if (url && typeof url === "string") {
      // Extract public_id from Cloudinary URL
      // e.g. https://res.cloudinary.com/cloud/image/upload/v123/living-story/cutouts/abc_subject
      const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/);
      if (match) ids.push(match[1]);
    }
  }
  return ids;
}

// Injects a Cloudinary transformation into an upload URL so the browser
// fetches a right-sized, auto-compressed image instead of the full original.
//   w_<n>   : target width — pick this per call site based on actual render size
//   c_limit : only shrinks, never upscales past the original
//   q_auto  : Cloudinary picks the best quality for the format
//   f_auto  : Cloudinary picks the best format (webp/avif) for the browser
export function cloudinaryResize(url, width = 800) {
  if (!url) return url;
  return url.replace("/upload/", `/upload/w_${width},c_limit,q_auto,f_auto/`);
}
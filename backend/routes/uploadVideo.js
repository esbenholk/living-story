import express from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import {
  notifyRecordingUploaded,
  notifyRecordingUploadFailed,
} from "../telegram/masterBot.js";

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024, // 200 MB
  },
  fileFilter(req, file, cb) {
    if (
      file.mimetype === "video/mp4" ||
      file.mimetype === "application/octet-stream"
    ) {
      cb(null, true);
      return;
    }

    cb(new Error(`Unsupported file type: ${file.mimetype}`));
  },
});

function toCloudinaryContext(context = {}) {
  return Object.entries(context)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${String(v).replace(/[|=]/g, " ")}`)
    .join("|");
}

function sanitizePublicId(value) {
  return String(value)
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9/_-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 140);
}

export async function uploadVideo(buffer, filename, context = {}) {
  const contextStr = toCloudinaryContext(context);
  const publicId = sanitizePublicId(filename);

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "video",
        folder: "living-story/recordings",
        public_id: publicId,
        overwrite: false,
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

router.post(
  "/recordings/upload",
  upload.single("video"),
  async (req, res) => {
    const recordingIdFromBody =
      req.body?.recordingId || req.body?.sessionId || null;

    try {
      const videoFile = req.file;

      if (!videoFile) {
        return res.status(400).json({
          success: false,
          error: "video required",
        });
      }

      const {
        recordingId,
        sessionId,
        storyId,
        userId,
        day,
        durationSeconds,
        width,
        height,
        frameRate,
        framesWritten,
      } = req.body;

      const finalRecordingId =
        recordingId || sessionId || `recording_${randomUUID()}`;

      const filename = [
        "recording",
        storyId || "living-story",
        day ? `day_${day}` : null,
        finalRecordingId,
      ]
        .filter(Boolean)
        .join("_");

      console.log("[VIDEO_UPLOAD] Received recording:", {
        recordingId: finalRecordingId,
        originalname: videoFile.originalname,
        mimetype: videoFile.mimetype,
        size: videoFile.size,
      });

      const cloudResult = await uploadVideo(videoFile.buffer, filename, {
        kind: "unity_main_camera_recording",
        recordingId: finalRecordingId,
        sessionId,
        storyId,
        userId,
        day,
        durationSeconds,
        width,
        height,
        frameRate,
        framesWritten,
        originalFilename: videoFile.originalname,
      });

      const responsePayload = {
        success: true,
        recordingId: finalRecordingId,
        sessionId: sessionId || finalRecordingId,
        public_id: cloudResult.public_id,
        secure_url: cloudResult.secure_url,
        url: cloudResult.secure_url,
        resource_type: cloudResult.resource_type,
        duration: cloudResult.duration,
        bytes: cloudResult.bytes,
        format: cloudResult.format,
        width: cloudResult.width,
        height: cloudResult.height,
        created_at: cloudResult.created_at,
      };

      res.json(responsePayload);

      notifyRecordingUploaded(responsePayload).catch(e => {
        console.warn(
          "[VIDEO_UPLOAD] Uploaded, but Telegram notification failed:",
          e.message,
        );
      });
    } catch (err) {
      console.error("[VIDEO_UPLOAD] Failed:", err);

      const failedPayload = {
        recordingId: recordingIdFromBody,
        error: err.message,
      };

      notifyRecordingUploadFailed(failedPayload).catch(e => {
        console.warn(
          "[VIDEO_UPLOAD] Failed, and Telegram failure notification failed:",
          e.message,
        );
      });

      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  },
);

export default router;
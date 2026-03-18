/**
 * routes/health.js
 *
 * Proxies health checks from the frontend to the local ngrok services.
 * The frontend can't hit ngrok URLs directly (CORS), so the backend
 * does it and reports back with a simple ok/down response.
 */

import express from "express";

const router = express.Router();

const SIDECAR_URL =
  process.env.REMBG_URL || process.env.SIDECAR_URL || "http://localhost:5001";
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";

async function ping(url, timeoutMs = 5000) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// GET /api/health/sidecar
router.get("/sidecar", async (req, res) => {
  const ok = await ping(`${SIDECAR_URL}/health`);
  res.status(ok ? 200 : 503).json({ ok, service: "sidecar" });
});

// GET /api/health/ollama
router.get("/ollama", async (req, res) => {
  // Ollama's root path returns "Ollama is running" with 200
  const ok = await ping(`${OLLAMA_URL}`);
  res.status(ok ? 200 : 503).json({ ok, service: "ollama" });
});

export default router;

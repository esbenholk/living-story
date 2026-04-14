import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import uploadRouter from "./routes/upload.js";
import storyRouter from "./routes/story.js";
import eventsRouter from "./routes/events.js";
import healthRouter from "./routes/health.js";

const allowedOrigins = [
  "https://slopplot.online",
  "https://www.slopplot.online",
  "https://living-story-frontend.vercel.app",
  "http://localhost:5173", // local dev
  process.env.CLIENT_ORIGIN,
];

const app = express();
const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked: ${origin}`));
      }
    },
    credentials: true,
  }),
);

app.use((req, res, next) => {
  if (req.path === "/" || req.path === "/index.html") {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  }
  next();
});
app.use(express.json());

app.use("/api", uploadRouter);
app.use("/api", storyRouter);
app.use("/api", eventsRouter);

// in the app.use() section:
app.use("/api/health", healthRouter);

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  socket.on("disconnect", () => console.log("Client disconnected:", socket.id));
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));

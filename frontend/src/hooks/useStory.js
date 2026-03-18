import { useState, useEffect } from "react";

export function useStory() {
  const [events, setEvents] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [currentDay, setCurrentDay] = useState(null);
  const [currentConfig, setCurrentConfig] = useState(null);

  useEffect(() => {
    const base = import.meta.env.VITE_API_URL || "http://localhost:3001";

    fetch(`${base}/api/events`)
      .then((r) => r.json())
      .then(({ events, currentDay, currentConfig }) => {
        setEvents(events || []);
        setCurrentDay(currentDay || null);
        setCurrentConfig(currentConfig || null);
      })
      .catch(console.error);

    fetch(`${base}/api/story`)
      .then((r) => r.json())
      .then((data) => setChapters(data || []))
      .catch(console.error);
  }, []);

  function addEvent(payload) {
    setEvents((prev) => [
      ...prev,
      {
        id: payload.uploadEventId,
        day: payload.day,
        cloudinaryUrl: payload.cloudinaryUrl,
        cutouts: payload.cutouts,
        tags: payload.analysis?.tags || [],
        colours: payload.analysis?.colours || [],
        // Both description fields — short for timeline, long for chapters
        descriptionShort: payload.analysis?.descriptionShort || null,
        descriptionLong: payload.analysis?.descriptionLong || null,
        description: payload.analysis?.descriptionShort || null,
        heroTagId: payload.analysis?.heroTag?.id || null,
        uploaderName: payload.uploaderName,
        createdAt: payload.timestamp,
      },
    ]);

    if (payload.chapterText) {
      setChapters((prev) => [
        ...prev,
        {
          id: payload.uploadEventId,
          day: payload.day,
          headline: payload.headline,
          text: payload.chapterText,
          createdAt: payload.timestamp,
        },
      ]);
    }
  }

  return { events, chapters, currentDay, currentConfig, addEvent };
}

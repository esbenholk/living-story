import { useEffect } from 'react';
import { io } from 'socket.io-client';

let socket;

export function useSocket(onNewChapter) {
  useEffect(() => {
    socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001');

    socket.on('new_chapter', (data) => {
      onNewChapter(data);
    });

    socket.on('pipeline_error', (data) => {
      console.warn('Pipeline error:', data);
    });

    return () => {
      socket.disconnect();
    };
  }, []);
}

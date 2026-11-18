import { useState, useRef, useCallback, type DragEvent as ReactDragEvent } from 'react';

/**
 * Arrastrar y soltar un archivo sobre el chat. El contador evita el parpadeo
 * del overlay al pasar por elementos hijos (dragenter/dragleave anidados).
 */
export default function useFileDrop(onFile: (file: File) => void) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDragEnter = useCallback((e: ReactDragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    dragCounterRef.current += 1;
    setIsDragging(true);
  }, []);

  const handleDragOver = useCallback((e: ReactDragEvent<HTMLDivElement>) => {
    if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); // allow drop
  }, []);

  const handleDragLeave = useCallback((e: ReactDragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) onFile(file);
  }, [onFile]);

  return { isDragging, handleDragEnter, handleDragOver, handleDragLeave, handleDrop };
}

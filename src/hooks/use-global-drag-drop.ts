import { useEffect } from 'react';

/**
 * Global drag-drop support — WebView2 on Windows requires native DOM listeners
 * in the capture phase to ensure drops are allowed. React synthetic events and
 * dataTransfer.types checks are unreliable on WebView2.
 */
export function useGlobalDragDrop(): void {
  useEffect(() => {
    let isDraggingInternal = false;
    const onDragStart = () => { isDraggingInternal = true; };
    const onDragEnd = () => { isDraggingInternal = false; };
    const onDragOver = (e: DragEvent) => {
      if (!isDraggingInternal) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    };
    const onDrop = (e: DragEvent) => {
      if (!isDraggingInternal) return;
      // Prevent browser default (navigating to the dragged content).
      // Actual drop logic is handled by React onDrop on specific targets.
      e.preventDefault();
      isDraggingInternal = false;
    };
    document.addEventListener('dragstart', onDragStart, true);
    document.addEventListener('dragend', onDragEnd, true);
    document.addEventListener('dragover', onDragOver, true);
    document.addEventListener('drop', onDrop, true);
    return () => {
      document.removeEventListener('dragstart', onDragStart, true);
      document.removeEventListener('dragend', onDragEnd, true);
      document.removeEventListener('dragover', onDragOver, true);
      document.removeEventListener('drop', onDrop, true);
    };
  }, []);
}

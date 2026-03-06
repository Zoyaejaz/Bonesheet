import { useState, useCallback, useRef } from 'react';

type ResizeDirection = 'horizontal' | 'vertical';

export function useResizer(onResizeEnd: (id: string, newSize: number) => void) {
  const [isResizing, setIsResizing] = useState(false);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [resizeDelta, setResizeDelta] = useState(0);
  const [direction, setDirection] = useState<ResizeDirection>('horizontal');
  const startPosRef = useRef(0);
  const startSizeRef = useRef(0);
  const directionRef = useRef<ResizeDirection>('horizontal');

  const startResize = useCallback(
    (e: React.MouseEvent, id: string, initialSize: number, dir: ResizeDirection) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      setResizingId(id);
      setResizeDelta(0);
      setDirection(dir);
      directionRef.current = dir;
      startPosRef.current = dir === 'horizontal' ? e.clientX : e.clientY;
      startSizeRef.current = initialSize;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = directionRef.current === 'horizontal' 
          ? moveEvent.clientX - startPosRef.current
          : moveEvent.clientY - startPosRef.current;
        setResizeDelta(delta);
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        const delta = directionRef.current === 'horizontal' 
          ? upEvent.clientX - startPosRef.current
          : upEvent.clientY - startPosRef.current;
        
        const newSize = Math.max(directionRef.current === 'horizontal' ? 30 : 20, startSizeRef.current + delta);
        
        onResizeEnd(id, newSize);
        setIsResizing(false);
        setResizingId(null);
        setResizeDelta(0);
        
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [onResizeEnd]
  );

  return { isResizing, resizingId, resizeDelta, direction, startResize };
}

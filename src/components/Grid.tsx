"use client";

import { useMemo } from "react";
import { Cell } from "./Cell";
import { useSpreadsheetStore } from "@/store/useSpreadsheetStore";
import { useResizer } from "@/hooks/useResizer";
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, useEffect, useState } from "react";
import { DndContext, DragEndEvent, DragOverlay, pointerWithin, defaultDropAnimationSideEffects, MeasuringStrategy, MouseSensor, TouchSensor, useSensor, useSensors, useDraggable, useDroppable } from '@dnd-kit/core';
import { restrictToHorizontalAxis, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';

// Resize handle: thin strip at edge (original look). Sibling of draggable so resize doesn't trigger drag.
const RESIZE_HANDLE_SIZE = 4; // w-1 in Tailwind = 4px

function DraggableHeader({ id, label, onResizeStart, type, style, activeId, overId }: { id: string, label: string | number, onResizeStart: (e: React.MouseEvent) => void, type: 'col' | 'row', style: React.CSSProperties, activeId: string | null, overId: string | null }) {
  const { attributes, listeners, setNodeRef: setDraggableRef, transform, isDragging } = useDraggable({ id });
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id });

  const w = typeof style.width === 'number' ? style.width : 100;
  const h = typeof style.height === 'number' ? style.height : 32;

  const dynamicStyle: React.CSSProperties = {
    // CSS.Translate is from utilities. It works when imported directly or we can just template string it to guarantee safety.
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    zIndex: isDragging ? 50 : (style.zIndex ?? 1),
    opacity: isDragging ? 0.3 : 1, // Make the original ghost out so they follow the overlay
  };
  
  // Is this header currently being dragged over but is NOT the actively dragged header?
  const isDropTarget = isOver && activeId !== id && activeId?.split('-')[0] === type;

  return (
    <div
      ref={setDroppableRef}
      className={`absolute ${isDropTarget ? (type === 'col' ? 'border-r-4 border-r-blue-500' : 'border-b-4 border-b-blue-500') : ''}`}
      style={{ top: style.top, left: style.left, width: w, height: h }}
    >
      {/* Draggable - main header area (excludes thin resize strip) */}
      <div
        ref={setDraggableRef}
        {...attributes}
        {...listeners}
        className={`bg-[#f8f9fa] hover:bg-[#f1f3f4] border-r border-b border-gray-300 flex items-center justify-center font-medium text-[11px] text-gray-600 absolute ${isDragging ? 'bg-[#e8f0fe] border-[#1a73e8] text-[#1a73e8]' : ''} ${type === 'col' ? 'cursor-col-resize' : 'cursor-row-resize'}`}
        style={{
          top: 0,
          left: 0,
          width: type === 'col' ? w - RESIZE_HANDLE_SIZE : w,
          height: type === 'row' ? h - RESIZE_HANDLE_SIZE : h,
          ...dynamicStyle,
          touchAction: 'none' // REQUIRED for dnd-kit pointer sensors to track drag on absolutes
        }}
      >
        <div className="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing">
          {label}
        </div>
      </div>
      {/* Resize handle */}
      {type === 'col' ? (
        <div
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500 transition-colors z-40"
          onPointerDown={(e) => { e.stopPropagation(); onResizeStart(e as any); }}
          onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e); }}
        />
      ) : (
        <div
          className="absolute bottom-0 left-0 w-full h-1 cursor-row-resize hover:bg-blue-500 transition-colors z-40"
          onPointerDown={(e) => { e.stopPropagation(); onResizeStart(e as any); }}
          onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e); }}
        />
      )}
    </div>
  );
}

const EMPTY_OBJ: Record<string, number> = {};

export function Grid() {
  const columnWidths = useSpreadsheetStore((state) => state.document?.columnWidths) || EMPTY_OBJ;
  const rowHeights = useSpreadsheetStore((state) => state.document?.rowHeights) || EMPTY_OBJ;
  const updateColumnWidth = useSpreadsheetStore((state) => state.updateColumnWidth);
  const updateRowHeight = useSpreadsheetStore((state) => state.updateRowHeight);

  const rowCount = useSpreadsheetStore((state) => state.document?.rowCount || 100);
  const colCount = useSpreadsheetStore((state) => state.document?.colCount || 26);
  const addRows = useSpreadsheetStore((state) => state.addRows);
  const moveDimension = useSpreadsheetStore((state) => state.moveDimension);

  const { isResizing, resizingId, resizeDelta, direction, startResize } = useResizer((id, size) => {
    if (id.startsWith('col-')) {
      updateColumnWidth(id.replace('col-', ''), size);
    } else if (id.startsWith('row-')) {
      updateRowHeight(id.replace('row-', ''), size);
    }
  });

  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { 
        activationConstraint: { 
            distance: 8 
        } 
    }),
    useSensor(TouchSensor, { 
        activationConstraint: { 
            delay: 250, 
            tolerance: 5 
        } 
    })
  );

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };
  
  const handleDragOver = (event: any) => {
    setOverId(event.over?.id || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    setOverId(null);
    const { active, over } = event;

    if (over && active.id !== over.id) {
        const activeIdStr = String(active.id);
        const overIdStr = String(over.id);

        if (activeIdStr.startsWith('col-') && overIdStr.startsWith('col-')) {
            const oldIndex = parseInt(activeIdStr.split('-')[1], 10);
            const newIndex = parseInt(overIdStr.split('-')[1], 10);
            moveDimension('col', oldIndex, newIndex);
        } 
        else if (activeIdStr.startsWith('row-') && overIdStr.startsWith('row-')) {
            const oldIndex = parseInt(activeIdStr.split('-')[1], 10);
            const newIndex = parseInt(overIdStr.split('-')[1], 10);
            moveDimension('row', oldIndex, newIndex);
        }
    }
  };

  // Infinite Scroll via Enter key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        // Find if we are near the bottom of the container
        const el = parentRef.current;
        if (el) {
          const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
          if (isAtBottom) {
            addRows(50);
            
            // Try to gently scroll down just a bit to show newly added rows
            setTimeout(() => {
                el.scrollBy({ top: 32, behavior: 'smooth' }); // one row height
            }, 100);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addRows]);

  const parentRef = useRef<HTMLDivElement>(null);

  const getColumnWidth = (index: number) => {
    const col = String.fromCharCode(65 + index);
    let width = columnWidths[col] || 100;
    if (isResizing && direction === 'horizontal' && resizingId === `col-${col}`) {
      width = Math.max(30, width + resizeDelta);
    }
    return width;
  };

  const getRowHeight = (index: number) => {
    const rowNum = index + 1;
    let height = rowHeights[`${rowNum}`] || 32;
    if (isResizing && direction === 'vertical' && resizingId === `row-${rowNum}`) {
      height = Math.max(20, height + resizeDelta);
    }
    return height;
  };

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: getRowHeight,
    overscan: 5,
  });

  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: colCount,
    getScrollElement: () => parentRef.current,
    estimateSize: getColumnWidth,
    overscan: 5,
  });

  // Force virtualizers to remeasure items immediately during real-time resize, 
  // without waiting for the internal store commit to finish cycle
  useEffect(() => {
    if (isResizing && resizingId) {
        if (direction === 'horizontal') {
            const idx = resizingId.replace('col-', '').charCodeAt(0) - 65;
            columnVirtualizer.measure();
        } else {
            const idx = parseInt(resizingId.replace('row-', ''), 10) - 1;
            rowVirtualizer.measure();
        }
    }
  }, [resizeDelta, isResizing, resizingId, direction, columnVirtualizer, rowVirtualizer]);

  const colHeaders = useMemo(() => {
    return Array.from({ length: colCount }, (_, i) => String.fromCharCode(65 + i));
  }, [colCount]);

  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.4',
        },
      },
    }),
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      measuring={{
        droppable: {
          strategy: MeasuringStrategy.Always,
        },
      }}
      modifiers={activeId ? (String(activeId).startsWith('col-') ? [restrictToHorizontalAxis] : [restrictToVerticalAxis]) : []}
    >
      <div 
        ref={parentRef}
        className={`flex-1 overflow-auto bg-[#ffffff] shadow-inner relative ${isResizing ? (direction === 'horizontal' ? 'cursor-col-resize' : 'cursor-row-resize') + ' select-none' : ''}`}
      >
      <div 
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: `${columnVirtualizer.getTotalSize() + 48}px`, // +48px for row headers
          position: 'relative',
        }}
      >
        {/* Cells Grid */}
        <div style={{ position: 'absolute', top: 32, left: 48 }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const rowNum = virtualRow.index + 1;
              
              return columnVirtualizer.getVirtualItems().map((virtualColumn) => {
                const colLetter = String.fromCharCode(65 + virtualColumn.index);
                const cellId = `${colLetter}${rowNum}`;
                
                return (
                  <div
                    key={`${virtualRow.index}-${virtualColumn.index}`}
                    style={{
                      position: 'absolute',
                      top: virtualRow.start,
                      left: virtualColumn.start,
                      width: virtualColumn.size,
                      height: virtualRow.size,
                    }}
                  >
                    <Cell 
                      cellId={cellId} 
                      styleWidth={virtualColumn.size} 
                    />
                  </div>
                );
              });
            })}
        </div>

        {/* Column Headers container */}
        <div style={{ position: 'sticky', top: 0, zIndex: 30, height: 0 }}>
            {columnVirtualizer.getVirtualItems().map((virtualColumn) => {
              const colLetter = String.fromCharCode(65 + virtualColumn.index);
              const width = getColumnWidth(virtualColumn.index);
              return (
                <DraggableHeader
                  key={`col-${virtualColumn.index}`}
                  id={`col-${virtualColumn.index}`}
                  label={colLetter}
                  type="col"
                  activeId={activeId}
                  overId={overId}
                  style={{ 
                    top: 0,
                    left: virtualColumn.start + 48,
                    width: virtualColumn.size,
                    height: 32
                  }}
                  onResizeStart={(e) => startResize(e, `col-${colLetter}`, width, 'horizontal')}
                />
              );
            })}
        </div>
        
        {/* Row Headers container */}
        <div style={{ position: 'sticky', left: 0, zIndex: 30, width: 0 }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const rowNum = virtualRow.index + 1;
              const height = getRowHeight(virtualRow.index);
              return (
                <DraggableHeader
                  key={`row-${virtualRow.index}`}
                  id={`row-${virtualRow.index}`}
                  label={rowNum}
                  type="row"
                  activeId={activeId}
                  overId={overId}
                  style={{ 
                    top: virtualRow.start + 32,
                    left: 0,
                    height: virtualRow.size,
                    width: 48
                  }}
                  onResizeStart={(e) => startResize(e, `row-${rowNum}`, height, 'vertical')}
                />
              );
            })}
        </div>

        {/* Top-Left Empty Corner */}
        <div style={{ position: 'sticky', top: 0, left: 0, zIndex: 40, width: 0, height: 0 }}>
           <div className="bg-[#f8f9fa] border-r border-b border-gray-300 absolute" style={{ top: 0, left: 0, width: 48, height: 32 }} />
        </div>
      </div>

      <DragOverlay dropAnimation={dropAnimation}>
        {activeId ? (
          <div 
            className="bg-blue-100 border border-blue-400 opacity-80 flex items-center justify-center font-bold text-blue-700 pointer-events-none shadow-sm"
            style={{ 
              width: String(activeId).startsWith('col-') ? getColumnWidth(parseInt(String(activeId).split('-')[1], 10)) : 48,
              height: String(activeId).startsWith('row-') ? getRowHeight(parseInt(String(activeId).split('-')[1], 10)) : 32,
            }}
          >
            {String(activeId).startsWith('col-') 
                ? String.fromCharCode(65 + parseInt(String(activeId).split('-')[1], 10)) 
                : parseInt(String(activeId).split('-')[1], 10) + 1}
          </div>
        ) : null}
      </DragOverlay>

    </div>
    </DndContext>
  );
}

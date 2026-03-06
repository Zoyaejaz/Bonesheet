"use client";

import { useCallback, useEffect, useState, useRef, memo } from "react";
import { useSpreadsheetStore } from "@/store/useSpreadsheetStore";
import { useAuth } from "@/hooks/useAuth";
import clsx from "clsx";

interface CellProps {
  cellId: string;
  styleWidth?: number;
}

// Fixed color array for simple random assignment
const COLORS = ["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899"];
function getUserColor(uid: string) {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

export const Cell = memo(function Cell({ cellId, styleWidth }: CellProps) {
  const { user } = useAuth();
  const userName = user?.displayName || user?.email?.split('@')[0] || 'Guest';
  
  // Use granular selectors to prevent full grid re-renders
  // Avoid returning new objects/arrays inside selectors to prevent getSnapshot infinite loops
  const value = useSpreadsheetStore((state) => state.document?.cells?.[cellId]?.value) || "";
  const computedValue = useSpreadsheetStore((state) => state.document?.cells?.[cellId]?.computedValue) ?? "";
  const format = useSpreadsheetStore((state) => state.document?.cells?.[cellId]?.format);
  const presenceRecord = useSpreadsheetStore((state) => state.document?.presence);
  
  const updateCell = useSpreadsheetStore((state) => state.updateCell);
  const setActiveCell = useSpreadsheetStore((state) => state.setActiveCell);
  const activeCell = useSpreadsheetStore((state) => state.activeCell);
  
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external changes when not editing
  useEffect(() => {
    if (!isEditing) {
      setLocalValue(value);
    }
  }, [value, isEditing]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    if (localValue !== value) {
      updateCell(cellId, localValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLDivElement>) => {
    if (e.key === 'Enter') {
      if (isEditing) {
        inputRef.current?.blur(); // Triggers handleBlur
        navigateCell(cellId, 1, 0); // Move down
      } else {
        setIsEditing(true);
        e.preventDefault();
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (isEditing) inputRef.current?.blur();
      navigateCell(cellId, 0, e.shiftKey ? -1 : 1); // Move right/left
    } else if (!isEditing) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateCell(cellId, 1, 0);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateCell(cellId, -1, 0);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateCell(cellId, 0, 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateCell(cellId, 0, -1);
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        // Clear cell
        updateCell(cellId, "");
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Start typing immediately overrides
        e.preventDefault();
        setIsEditing(true);
        setLocalValue(e.key); // Capture the first typed keystroke
      }
    }
  };

  const navigateCell = (currentId: string, rowDelta: number, colDelta: number) => {
    const colMatch = currentId.match(/^[A-Z]+/);
    const rowMatch = currentId.match(/\d+$/);
    if (!colMatch || !rowMatch) return;
    
    let colIndex = colMatch[0].charCodeAt(0) - 65;
    let rowIndex = parseInt(rowMatch[0], 10);

    colIndex += colDelta;
    rowIndex += rowDelta;

    if (colIndex >= 0 && colIndex < 26 && rowIndex >= 1 && rowIndex <= 100) {
      const nextCol = String.fromCharCode(65 + colIndex);
      const nextId = `${nextCol}${rowIndex}`;
      const el = window.document.getElementById(`cell-${nextId}`);
      if (el) {
        el.focus();
        // Update store active cell strictly
        if (user) {
          const color = getUserColor(user.uid);
          setActiveCell(nextId, user.uid, userName, color);
        }
      }
    }
  };

  const startEdit = () => {
    setIsEditing(true);
  };

  const focusCell = () => {
    if (user && activeCell !== cellId) {
      const color = getUserColor(user.uid);
      setActiveCell(cellId, user.uid, userName, color);
    }
  };

  const handleCellClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isEditing) {
      e.currentTarget.focus();
      focusCell();
    }
  };

  // Determine what to display
  let displayValue = String(computedValue);
  if (!isEditing && value.startsWith('=')) {
    // It's a formula, show computed
  } else if (!isEditing) {
    displayValue = value;
  }
  
  const currentFormat = format || {};

  if (!isEditing && computedValue !== '#REF!' && computedValue !== '#ERR!') {
    const num = Number(computedValue);
    if (!isNaN(num) && displayValue !== "") {
      if (currentFormat.numberFormat === 'currency') {
        const formatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        });
        displayValue = formatter.format(num);
      } else if (currentFormat.numberFormat === 'percent') {
        // Assuming user types 10 to mean 10%, or types 0.1. We will just format as exact input + "%" for simple spreadsheet usage, 
        // or actually convert 0.1 -> 10%. Let's use a standard multiplier if they formatted it.
        // Google Sheets treats 10 as 1000%. We will append % visually.
        displayValue = `${num}%`;
      }
    }
  }
  
  // Presence calculation safely fallback
  const activeUsersOnCell = Object.values(presenceRecord || {}).filter(p => p?.activeCell === cellId && p?.uid !== user?.uid);
  const borderStyle = activeUsersOnCell.length > 0 
    ? { border: `2px solid ${activeUsersOnCell[0].color}` }
    : {};
  const isSelectedByMe = activeCell === cellId;

  return (
    <div 
      id={`cell-${cellId}`}
      tabIndex={0}
      className={clsx(
        "border-r border-b border-gray-200/75 relative h-full outline-none group bg-white shrink-0",
        !isEditing && "hover:bg-blue-50/50 cursor-cell transition-colors",
        isSelectedByMe && !isEditing && "ring-2 ring-[#0b57d0] ring-inset z-10"
      )}
      onClick={handleCellClick}
      onDoubleClick={!isEditing ? startEdit : undefined}
      onFocus={focusCell}
      onKeyDown={handleKeyDown}
      style={{
        ...borderStyle,
        backgroundColor: currentFormat.backgroundColor || undefined,
        width: styleWidth ? `${styleWidth}px` : undefined,
      }}
    >
      {/* Drag-to-fill handle */}
      {isSelectedByMe && !isEditing && (
        <div className="absolute -bottom-[3px] -right-[3px] w-[7px] h-[7px] bg-[#0b57d0] border-[1px] border-white cursor-crosshair z-20"></div>
      )}
      {activeUsersOnCell.length > 0 && activeUsersOnCell[0]?.name && (
        <div 
          className="absolute -top-[1.2rem] -right-2 px-1 text-[10px] text-white rounded shadow-sm whitespace-nowrap z-20"
          style={{ backgroundColor: activeUsersOnCell[0].color || '#3B82F6' }}
        >
          {activeUsersOnCell[0].name}
        </div>
      )}
      
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          className="absolute inset-0 w-full h-full px-1 border-2 border-blue-500 z-10 outline-none font-sans"
          style={{
            color: currentFormat.color || undefined,
            fontFamily: currentFormat.fontFamily || undefined,
            fontSize: currentFormat.fontSize ? `${currentFormat.fontSize}px` : '14px',
            fontWeight: currentFormat.bold ? 'bold' : 'normal',
            fontStyle: currentFormat.italic ? 'italic' : 'normal',
            textDecoration: currentFormat.underline ? 'underline' : 'none',
            backgroundColor: 'transparent'
          }}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <div 
          className={clsx(
            "w-full h-full px-1 flex items-center overflow-hidden whitespace-nowrap",
            currentFormat.bold && "font-bold",
            currentFormat.italic && "italic",
            currentFormat.underline && "underline",
            currentFormat.numberFormat && "justify-end", // Align numbers to the right usually
            computedValue === '#REF!' && "text-red-600 font-bold justify-center",
            computedValue === '#ERR!' && "text-red-500 justify-center"
          )}
          style={{
            color: currentFormat.color || '#1f2937', // gray-800 default
            fontFamily: currentFormat.fontFamily || undefined,
            fontSize: currentFormat.fontSize ? `${currentFormat.fontSize}px` : '14px',
          }}
          title={value.startsWith("=") ? `Formula: ${value}` : undefined}
        >
          {displayValue}
        </div>
      )}
    </div>
  );
});

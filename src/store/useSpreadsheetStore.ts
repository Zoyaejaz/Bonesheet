import { create } from 'zustand';
import { doc, onSnapshot, updateDoc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CellsMap, SpreadsheetDocument, WriteState, CellData } from '@/types';
import { debounce } from 'lodash';

// Basic dependency injection for the parser, to be implemented later.
// We just need a placeholder that evalutes basic cells, or we'll trigger parser recalculations.
import { evaluateCells, evaluateChangedCells, getShiftedIndex, shiftFormula, colIndexToLetter, letterToColIndex } from '@/lib/parser';

interface SpreadsheetState {
  documentId: string | null;
  document: SpreadsheetDocument | null;
  writeState: WriteState;
  activeCell: string | null;
  
  // Actions
  initDocument: (id: string, userId: string, userEmail?: string, userName?: string) => Promise<void>;
  updateCell: (cellId: string, value: string) => void;
  toggleFormat: (cellId: string, type: 'bold' | 'italic') => void;
  setFormat: (cellId: string, formatUpdates: Partial<import('@/types').CellFormat>) => void;
  setActiveCell: (cellId: string | null, userId: string, userName: string, userColor: string) => void;
  updateColumnWidth: (col: string, width: number) => void;
  updateRowHeight: (row: string, height: number) => void;
  setWriteState: (state: WriteState) => void;
  updateShareSettings: (settings: Partial<Pick<SpreadsheetDocument, 'collaborators' | 'isPublic' | 'publicRole'>>) => void;
  addRows: (count: number) => void;
  moveDimension: (type: 'col' | 'row', fromIdx: number, toIdx: number) => void;
  cleanup: () => void;
}

// Debounced Firestore updater to prevent too many writes and "unmanaged overwrites".
// We use a closure here to batch cell updates if needed or just handle the latest.
let pendingUpdates: Record<string, any> = {};

const debouncedFirestoreUpdate = debounce(async (docId: string, updates: Record<string, any>, setWriteState: (s: WriteState) => void) => {
  if (!docId || Object.keys(updates).length === 0) return;
  
  const docRef = doc(db, 'spreadsheets', docId);
  try {
    await updateDoc(docRef, { ...updates, lastModified: serverTimestamp() });
    setWriteState('Synced');
    pendingUpdates = {}; // Clear after successful sync
  } catch (error) {
    console.error("Error updating document:", error);
    // Ideally handle offline/retry logic here.
  }
}, 500);


export const useSpreadsheetStore = create<SpreadsheetState>((set, get) => {
  let unsubscribeFn: (() => void) | null = null;
  let initFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  let currentUserId: string | null = null;

  return {
    documentId: null,
    document: null,
    writeState: 'Idle',
    activeCell: null,

    setWriteState: (state: WriteState) => set({ writeState: state }),

    initDocument: async (id: string, userId: string, userEmail?: string, userName?: string) => {
      const state = get();
      if (state.documentId === id && currentUserId === userId) return; // Prevent duplicate initialization
      
      const { cleanup } = get();
      cleanup(); // Clean up previous listeners if any
      currentUserId = userId;

      set({ documentId: id, writeState: 'Pending' });
      const docRef = doc(db, 'spreadsheets', id);

      // Ensure sheet is visible within 2–3s even if Firestore is slow (e.g. first load)
      if (initFallbackTimer) clearTimeout(initFallbackTimer);
      initFallbackTimer = setTimeout(() => {
        initFallbackTimer = null;
        const current = get();
        if (current.documentId === id && current.document == null) {
          const initialDoc: SpreadsheetDocument = {
            title: "Untitled Spreadsheet",
            ownerId: userId,
            ownerEmail: userEmail || '',
            ownerName: userName || '',
            lastModified: serverTimestamp(),
            cells: {},
            presence: {},
            columnWidths: {},
            rowHeights: {},
            rowCount: 100,
            colCount: 26,
          };
          set({ document: { ...initialDoc, id } as any, writeState: 'Pending' });
          setDoc(docRef, initialDoc as any).catch(console.error);
        }
      }, 2500);

      // Setup real-time listener
      unsubscribeFn = onSnapshot(docRef, async (snapshot) => {
        if (initFallbackTimer) {
          clearTimeout(initFallbackTimer);
          initFallbackTimer = null;
        }
        if (snapshot.exists()) {
          const data = snapshot.data() as SpreadsheetDocument;
          // When remote data comes in, we could run the parser to re-evaluate computed values.
          // Fallback to {} in case Firestore dropped the empty map
          try {
            data.cells = evaluateCells(data.cells || {});
          } catch (e) {
            console.error("Parser failed:", e);
          }
          set({ document: data, writeState: 'Idle' });
        } else {
          // Document doesn't exist, create it
          const initialDoc: SpreadsheetDocument = {
            title: "Untitled Spreadsheet",
            ownerId: userId,
            ownerEmail: userEmail || '',
            ownerName: userName || '',
            lastModified: serverTimestamp(),
            cells: {},
            presence: {},
            columnWidths: {},
            rowHeights: {},
            rowCount: 100,
            colCount: 26,
          };
          
          // Optimistically load the document immediately 
          set({ document: { ...initialDoc, id } as any, writeState: 'Pending' });

          try {
            await setDoc(docRef, initialDoc as any);
            // onSnapshot will automatically trigger again once setDoc completes
          } catch (error) {
            console.error("Failed to create document:", error);
            // Fallback so it doesn't buffer forever on error (e.g. permission denied)
            set({ document: { ...initialDoc, id } as any, writeState: 'Idle' });
          }
        }
      }, (error) => {
        console.error("Firestore listener error:", error);
        set({ writeState: 'Idle' });
      });
    },

    updateCell: (cellId: string, value: string) => {
      const state = get();
      if (!state.documentId || !state.document) return;

      // Optimistic Local Update
      const oldCells = state.document.cells;
      
      // Create new cell object based on existing if any
      const currentCell = oldCells[cellId] || { value: "", format: {} };
      const newCellData: CellData = { ...currentCell, value };
      
      const newCells = { ...oldCells, [cellId]: newCellData };
      
      // Evaluate only the affected cells via the DAG for O(k) efficiency
      const evaluatedCells = evaluateChangedCells(newCells, [cellId]);

      set({ 
        document: { ...state.document, cells: evaluatedCells },
        writeState: 'Pending' 
      });

      // Prepare Firestore dot-notation update. e.g., "cells.A1"
      // This ensures Last-Write-Wins per cell instead of whole document overwrite.
      pendingUpdates[`cells.${cellId}`] = newCellData;
      
      debouncedFirestoreUpdate(state.documentId, pendingUpdates, get().setWriteState);
    },

    toggleFormat: (cellId: string, type: 'bold' | 'italic') => {
      const state = get();
      if (!state.documentId || !state.document) return;

      const oldCells = state.document.cells;
      const currentCell = oldCells[cellId] || { value: "", format: {} };
      
      const newFormat = { 
        ...currentCell.format, 
        [type]: !currentCell.format[type] 
      };
      
      const newCellData = { ...currentCell, format: newFormat };
      const newCells = { ...oldCells, [cellId]: newCellData };

      set({ 
        document: { ...state.document, cells: newCells },
        writeState: 'Pending' 
      });

      pendingUpdates[`cells.${cellId}`] = newCellData;
      debouncedFirestoreUpdate(state.documentId, pendingUpdates, get().setWriteState);
    },

    setFormat: (cellId: string, formatUpdates: Partial<import('@/types').CellFormat>) => {
      const state = get();
      if (!state.documentId || !state.document) return;

      const oldCells = state.document.cells;
      const currentCell = oldCells[cellId] || { value: "", format: {} };
      
      const newFormat = { 
        ...currentCell.format, 
        ...formatUpdates
      };
      
      const newCellData = { ...currentCell, format: newFormat };
      const newCells = { ...oldCells, [cellId]: newCellData };

      set({ 
        document: { ...state.document, cells: newCells },
        writeState: 'Pending' 
      });

      pendingUpdates[`cells.${cellId}`] = newCellData;
      debouncedFirestoreUpdate(state.documentId, pendingUpdates, get().setWriteState);
    },

    setActiveCell: (cellId: string | null, userId: string, userName: string, userColor: string) => {
      const state = get();
      if (!state.documentId) return;

      set({ activeCell: cellId });

      // Update Firestore presence directly (non-debounced usually fine, or could be batched)
      const docRef = doc(db, 'spreadsheets', state.documentId);
      updateDoc(docRef, {
        [`presence.${userId}`]: {
          uid: userId,
          name: userName,
          color: userColor,
          activeCell: cellId,
          lastActive: serverTimestamp()
        }
      });
    },

    updateColumnWidth: (col: string, width: number) => {
      const state = get();
      if (!state.documentId || !state.document) return;

      const newWidths = { ...(state.document.columnWidths || {}), [col]: width };
      set({ 
        document: { ...state.document, columnWidths: newWidths },
        writeState: 'Pending'
      });

      pendingUpdates[`columnWidths.${col}`] = width;
      debouncedFirestoreUpdate(state.documentId, pendingUpdates, get().setWriteState);
    },

    updateRowHeight: (row: string, height: number) => {
      const state = get();
      if (!state.documentId || !state.document) return;

      const newHeights = { ...(state.document.rowHeights || {}), [row]: height };
      set({ 
        document: { ...state.document, rowHeights: newHeights },
        writeState: 'Pending'
      });

      pendingUpdates[`rowHeights.${row}`] = height;
      debouncedFirestoreUpdate(state.documentId, pendingUpdates, get().setWriteState);
    },

    updateShareSettings: (settings) => {
      const state = get();
      if (!state.documentId || !state.document) return;

      set({ 
        document: { ...state.document, ...settings },
        writeState: 'Pending'
      });

      const updates: Record<string, any> = {};
      if (settings.collaborators !== undefined) updates['collaborators'] = settings.collaborators;
      if (settings.isPublic !== undefined) updates['isPublic'] = settings.isPublic;
      if (settings.publicRole !== undefined) updates['publicRole'] = settings.publicRole;
      
      debouncedFirestoreUpdate(state.documentId, updates, get().setWriteState);
    },

    addRows: (count: number) => {
      const state = get();
      if (!state.documentId || !state.document) return;

      const currentRowCount = state.document.rowCount || 100;
      const newRowCount = currentRowCount + count;

      set({ 
        document: { ...state.document, rowCount: newRowCount },
        writeState: 'Pending'
      });

      pendingUpdates['rowCount'] = newRowCount;
      debouncedFirestoreUpdate(state.documentId, pendingUpdates, get().setWriteState);
    },

    moveDimension: (type: 'col' | 'row', fromIdx: number, toIdx: number) => {
      const state = get();
      if (!state.documentId || !state.document) return;
      if (fromIdx === toIdx) return;

      const oldCells = state.document.cells;
      const newCells: CellsMap = {};
      const newColumnWidths = { ...(state.document.columnWidths || {}) };
      const newRowHeights = { ...(state.document.rowHeights || {}) };

      // 1. Shift Data Maps (Widths & Heights)
      if (type === 'col') {
        const fromCol = colIndexToLetter(fromIdx);
        const toCol = colIndexToLetter(toIdx);
        const movingWidth = newColumnWidths[fromCol] || 100;
        
        // Build a fresh map taking into account the shifts
        const shiftedWidths: Record<string, number> = {};
        for (let i = 0; i <= (state.document.colCount || 50); i++) {
            const letter = colIndexToLetter(i);
            const originalI = getShiftedIndex(i, toIdx, fromIdx); // Reverse lookup essentially
            const oldLetter = colIndexToLetter(originalI);
            
            if (i === toIdx) {
                shiftedWidths[colIndexToLetter(i)] = movingWidth;
            } else if (newColumnWidths[oldLetter]) {
                shiftedWidths[colIndexToLetter(i)] = newColumnWidths[oldLetter];
            }
        }
        Object.assign(newColumnWidths, shiftedWidths);

      } else {
        const fromRow = String(fromIdx + 1);
        const movingHeight = newRowHeights[fromRow] || 32;
        
        const shiftedHeights: Record<string, number> = {};
        for (let i = 0; i <= (state.document.rowCount || 1000); i++) {
            const rowNum = String(i + 1);
            const originalI = getShiftedIndex(i, toIdx, fromIdx); 
            const oldRowNum = String(originalI + 1);
            
            if (i === toIdx) {
                shiftedHeights[rowNum] = movingHeight;
            } else if (newRowHeights[oldRowNum]) {
                shiftedHeights[rowNum] = newRowHeights[oldRowNum];
            }
        }
        Object.assign(newRowHeights, shiftedHeights);
      }

      // 2. Shift Cells
      const changedCellIds: string[] = [];

      Object.keys(oldCells).forEach(oldCellId => {
        const match = oldCellId.match(/^[A-Z]+/);
        const rowMatch = oldCellId.match(/\d+$/);
        if (!match || !rowMatch) return;

        const colLetter = match[0];
        const rowNumStr = rowMatch[0];
        const colIdx = letterToColIndex(colLetter);
        const rowIdx = parseInt(rowNumStr, 10) - 1;

        // Where does this specific cell go now?
        let newColIdx = colIdx;
        let newRowIdx = rowIdx;

        if (type === 'col') {
            newColIdx = getShiftedIndex(colIdx, fromIdx, toIdx);
        } else {
            newRowIdx = getShiftedIndex(rowIdx, fromIdx, toIdx);
        }

        const newCellId = `${colIndexToLetter(newColIdx)}${newRowIdx + 1}`;
        const oldCellData = oldCells[oldCellId];

        // 3. Re-write the AST Formula safely
        const updatedValue = shiftFormula(oldCellData.value, type, fromIdx, toIdx);

        newCells[newCellId] = {
            ...oldCellData,
            value: updatedValue
        };

        // If the formula changed, we need to mark it as changed to force DAG update
        if (updatedValue !== oldCellData.value) {
            changedCellIds.push(newCellId);
        }
      });

      // Execute DAG evaluations for any rewritten formulas
      const evaluatedCells = changedCellIds.length > 0 ? evaluateChangedCells(newCells, changedCellIds) : newCells;

      set({ 
        document: { 
            ...state.document, 
            cells: evaluatedCells,
            columnWidths: newColumnWidths,
            rowHeights: newRowHeights
        },
        writeState: 'Pending'
      });

      // Clear any pending cell-level updates; we're sending full cells
      Object.keys(pendingUpdates).forEach(k => {
        if (k.startsWith('cells.') || k === 'cells') delete pendingUpdates[k];
      });
      pendingUpdates['cells'] = evaluatedCells;
      pendingUpdates['columnWidths'] = newColumnWidths;
      pendingUpdates['rowHeights'] = newRowHeights;

      // Immediate Firestore sync for move (structural change) so collaborators see it in real time
      const docRef = doc(db, 'spreadsheets', state.documentId);
      const moveUpdates = { cells: evaluatedCells, columnWidths: newColumnWidths, rowHeights: newRowHeights, lastModified: serverTimestamp() };
      updateDoc(docRef, moveUpdates).then(() => {
        get().setWriteState('Synced');
        pendingUpdates = {};
      }).catch((err) => {
        console.error("Error syncing move:", err);
        if (state.documentId) {
          debouncedFirestoreUpdate(state.documentId, { ...pendingUpdates }, get().setWriteState);
        }
      });
    },

    cleanup: () => {
      if (initFallbackTimer) {
        clearTimeout(initFallbackTimer);
        initFallbackTimer = null;
      }
      const state = get();
      if (currentUserId && state.documentId) {
        // Remove presence on unmount
        const docRef = doc(db, 'spreadsheets', state.documentId);
        updateDoc(docRef, { [`presence.${currentUserId}`]: null }).catch(() => {});
      }

      if (unsubscribeFn) {
        unsubscribeFn();
        unsubscribeFn = null;
      }
      currentUserId = null;
      set({ documentId: null, document: null, writeState: 'Idle', activeCell: null });
    }
  };
});

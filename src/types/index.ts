import { Timestamp, FieldValue } from 'firebase/firestore';

export interface CellFormat {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  backgroundColor?: string;
  fontFamily?: string;
  fontSize?: string;
  numberFormat?: 'currency' | 'percent';
}

export interface CellData {
  value: string; // The raw input, e.g., "=A1+B2" or "10"
  computedValue?: string | number; // The evaluated value to display
  format: CellFormat;
}

export interface CellsMap {
  [cellId: string]: CellData;
}

export interface PresenceUser {
  uid: string;
  name: string;
  color: string;
  activeCell: string | null;
  lastActive: number | FieldValue;
}

export interface DocumentPresence {
  [uid: string]: PresenceUser;
}

export interface SpreadsheetDocument {
  id?: string;
  title: string;
  ownerId: string;
  ownerEmail?: string;
  ownerName?: string;
  lastModified: number | FieldValue;
  cells: CellsMap;
  presence?: DocumentPresence;
  columnWidths?: Record<string, number>;
  rowHeights?: Record<string, number>;
  isStarred?: boolean;
  collaborators?: Record<string, 'Editor' | 'Viewer'>; // map of email to role
  isPublic?: boolean;
  publicRole?: 'Editor' | 'Viewer';
  rowCount?: number;
  colCount?: number;
}

export type WriteState = 'Idle' | 'Pending' | 'Synced' | 'Offline';

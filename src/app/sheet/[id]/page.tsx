"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSpreadsheetStore } from "@/store/useSpreadsheetStore";
import { Grid } from "@/components/Grid";
import { ColorPicker } from "@/components/ColorPicker";
import { Loader2, Cloud, RefreshCw, Bold, Italic, Underline, PaintBucket, Type, Download, ArrowLeft, Undo2, Redo2, Printer, ZoomIn, DollarSign, Percent, Lock, FileSpreadsheet, AlignLeft, WrapText, Link2, MessageSquare } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ShareModal } from "@/components/ShareModal";
import { CustomSelect } from "@/components/CustomSelect";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const FONT_FAMILIES = [
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Helvetica", value: "Helvetica, sans-serif" },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Tahoma", value: "Tahoma, sans-serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', sans-serif" },
  { label: "Impact", value: "Impact, sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Garamond", value: "Garamond, serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
  { label: "Monaco", value: "Monaco, monospace" },
  { label: "Comic Sans MS", value: "'Comic Sans MS', cursive" }
];

const FONT_SIZES = ["6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "18", "20", "24", "28", "32", "36", "48","50","55", "60","65", "72","80", "96"].map(size => ({ label: size, value: size }));

export default function SheetPage() {
  const { id } = useParams() as { id: string };
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const initDocument = useSpreadsheetStore((state) => state.initDocument);
  const cleanup = useSpreadsheetStore((state) => state.cleanup);
  const documentProp = useSpreadsheetStore((state) => state.document);
  const activeCell = useSpreadsheetStore((state) => state.activeCell);
  const writeState = useSpreadsheetStore((state) => state.writeState);
  
  const toggleFormat = useSpreadsheetStore((state) => state.toggleFormat);
  const setFormat = useSpreadsheetStore((state) => state.setFormat);
  const setWriteState = useSpreadsheetStore((state) => state.setWriteState);

  const bgInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  const [isRenaming, setIsRenaming] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && id) {
      initDocument(id, user.uid, user.email || '', user.displayName || '');
    }
    return () => {
      cleanup();
    };
  }, [id, user]);

  useEffect(() => {
    const handleOnline = () => setWriteState('Idle');
    const handleOffline = () => setWriteState('Offline');
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Initial check
    if (!navigator.onLine) {
      setWriteState('Offline');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setWriteState]);

  useEffect(() => {
    if (documentProp) {
        setTitleInput(documentProp.title);
    }
  }, [documentProp?.title]);

  useEffect(() => {
    if (isRenaming && titleInputRef.current) {
        titleInputRef.current.focus();
        titleInputRef.current.select();
    }
  }, [isRenaming]);

  if (authLoading || !documentProp) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const handleExportCSV = () => {
    if (!documentProp) return;
    const { cells } = documentProp;
    let maxCol = 0;
    let maxRow = 0;
    Object.keys(cells).forEach(cellId => {
      const colMatch = cellId.match(/^[A-Z]+/);
      const rowMatch = cellId.match(/\d+$/);
      if (colMatch && rowMatch) {
        const cIdx = colMatch[0].charCodeAt(0) - 65;
        const rIdx = parseInt(rowMatch[0], 10);
        if (cIdx > maxCol) maxCol = cIdx;
        if (rIdx > maxRow) maxRow = rIdx;
      }
    });

    let csvContent = "";
    for (let r = 1; r <= maxRow; r++) {
      const rowVals: string[] = [];
      for (let c = 0; c <= maxCol; c++) {
        const colLetter = String.fromCharCode(65 + c);
        const cellId = `${colLetter}${r}`;
        const val = cells[cellId]?.computedValue ?? "";
        rowVals.push(`"${String(val).replace(/"/g, '""')}"`);
      }
      csvContent += rowVals.join(",") + "\n";
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${documentProp.title || 'export'}.csv`);
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    if (!documentProp) return;
    const jsonContent = JSON.stringify(documentProp, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${documentProp.title || 'export'}.json`);
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
    setShowExportMenu(false);
  };

  const handleExportTSV = () => {
    if (!documentProp) return;
    const { cells } = documentProp;
    let maxCol = 0;
    let maxRow = 0;
    Object.keys(cells).forEach(cellId => {
      const colMatch = cellId.match(/^[A-Z]+/);
      const rowMatch = cellId.match(/\d+$/);
      if (colMatch && rowMatch) {
        const cIdx = colMatch[0].charCodeAt(0) - 65;
        const rIdx = parseInt(rowMatch[0], 10);
        if (cIdx > maxCol) maxCol = cIdx;
        if (rIdx > maxRow) maxRow = rIdx;
      }
    });

    let tsvContent = "";
    for (let r = 1; r <= maxRow; r++) {
      const rowVals: string[] = [];
      for (let c = 0; c <= maxCol; c++) {
        const colLetter = String.fromCharCode(65 + c);
        const cellId = `${colLetter}${r}`;
        const val = cells[cellId]?.computedValue ?? "";
        // Replace tabs and newlines within the value
        rowVals.push(`${String(val).replace(/\t/g, ' ').replace(/\n/g, ' ')}`);
      }
      tsvContent += rowVals.join("\t") + "\n";
    }

    const blob = new Blob([tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${documentProp.title || 'export'}.tsv`);
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
    setShowExportMenu(false);
  };

  const handleExportHTML = () => {
    if (!documentProp) return;
    const { cells } = documentProp;
    let maxCol = 0;
    let maxRow = 0;
    Object.keys(cells).forEach(cellId => {
      const colMatch = cellId.match(/^[A-Z]+/);
      const rowMatch = cellId.match(/\d+$/);
      if (colMatch && rowMatch) {
        const cIdx = colMatch[0].charCodeAt(0) - 65;
        const rIdx = parseInt(rowMatch[0], 10);
        if (cIdx > maxCol) maxCol = cIdx;
        if (rIdx > maxRow) maxRow = rIdx;
      }
    });

    let htmlContent = "<table border='1'>\n";
    for (let r = 1; r <= maxRow; r++) {
      htmlContent += "  <tr>\n";
      for (let c = 0; c <= maxCol; c++) {
        const colLetter = String.fromCharCode(65 + c);
        const cellId = `${colLetter}${r}`;
        const val = cells[cellId]?.computedValue ?? "";
        htmlContent += `    <td>${String(val).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>\n`;
      }
      htmlContent += "  </tr>\n";
    }
    htmlContent += "</table>";

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${documentProp.title || 'export'}.html`);
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
    setShowExportMenu(false);
  };

  const handleExportXLSX = () => {
    if (!documentProp) return;
    const { cells } = documentProp;
    let maxCol = 0;
    let maxRow = 0;
    
    // Find dimensions
    Object.keys(cells).forEach(cellId => {
      const colMatch = cellId.match(/^[A-Z]+/);
      const rowMatch = cellId.match(/\d+$/);
      if (colMatch && rowMatch) {
        const cIdx = colMatch[0].charCodeAt(0) - 65;
        const rIdx = parseInt(rowMatch[0], 10);
        if (cIdx > maxCol) maxCol = cIdx;
        if (rIdx > maxRow) maxRow = rIdx;
      }
    });

    // Create 2D array representing sheet data
    const data: any[][] = Array(maxRow).fill([]).map(() => Array(maxCol + 1).fill(""));
    
    // Fill data
    for (let r = 1; r <= maxRow; r++) {
      for (let c = 0; c <= maxCol; c++) {
        const colLetter = String.fromCharCode(65 + c);
        const cellId = `${colLetter}${r}`;
        const val = cells[cellId]?.computedValue ?? "";
        data[r - 1][c] = val; // -1 because array is 0-indexed while sheet rows are 1-indexed
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `${documentProp.title || 'export'}.xlsx`);
    setShowExportMenu(false);
  };

  const handleExportODS = () => {
    if (!documentProp) return;
    const { cells } = documentProp;
    let maxCol = 0;
    let maxRow = 0;
    
    // Find dimensions
    Object.keys(cells).forEach(cellId => {
      const colMatch = cellId.match(/^[A-Z]+/);
      const rowMatch = cellId.match(/\d+$/);
      if (colMatch && rowMatch) {
        const cIdx = colMatch[0].charCodeAt(0) - 65;
        const rIdx = parseInt(rowMatch[0], 10);
        if (cIdx > maxCol) maxCol = cIdx;
        if (rIdx > maxRow) maxRow = rIdx;
      }
    });

    // Create 2D array representing sheet data
    const data: any[][] = Array(maxRow).fill([]).map(() => Array(maxCol + 1).fill(""));
    
    // Fill data
    for (let r = 1; r <= maxRow; r++) {
      for (let c = 0; c <= maxCol; c++) {
        const colLetter = String.fromCharCode(65 + c);
        const cellId = `${colLetter}${r}`;
        const val = cells[cellId]?.computedValue ?? "";
        data[r - 1][c] = val; // -1 because array is 0-indexed while sheet rows are 1-indexed
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `${documentProp.title || 'export'}.ods`, { bookType: 'ods' });
    setShowExportMenu(false);
  };

  const handleExportPDF = () => {
    if (!documentProp) return;
    const { cells } = documentProp;
    let maxCol = 0;
    let maxRow = 0;
    
    Object.keys(cells).forEach(cellId => {
      const colMatch = cellId.match(/^[A-Z]+/);
      const rowMatch = cellId.match(/\d+$/);
      if (colMatch && rowMatch) {
        const cIdx = colMatch[0].charCodeAt(0) - 65;
        const rIdx = parseInt(rowMatch[0], 10);
        if (cIdx > maxCol) maxCol = cIdx;
        if (rIdx > maxRow) maxRow = rIdx;
      }
    });

    const doc = new jsPDF();
    
    // Collect headers (A, B, C...)
    const head = [Array.from({ length: maxCol + 1 }).map((_, i) => String.fromCharCode(65 + i))];
    
    // Collect rows
    const body: string[][] = [];
    for (let r = 1; r <= maxRow; r++) {
      const rowVals: string[] = [];
      for (let c = 0; c <= maxCol; c++) {
        const colLetter = String.fromCharCode(65 + c);
        const cellId = `${colLetter}${r}`;
        const val = String(cells[cellId]?.computedValue ?? "");
        rowVals.push(val);
      }
      body.push(rowVals);
    }

    (doc as any).autoTable({
      head: head,
      body: body,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [248, 250, 252], textColor: [100, 116, 139] }
    });

    doc.save(`${documentProp.title || 'export'}.pdf`);
    setShowExportMenu(false);
  };

  const handleTitleBlur = async () => {
    setIsRenaming(false);
    if (!documentProp || titleInput === documentProp.title || !titleInput.trim()) {
        setTitleInput(documentProp?.title || "Untitled Spreadsheet");
        return;
    }
    
    setWriteState('Pending');
    try {
        const docRef = doc(db, 'spreadsheets', id);
        await updateDoc(docRef, { title: titleInput.trim(), lastModified: serverTimestamp() });
        setWriteState('Synced');
    } catch (error) {
        console.error("Failed to update title", error);
        setWriteState('Idle');
    }
  };

  const currentFormat = activeCell && documentProp.cells[activeCell] ? documentProp.cells[activeCell].format : {};

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden font-sans text-gray-900">
      {/* Header */}
      <header className="h-[64px] border-b border-gray-200 flex items-center justify-between px-2 bg-white shrink-0 relative z-20 pt-1 pb-1">
        <div className="flex items-center space-x-1 h-full">
          <button 
            onClick={() => router.push("/dashboard")} 
            className="p-1 hover:bg-gray-100 rounded-full transition-colors group mx-1 flex items-center justify-center w-10 h-10"
            title="Sheets Home"
          >
            <div className="bg-[#0f9d58] p-1.5 rounded text-white shadow-sm flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" strokeWidth={2.5} />
            </div>
          </button>
          
          <div className="flex flex-col justify-center h-full pt-1">
            <div className="flex items-center">
              {isRenaming ? (
                <input 
                  ref={titleInputRef}
                  type="text" 
                  className="text-[18px] text-gray-800 border-none outline-none bg-white border border-blue-500 rounded px-1.5 py-0 min-w-[50px] w-auto max-w-[500px]"
                  style={{ height: '24px' }}
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onBlur={handleTitleBlur}
                  onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                          titleInputRef.current?.blur();
                      }
                  }}
                />
              ) : (
                <div 
                  className="text-[18px] text-gray-800 border border-transparent hover:border-gray-300 hover:bg-white rounded px-1.5 py-0 min-w-[10px] max-w-[500px] truncate cursor-text transition-all leading-tight"
                  style={{ height: '24px' }}
                  onClick={() => setIsRenaming(true)}
                  title="Rename"
                >
                  {documentProp.title}
                </div>
              )}
            </div>

            {/* Menu Bar & Save Status */}
            <div className="flex items-center space-x-0.5 text-[13px] text-[#444746] mt-0.5 ml-0.5">
              {['File', 'Edit', 'View', 'Insert', 'Format', 'Data', 'Tools', 'Extensions', 'Help'].map((item) => (
                <button key={item} className="px-2 py-[3px] rounded hover:bg-gray-100 transition-colors cursor-pointer">
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>
        
          <div className="flex items-center space-x-2">
          {/* Active Users Presence Avatars */}
          <div className="flex items-center -space-x-2 mr-2">
            {documentProp?.presence && Object.values(documentProp.presence)
              .filter(p => p != null && p.uid !== user?.uid)
              .map(p => (
                <div 
                  key={p.uid}
                  className="w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-bold shadow-sm ring-2 ring-white z-10 hover:z-20 transition-transform hover:scale-110"
                  style={{ backgroundColor: p.color }}
                  title={`${p.name || 'Guest'} (Editing ${p.activeCell || 'somewhere'})`}
                >
                  {p.name ? p.name[0].toUpperCase() : 'G'}
                </div>
            ))}
          </div>

          <div className="flex items-center space-x-3 ml-2 mr-3">
             {/* Save Status right side */}
             <div className="flex items-center mr-2 text-[14px] text-gray-700 hidden sm:flex">
                {writeState === 'Idle' && documentProp && (
                  <span className="flex items-center" title="All changes saved to Drive"><Cloud className="w-4 h-4 mr-1.5 text-gray-500 hover:bg-gray-100 cursor-pointer rounded p-0.5" /> Saved</span>
                )}
                {writeState === 'Pending' && (
                  <span className="flex items-center"><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin text-gray-500" /> Saving...</span>
                )}
                {writeState === 'Synced' && (
                  <span className="flex items-center" title="All changes saved to Drive"><Cloud className="w-4 h-4 mr-1.5 text-gray-500 hover:bg-gray-100 cursor-pointer rounded p-0.5" /> Saved</span>
                )}
                {writeState === 'Offline' && (
                  <span className="flex items-center text-amber-600"><Cloud className="w-4 h-4 mr-1.5" /> Offline</span>
                )}
             </div>
            <button
               onClick={() => setShowShareModal(true)}
               className="flex items-center bg-[#c2e7ff] hover:bg-[#b3d4ec] text-[#001d35] text-sm font-medium px-5 py-2 rounded-full transition-colors h-10 shadow-sm"
             >
               <Lock className="w-[18px] h-[18px] mr-2" />
               Share
             </button>
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-blue-400 text-white flex items-center justify-center text-sm font-bold shadow-sm ring-2 ring-gray-100 hover:ring-gray-200 cursor-pointer">
              {(user?.displayName || user?.email || 'G')[0].toUpperCase()}
            </div>
          </div>
        </div>
      </header>
      
      {/* Premium Toolbar */}
      <div className="bg-[#edf2fc] rounded-full mx-4 my-2 px-3 min-h-[38px] flex items-center shadow-sm z-50 space-x-0.5 flex-wrap relative">
        
        {/* Basic Tools */}
        <div className="flex items-center space-x-0.5">
            <button className="p-1 rounded hover:bg-gray-200 text-gray-700 transition-colors" title="Undo (Ctrl+Z)"><Undo2 className="w-[18px] h-[18px]" /></button>
            <button className="p-1 rounded hover:bg-gray-200 text-gray-700 transition-colors" title="Redo (Ctrl+Y)"><Redo2 className="w-[18px] h-[18px]" /></button>
            <button className="p-1 rounded hover:bg-gray-200 text-gray-700 transition-colors" title="Print (Ctrl+P)"><Printer className="w-[18px] h-[18px]" /></button>
            <button className="p-1 rounded hover:bg-gray-200 text-gray-700 transition-colors" title="Paint Format"><PaintBucket className="w-[18px] h-[18px]" /></button>
        </div>

        <div className="w-[1px] h-4 bg-gray-300 mx-1.5"></div>
        
        {/* Zoom */}
        <div className="flex items-center">
            <button className="flex items-center p-1 rounded hover:bg-gray-200 text-gray-700 transition-colors text-[13px] font-medium" title="Zoom">
                <span>100%</span>
                <ZoomIn className="w-3.5 h-3.5 ml-0.5 text-gray-500" />
            </button>
        </div>

        <div className="w-[1px] h-4 bg-gray-300 mx-1.5"></div>

        {/* Number Formats */}
        <div className="flex items-center space-x-0.5">
            <button 
              onClick={() => activeCell && setFormat(activeCell, { numberFormat: currentFormat.numberFormat === 'currency' ? undefined : 'currency' })}
              disabled={!activeCell}
              className={`p-1 rounded disabled:opacity-50 transition-colors ${currentFormat.numberFormat === 'currency' ? 'bg-[#d3e3fd] text-[#041e49]' : 'text-gray-700 hover:bg-gray-200'}`} 
              title="Format: Currency"
            >
              <DollarSign className="w-[18px] h-[18px]" />
            </button>
            <button 
              onClick={() => activeCell && setFormat(activeCell, { numberFormat: currentFormat.numberFormat === 'percent' ? undefined : 'percent' })}
              disabled={!activeCell}
              className={`p-1 rounded disabled:opacity-50 transition-colors ${currentFormat.numberFormat === 'percent' ? 'bg-[#d3e3fd] text-[#041e49]' : 'text-gray-700 hover:bg-gray-200'}`} 
              title="Format: Percent"
            >
              <Percent className="w-[18px] h-[18px]" />
            </button>
        </div>

        <div className="w-[1px] h-4 bg-gray-300 mx-1.5"></div>

        {/* Font Family */}
        <div className="flex items-center">
          <CustomSelect
            options={FONT_FAMILIES}
            value={currentFormat.fontFamily || ""}
            onChange={(val) => activeCell && setFormat(activeCell, { fontFamily: val })}
            disabled={!activeCell}
            placeholder="Default"
            minWidth="120px"
          />
        </div>

        <div className="w-[1px] h-4 bg-gray-300 mx-1.5"></div>

        {/* Font Size */}
        <div className="flex items-center">
          <CustomSelect
            options={FONT_SIZES}
            value={currentFormat.fontSize || "10"}
            onChange={(val) => activeCell && setFormat(activeCell, { fontSize: val })}
            disabled={!activeCell}
            minWidth="50px"
            align="center"
          />
        </div>

        <div className="w-[1px] h-4 bg-gray-300 mx-1.5"></div>

        {/* Text Formats */}
        <div className="flex items-center space-x-0.5">
          <button 
            onClick={() => activeCell && setFormat(activeCell, { bold: !currentFormat.bold })}
            disabled={!activeCell}
            className={`p-1 rounded disabled:opacity-50 transition-colors ${currentFormat.bold ? 'bg-[#d3e3fd] text-[#041e49]' : 'text-gray-700 hover:bg-gray-200'}`} 
            title="Bold (Ctrl+B)"
          >
            <Bold className="w-[18px] h-[18px]" />
          </button>
          <button 
            onClick={() => activeCell && setFormat(activeCell, { italic: !currentFormat.italic })}
            disabled={!activeCell}
            className={`p-1 rounded disabled:opacity-50 transition-colors ${currentFormat.italic ? 'bg-[#d3e3fd] text-[#041e49]' : 'text-gray-700 hover:bg-gray-200'}`} 
            title="Italic (Ctrl+I)"
          >
            <Italic className="w-[18px] h-[18px]" />
          </button>
          <button 
            onClick={() => activeCell && setFormat(activeCell, { underline: !currentFormat.underline })}
            disabled={!activeCell}
            className={`p-1 rounded disabled:opacity-50 transition-colors ${currentFormat.underline ? 'bg-[#d3e3fd] text-[#041e49]' : 'text-gray-700 hover:bg-gray-200'}`} 
            title="Underline (Ctrl+U)"
          >
            <Underline className="w-[18px] h-[18px]" />
          </button>
          <ColorPicker
            color={currentFormat.color || '#000000'}
            onChange={(color) => activeCell && setFormat(activeCell, { color })}
            icon={<Type className="w-[18px] h-[18px] mb-1" />}
            title="Text Color"
            disabled={!activeCell}
          />
        </div>

        <div className="w-[1px] h-4 bg-gray-300 mx-1.5"></div>

        <div className="flex items-center space-x-0.5 relative">
          <ColorPicker
            color={currentFormat.backgroundColor || '#ffffff'}
            onChange={(color) => activeCell && setFormat(activeCell, { backgroundColor: color })}
            icon={<PaintBucket className="w-[18px] h-[18px] mb-1" />}
            title="Fill Color"
            disabled={!activeCell}
          />
        </div>

        <div className="w-[1px] h-4 bg-gray-300 mx-1.5 hidden sm:block"></div>

        <div className="flex items-center space-x-0.5">
            <button className="p-1 rounded hover:bg-gray-200 text-gray-700 transition-colors" title="Horizontal align"><AlignLeft className="w-[18px] h-[18px]" /></button>
            <button className="p-1 rounded hover:bg-gray-200 text-gray-700 transition-colors" title="Text wrapping"><WrapText className="w-[18px] h-[18px]" /></button>
        </div>

        <div className="w-[1px] h-4 bg-gray-300 mx-1.5 hidden sm:block"></div>

        <div className="flex items-center space-x-0.5">
            <button className="p-1 rounded hover:bg-gray-200 text-gray-700 transition-colors" title="Insert link"><Link2 className="w-[18px] h-[18px]" /></button>
            <button className="p-1 rounded hover:bg-gray-200 text-gray-700 transition-colors" title="Insert comment"><MessageSquare className="w-[18px] h-[18px]" /></button>
        </div>

        <div className="w-[1px] h-4 bg-gray-300 mx-1.5 hidden sm:block"></div>

        <div className="hidden sm:flex items-center space-x-2 ml-auto relative" ref={exportMenuRef}>
            <button 
              onClick={() => setShowExportMenu(!showExportMenu)} 
              className="flex items-center px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 rounded transition-colors" 
              title="Download Options"
            >
              <Download className="w-4 h-4 mr-1.5" />
              Download
            </button>
            
            {showExportMenu && (
              <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-gray-200 rounded shadow-lg py-1 z-50">
                <button 
                  onClick={handleExportXLSX} 
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Microsoft Excel (.xlsx)
                </button>
                <button 
                  onClick={handleExportODS} 
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  OpenDocument (.ods)
                </button>
                <button 
                  onClick={handleExportPDF} 
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  PDF (.pdf)
                </button>
                <button 
                  onClick={handleExportHTML} 
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Web Page (.html)
                </button>
                <button 
                  onClick={handleExportCSV} 
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Comma Separated Values (.csv)
                </button>
                <button 
                  onClick={handleExportTSV} 
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Tab Separated Values (.tsv)
                </button>
                
                <div className="h-px bg-gray-200 my-1 mx-4 opacity-50"></div>
                
                <button 
                  onClick={handleExportJSON} 
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 italic"
                >
                  Internal App Format (.json)
                </button>
              </div>
            )}
        </div>
      </div>

      {/* Formula Bar */}
      <div className="h-[36px] border-b border-gray-200 bg-white flex items-center z-10 shrink-0 w-full overflow-hidden">
        <div className="flex items-center justify-center min-w-[48px] px-2 h-full border-r border-gray-200 text-[13px] font-medium text-gray-600 bg-gray-50/50">
          {activeCell || ""}
        </div>
        <div className="flex items-center justify-center px-3 h-full border-r border-gray-200 bg-white">
            <span className="text-gray-400 font-serif italic text-lg select-none flex items-center h-full mb-[2px]">fx</span>
        </div>
        <input 
          className="flex-1 border-none outline-none text-[13px] font-sans px-3 h-full bg-white text-gray-800"
          disabled={!activeCell}
          value={activeCell && documentProp?.cells ? (documentProp.cells[activeCell]?.value || "") : ""}
          placeholder={activeCell ? "Enter value or formula" : "Select a cell to enter a value"}
          readOnly
        />
      </div>

      {/* Main Grid Area */}
      {documentProp?.cells ? (
        <Grid />
      ) : (
        <div className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        </div>
      )}

      {showShareModal && (
        <ShareModal onClose={() => setShowShareModal(false)} />
      )}
    </div>
  );
}

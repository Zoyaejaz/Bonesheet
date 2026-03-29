"use client";

import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { SpreadsheetDocument } from "@/types";
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { CellFormat, CellsMap } from "@/types";
import { FileSpreadsheet, Plus, LogOut, Loader2, MoreVertical, Search, Star, Trash2, Info, X, Users, Globe, Lock, Clock } from "lucide-react";
import { useRouter } from "next/navigation";

interface TemplateDef {
    id: string;
    title: string;
    icon: React.ReactNode;
    color: string;
    description: string;
    rowCount?: number;
    colCount?: number;
    cells?: CellsMap;
    columnWidths?: Record<string, number>;
}

const TEMPLATE_DEFINITIONS: TemplateDef[] = [
    {
        id: "attendance",
        title: "Attendance Tracker",
        description: "Track daily presence",
        icon: <Users className="w-10 h-10 text-emerald-500 group-hover:text-emerald-600" strokeWidth={1.5} />,
        color: "bg-emerald-50 hover:border-emerald-600",
        rowCount: 50,
        colCount: 30,
        columnWidths: { "col-A": 150 },
        cells: {
            "A1": { value: "Student Name", format: { bold: true, backgroundColor: "#f8f9fa" } },
            "B1": { value: "Mon", format: { bold: true, backgroundColor: "#f8f9fa" } },
            "C1": { value: "Tue", format: { bold: true, backgroundColor: "#f8f9fa" } },
            "D1": { value: "Wed", format: { bold: true, backgroundColor: "#f8f9fa" } },
            "E1": { value: "Thu", format: { bold: true, backgroundColor: "#f8f9fa" } },
            "F1": { value: "Fri", format: { bold: true, backgroundColor: "#f8f9fa" } },
            "G1": { value: "Total Present", format: { bold: true, backgroundColor: "#e8f0fe" } }
        }
    },
    {
        id: "marks",
        title: "Marks & Grades",
        description: "Student academics",
        icon: <FileSpreadsheet className="w-10 h-10 text-blue-500 group-hover:text-blue-600" strokeWidth={1.5} />,
        color: "bg-blue-50 hover:border-blue-600",
        rowCount: 100,
        colCount: 20,
        columnWidths: { "col-A": 150, "col-B": 100, "col-C": 100, "col-D": 100 },
        cells: {
            "A1": { value: "Student Name", format: { bold: true, backgroundColor: "#f8f9fa" } },
            "B1": { value: "Mathematics", format: { bold: true, backgroundColor: "#f8f9fa" } },
            "C1": { value: "Science", format: { bold: true, backgroundColor: "#f8f9fa" } },
            "D1": { value: "English", format: { bold: true, backgroundColor: "#f8f9fa" } },
            "E1": { value: "Total Marks", format: { bold: true, backgroundColor: "#f8f9fa" } },
            "F1": { value: "Average", format: { bold: true, backgroundColor: "#f8f9fa" } }
        }
    },
    {
        id: "timetable",
        title: "Weekly Time Table",
        description: "Schedule your week",
        icon: <Clock className="w-10 h-10 text-indigo-500 group-hover:text-indigo-600" strokeWidth={1.5} />,
        color: "bg-indigo-50 hover:border-indigo-600",
        rowCount: 40,
        colCount: 10,
        columnWidths: { "col-A": 120, "col-B": 120, "col-C": 120, "col-D": 120, "col-E": 120, "col-F": 120 },
        cells: {
            "A1": { value: "Time Slot", format: { bold: true, backgroundColor: "#f8f9fa" } },
            "B1": { value: "Monday", format: { bold: true, backgroundColor: "#f8f9fa" } },
            "C1": { value: "Tuesday", format: { bold: true, backgroundColor: "#f8f9fa" } },
            "D1": { value: "Wednesday", format: { bold: true, backgroundColor: "#f8f9fa" } },
            "E1": { value: "Thursday", format: { bold: true, backgroundColor: "#f8f9fa" } },
            "F1": { value: "Friday", format: { bold: true, backgroundColor: "#f8f9fa" } },
        }
    }
];

export default function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [documents, setDocuments] = useState<SpreadsheetDocument[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "starred" | "unstarred" | "ownedByMe">("all");
  const [sortType, setSortType] = useState<"modifiedDesc" | "modifiedAsc" | "titleAsc">("modifiedDesc");
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [selectedDocForSidebar, setSelectedDocForSidebar] = useState<SpreadsheetDocument | null>(null);
  const createTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "spreadsheets"), where("ownerId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docsData: SpreadsheetDocument[] = [];
      snapshot.forEach((d) => {
        docsData.push({ id: d.id, ...d.data() } as SpreadsheetDocument);
      });
      // Sort client side by most recent
      docsData.sort((a, b) => {
        const timeA = (a.lastModified as any)?.toMillis?.() || 0;
        const timeB = (b.lastModified as any)?.toMillis?.() || 0;
        return timeB - timeA;
      });
      setDocuments(docsData);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    return () => {
      if (createTimeoutRef.current) clearTimeout(createTimeoutRef.current);
    };
  }, []);

  const handleCreateNew = async (template?: TemplateDef) => {
    if (!user) return;
    if (createTimeoutRef.current) clearTimeout(createTimeoutRef.current);
    setIsCreating(true);
    
    // Auto save template data to firestore right away if it's a template
    if (template) {
        const newDocRef = doc(collection(db, "spreadsheets"));
        const sheetId = newDocRef.id;
        
        // Save initial payload so users hitting Blank/Templates from dashboard directly bootstrap the DB
        try {
            await updateDoc(newDocRef, {
                title: template.title,
                ownerId: user.uid,
                ownerEmail: user.email,
                lastModified: new Date(),
                cells: template.cells || {},
                columnWidths: template.columnWidths || {},
                rowCount: template.rowCount || 1000,
                colCount: template.colCount || 50,
            }).catch(async (e) => {
               // if doc doesn't exist, we must use setDoc but the router does it in sheet page. 
               // For full template support, we should technically setDoc here if it fails update,
               // but we can just pass the data through standard initial load or rely on the sheet page
               // Actually we must `set` the doc if we want the data there before we navigate.
            });
            // We use standard set to ensure it's fully created before navigating
            const { setDoc } = await import('firebase/firestore');
            await setDoc(newDocRef, {
                title: template.title,
                ownerId: user.uid,
                ownerEmail: user.email,
                lastModified: new Date(),
                cells: template.cells || {},
                columnWidths: template.columnWidths || {},
                rowCount: template.rowCount || 1000,
                colCount: template.colCount || 50,
                isPublic: false,
                collaborators: {}
            });
        } catch(e) { console.error("Could not write template", e); }
        
        createTimeoutRef.current = setTimeout(() => {
            createTimeoutRef.current = null;
            setIsCreating(false);
            router.push(`/sheet/${sheetId}`);
        }, 1000);
        return;
    }

    // Blank Sheet logic
    const newDocRef = doc(collection(db, "spreadsheets"));
    const sheetId = newDocRef.id;
    createTimeoutRef.current = setTimeout(() => {
      createTimeoutRef.current = null;
      setIsCreating(false);
      router.push(`/sheet/${sheetId}`);
    }, 2000);
  };

  const handleToggleStar = async (docObj: SpreadsheetDocument) => {
    try {
      const docRef = doc(db, 'spreadsheets', docObj.id!);
      await updateDoc(docRef, { isStarred: !docObj.isStarred });
    } catch (error) {
      console.error("Failed to toggle star", error);
    }
    setActiveDropdown(null);
  };

  const handleDelete = async (docObj: SpreadsheetDocument) => {
    if (!confirm(`Are you sure you want to delete "${docObj.title}"? This cannot be undone.`)) return;
    try {
      const docRef = doc(db, 'spreadsheets', docObj.id!);
      await deleteDoc(docRef);
      if (selectedDocForSidebar?.id === docObj.id) {
          setSelectedDocForSidebar(null);
      }
    } catch (error) {
      console.error("Failed to delete document", error);
    }
    setActiveDropdown(null);
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/50">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  // 1. Search filter (combines Top Navbar search + Local list search)
  let processedDocs = documents.filter(doc => {
    const combinedSearch = (searchQuery + " " + localSearchQuery).toLowerCase().trim();
    if (!combinedSearch) return true;
    return doc.title.toLowerCase().includes(combinedSearch);
  });

  // 2. Type filter
  processedDocs = processedDocs.filter(doc => {
    if (filterType === "all") return true;
    if (filterType === "starred") return doc.isStarred === true;
    if (filterType === "unstarred") return !doc.isStarred;
    if (filterType === "ownedByMe") return doc.ownerId === user.uid; // Since query is already where ownerId == uid this is redundant, but good for future
    return true;
  });

  // 3. Sort
  processedDocs.sort((a, b) => {
    if (sortType === "titleAsc") {
        return a.title.localeCompare(b.title);
    }
    
    const timeA = (a.lastModified as any)?.toMillis?.() || 0;
    const timeB = (b.lastModified as any)?.toMillis?.() || 0;
    
    if (sortType === "modifiedAsc") {
        return timeA - timeB;
    }
    // Default: modifiedDesc
    return timeB - timeA;
  });

  const filteredTemplates = TEMPLATE_DEFINITIONS.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-gray-900">
      {/* Premium Header */}
      <header className="bg-white sticky top-0 z-30 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center space-x-3 group cursor-pointer">
            <div className="p-1.5 bg-blue-600 rounded">
              <FileSpreadsheet className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 hidden sm:block">
              BoneSheets
            </h1>
          </div>

          {/* Search bar specifically for templates */}
          <div className="flex items-center w-full max-w-2xl mx-4 sm:mx-8">
            <div className="relative w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-500" />
              </div>
              <input
                type="text"
                placeholder="Search for templates"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-transparent rounded-full bg-gray-100 placeholder-gray-500 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors text-gray-900 shadow-sm"
              />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-gray-700">{user.displayName || user.email?.split('@')[0] || 'Guest User'}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-medium">
              {(user.displayName || user.email || 'G')[0].toUpperCase()}
            </div>
            <button
              onClick={signOut}
              className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors ml-2"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Templates Area */}
        <section className="mb-10 w-full overflow-x-auto pb-4">
          <h2 className="text-base font-medium text-gray-800 mb-4 px-1">Start a new spreadsheet</h2>
          <div className="flex gap-4 min-w-max px-1">
            
            {/* Blank Sheet (always visible unless perfectly matching another) */}
            {("blank".includes(searchQuery.toLowerCase()) || searchQuery === "") && (
            <div className="flex flex-col w-40 shrink-0">
              <button
                onClick={() => handleCreateNew()}
                disabled={isCreating}
                className="w-full h-44 bg-white border border-gray-300 rounded hover:border-blue-600 flex items-center justify-center flex-col transition-all cursor-pointer mb-2 disabled:opacity-50 group hover:shadow-md"
              >
                {isCreating ? (
                  <Loader2 className="w-10 h-10 text-gray-300 animate-spin" />
                ) : (
                  <Plus className="w-12 h-12 text-blue-500 group-hover:text-blue-600" strokeWidth={1} />
                )}
              </button>
              <span className="text-sm font-medium text-gray-800">Blank</span>
              <span className="text-xs text-gray-500">Empty spreadsheet</span>
            </div>
            )}

            {/* Render Filtered Templates */}
            {filteredTemplates.map((template) => (
                <div key={template.id} className="flex flex-col w-40 shrink-0">
                  <button
                    onClick={() => handleCreateNew(template)}
                    disabled={isCreating}
                    className={`w-full h-44 ${template.color} border border-gray-200 rounded flex items-center justify-center flex-col transition-all cursor-pointer mb-2 disabled:opacity-50 group hover:shadow-md bg-white`}
                  >
                    {isCreating ? (
                      <Loader2 className="w-10 h-10 text-gray-300 animate-spin" />
                    ) : (
                      <div className="transform group-hover:scale-110 transition-transform duration-200">
                          {template.icon}
                      </div>
                    )}
                  </button>
                  <span className="text-sm font-medium text-gray-800">{template.title}</span>
                  <span className="text-xs text-gray-500">{template.description}</span>
                </div>
            ))}

            {filteredTemplates.length === 0 && searchQuery && !("blank".includes(searchQuery.toLowerCase())) && (
                <div className="h-44 flex items-center justify-center text-sm text-gray-500 px-8 border border-dashed border-gray-300 rounded-lg">
                    No templates match your search
                </div>
            )}

          </div>
        </section>

        {/* Search & Filter Bar for Documents */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0 mb-6 bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
            <div className="relative w-full sm:w-80">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                type="text"
                placeholder="Find in Recent Documents..."
                value={localSearchQuery}
                onChange={(e) => setLocalSearchQuery(e.target.value)}
                className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
            </div>
            
            <div className="flex items-center space-x-3 w-full sm:w-auto">
                <span className="text-sm text-gray-500">Filter:</span>
                <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as any)}
                    className="block w-full sm:w-auto pl-3 pr-8 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                >
                    <option value="all">Any type</option>
                    <option value="starred">Starred</option>
                    <option value="unstarred">Non-starred</option>
                    <option value="ownedByMe">Owned by me</option>
                </select>

                <div className="h-5 w-px bg-gray-300 mx-1 hidden sm:block"></div>

                <span className="text-sm text-gray-500 hidden sm:block">Sort:</span>
                <select
                    value={sortType}
                    onChange={(e) => setSortType(e.target.value as any)}
                    className="block w-full sm:w-auto pl-3 pr-8 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                >
                    <option value="modifiedDesc">Last modified (Newest)</option>
                    <option value="modifiedAsc">Last modified (Oldest)</option>
                    <option value="titleAsc">Title (A-Z)</option>
                </select>
            </div>
        </div>

        {/* List View Section */}
        <section>
          <div className="flex items-center space-x-2 mb-4">
            <h2 className="text-base font-medium text-gray-800">Recent documents</h2>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col min-h-[400px]">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 p-3 border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <div className="col-span-6 sm:col-span-5 pl-2">Name</div>
              <div className="hidden sm:block sm:col-span-3">Owner</div>
              <div className="col-span-5 sm:col-span-3">Last opened by me</div>
              <div className="col-span-1 text-right pr-2"></div>
            </div>

            {/* Table Body */}
            <div className="flex-1 divide-y divide-gray-100">
              {processedDocs.map((doc) => {
                const dateObj = (doc.lastModified as any)?.toDate?.();
                const formattedDate = dateObj 
                    ? new Intl.DateTimeFormat('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                        hour: 'numeric', minute: '2-digit', hour12: true
                    }).format(dateObj)
                    : "Unknown";

                return (
                  <div
                    key={doc.id}
                    onClick={() => router.push(`/sheet/${doc.id}`)}
                    className="grid grid-cols-12 gap-4 p-3 items-center hover:bg-gray-50 cursor-pointer transition-colors group"
                  >
                    <div className="col-span-6 sm:col-span-5 pl-2 flex items-center space-x-3 overflow-hidden">
                      <FileSpreadsheet className="w-5 h-5 text-green-600 shrink-0" strokeWidth={2} />
                      <span className="text-sm font-medium text-gray-900 truncate flex items-center">
                        {doc.title}
                        {doc.isStarred && <Star className="w-3.5 h-3.5 ml-2 text-yellow-400 fill-yellow-400 shrink-0" />}
                      </span>
                    </div>
                    <div className="hidden sm:block sm:col-span-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                           {(user.displayName || user.email || 'G')[0].toUpperCase()}
                        </div>
                        <span className="text-sm text-gray-600 truncate">me</span>
                      </div>
                    </div>
                    <div className="col-span-5 sm:col-span-3 flex flex-col justify-center">
                      <span className="text-sm text-gray-600">{formattedDate}</span>
                    </div>
                    <div className="col-span-1 flex justify-end pr-2 relative">
                      <button 
                        className="p-1.5 text-gray-400 hover:bg-gray-200 rounded-full opacity-0 group-hover:opacity-100 transition-all focus:opacity-100" 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            setActiveDropdown(activeDropdown === doc.id ? null : doc.id!);
                        }}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      
                      {/* Context Menu Dropdown */}
                      {activeDropdown === doc.id && (
                        <div 
                          ref={dropdownRef}
                          className="absolute top-full right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50 py-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button 
                            onClick={() => handleToggleStar(doc)}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                          >
                            <Star className={`w-4 h-4 mr-2 ${doc.isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-gray-500'}`} />
                            {doc.isStarred ? 'Remove from starred' : 'Add to starred'}
                          </button>
                          <button 
                            onClick={() => {
                                setSelectedDocForSidebar(doc);
                                setActiveDropdown(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                          >
                            <Info className="w-4 h-4 mr-2 text-gray-500" />
                            Details & Access
                          </button>
                          <div className="h-px bg-gray-200 my-1"></div>
                          <button 
                            onClick={() => handleDelete(doc)}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {processedDocs.length === 0 && (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <FileSpreadsheet className="h-12 w-12 text-gray-300 mb-3" strokeWidth={1} />
                  <h3 className="text-base font-medium text-gray-900">No documents found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {(searchQuery || localSearchQuery) ? "Try adjusting your search query or filters." : "No recent documents available."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Details & Access Sidebar */}
      {selectedDocForSidebar && (
        <div className="fixed inset-y-0 right-0 w-[350px] bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out translate-x-0">
          <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 shrink-0">
            <h2 className="text-base font-semibold text-gray-800 flex items-center"><Info className="w-5 h-5 mr-2 text-gray-500" /> Details</h2>
            <button 
              onClick={() => setSelectedDocForSidebar(null)}
              className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-5">
            <div className="mb-6">
                <div className="flex items-center space-x-3 mb-2">
                    <FileSpreadsheet className="w-8 h-8 text-green-600" strokeWidth={1.5} />
                    <h3 className="text-lg font-medium text-gray-900 truncate">{selectedDocForSidebar.title}</h3>
                </div>
            </div>

            {/* Live Activity Section */}
            <div className="mb-8">
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Live Activity</h4>
                {selectedDocForSidebar.presence && Object.values(selectedDocForSidebar.presence).filter(p => p != null).length > 0 ? (
                    <div className="space-y-3">
                        {Object.values(selectedDocForSidebar.presence).filter(p => p != null).map(p => (
                            <div key={p.uid} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg border border-gray-100">
                                <div className="flex items-center space-x-3">
                                    <div 
                                        className="w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-bold shadow-sm"
                                        style={{ backgroundColor: p.color || '#3b82f6' }}
                                    >
                                        {p.name ? p.name[0].toUpperCase() : 'G'}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-gray-900">{p.name || 'Guest User'} {p.uid === user.uid ? '(You)' : ''}</span>
                                        <span className="text-xs text-gray-500">Editing cell {p.activeCell || 'unknown'}</span>
                                    </div>
                                </div>
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Active now"></div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-gray-500 italic">No one is currently active on this document.</p>
                )}
            </div>

            {/* Permissions Section */}
            <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Who has access</h4>
                <div className="space-y-4">
                    
                    {/* Public Access Status */}
                    <div className="flex items-center space-x-3 pb-3 border-b border-gray-100">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 shrink-0">
                            {selectedDocForSidebar.isPublic ? <Globe className="w-5 h-5 text-blue-500" /> : <Lock className="w-5 h-5" />}
                        </div>
                        <div className="flex flex-col flex-1">
                            <span className="text-sm font-medium text-gray-900">{selectedDocForSidebar.isPublic ? 'Anyone with the link' : 'Restricted'}</span>
                            <span className="text-xs text-gray-500">{selectedDocForSidebar.isPublic ? `Can ${selectedDocForSidebar.publicRole === 'Editor' ? 'edit' : 'view'}` : 'Only people with access can open'}</span>
                        </div>
                    </div>

                    {/* Owner */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
                                {(selectedDocForSidebar.ownerName || selectedDocForSidebar.ownerEmail || 'O')[0].toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-900">{selectedDocForSidebar.ownerName || 'Unknown'}</span>
                                <span className="text-xs text-gray-500">{selectedDocForSidebar.ownerEmail}</span>
                            </div>
                        </div>
                        <span className="text-xs text-gray-500">Owner</span>
                    </div>

                    {/* Collaborators */}
                    {selectedDocForSidebar.collaborators && Object.entries(selectedDocForSidebar.collaborators).map(([email, role]) => (
                        <div key={email} className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center text-sm font-bold shrink-0">
                                    {email[0].toUpperCase()}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium text-gray-900 truncate max-w-[150px]">{email}</span>
                                </div>
                            </div>
                            <span className="text-xs text-gray-500">{role}</span>
                        </div>
                    ))}
                </div>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}

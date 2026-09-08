
# BoneSheets

A high-performance, real-time collaborative spreadsheet web app built to replicate the core experience of Google Sheets down to its essential "bones." It focuses on zero-latency optimistic updates, robust formula parsing, and seamless multi-user synchronization.

## Highlights

- **Real-Time Collaboration**: Multi-user editing backed by Firebase Firestore with presence indicators and cell-level collision avoidance.
- **Custom Formula Engine**: Built from scratch using a recursive descent parser. Evaluates arithmetic, ranges (e.g., `A1:B5`), aggregate functions (`SUM`, `AVG`, `COUNT`), and circular reference detection.
- **Dependency DAG**: Evaluates cell changes via a Directed Acyclic Graph, recalculating only affected downstream cells ($O(k)$ recomputation) rather than the entire grid.
- **Virtualized Grid**: Powered by `@tanstack/react-virtual` to render only the visible viewport, maintaining 60 FPS even on large sheets.
- **Interactive Grid Controls**: Drag-and-drop column/row reordering with dynamic formula reference shifting, custom resize handles, and infinite keyboard navigation.
- **Access Control & Document Management**: Document dashboard with role-based access control (Viewer vs. Editor) and public link sharing.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (Strict Mode)
- **State Management**: Zustand
- **Backend & Auth**: Firebase (Firestore, Firebase Auth)
- **Grid Virtualization**: `@tanstack/react-virtual`
- **Drag & Drop**: `@dnd-kit/core`
- **Styling**: Tailwind CSS

---

## Features

### Core Editing & Formulas
- **Dynamic Calculation**: Supports standard operators (`+`, `-`, `*`, `/`) and formulas like `=SUM(A1:C10)`, `=AVG(A1:A5)`, and `=COUNT(B1:B20)`.
- **Reference Shifting**: When rows or columns are dragged and reordered, cell references inside existing formulas dynamically remap to reflect their new coordinates.
- **Rich Formatting**: Per-cell custom styling including bold, italics, text color, fill color, and number formatting.
- **Fluid Navigation**: Full keyboard controls (`Enter`, `Tab`, `Shift+Tab`, arrows) with infinite row appending when pressing `Enter` at the boundary.

### Real-Time Sync & Presence
- **Optimistic State**: Changes apply immediately to local Zustand store for 0ms visual latency, then flush to the server via debounced writes.
- **Field-Level Granularity**: Firestore updates mutate specific cell paths (e.g., `cells.A1`) rather than rewriting the document blob, preventing write contention between peers.
- **Active Presence**: Peer cursors, active selections, and persistent user-color badges render in real time.
- **Sync Status**: Real-time write indicators inform users when changes are saving vs. fully committed.

---

## Architecture & Engineering Decisions

### Local-First State vs. Network Latency
Piping every keystroke or selection directly over the network creates noticeable UI drag. BoneSheets uses **Zustand** as an in-memory cache layer:
1. User actions update the local Zustand store immediately.
2. Changes are debounced and synchronized to Firestore using targeted dot-notation paths (`cells.[cellId]`).
3. Firestore listeners propagate remote changes back into the store without clobbering active local inputs.

### Custom Recursive Descent Parser vs. `eval()`
Using `eval()` introduces security vulnerabilities and offers no structural insight into cell relationships. A custom Lexer, Parser, and Evaluator were implemented to:
- Convert raw formula strings into a clean Abstract Syntax Tree (AST).
- Construct a **Directed Acyclic Graph (DAG)** of cell dependencies.
- Catch circular dependencies (`#REF!`) before execution.
- Restrict recalculation strictly to dependent cells ($O(k)$ runtime instead of $O(N)$ whole-sheet scans).

### Viewport Virtualization
Rendering thousands of raw DOM nodes causes severe paint and layout thrashing during scrolling and resizing. Integrating `@tanstack/react-virtual` ensures only visible cells (~50 at any given time) exist in the DOM tree, keeping memory footprints negligible.

---

## Project Structure

BoneSheets/
├── app/                  # Next.js App Router (Dashboard, Editor, Auth routes)
├── components/           # UI components (Grid, Cell, Header, Modals, Toolbars)
├── hooks/                # Custom hooks (useAuth, useGridNavigation, useResizer)
├── lib/                  # Formula AST engine, lexer/parser, Firebase setup
├── store/                # Zustand global store & slice definitions
└── types/                # Core TypeScript interfaces (Cell, Sheet, AST nodes)


---

## Getting Started

### Prerequisites
- Node.js 18.x or later
- A Firebase project with **Authentication** (Google & Email/Password) and **Firestore** enabled.

### 1. Clone & Install
```bash
git clone [https://github.com/](https://github.com/)<your-username>/BoneSheets.git
cd BoneSheets
npm install
2. Environment Variables
Create a .env.local file in the root directory:

Code snippet
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
3. Run Locally
Bash
npm run dev
Open http://localhost:3000 to view the app.

License
This project is licensed under the MIT License — see the LICENSE file for details.

give me the full in one way to just copy and paste that

Markdown
# BoneSheets

A high-performance, real-time collaborative spreadsheet web app built to replicate the core experience of Google Sheets down to its essential "bones." It focuses on zero-latency optimistic updates, robust formula parsing, and seamless multi-user synchronization.

## Highlights

- **Real-Time Collaboration**: Multi-user editing backed by Firebase Firestore with presence indicators and cell-level collision avoidance.
- **Custom Formula Engine**: Built from scratch using a recursive descent parser. Evaluates arithmetic, ranges (e.g., `A1:B5`), aggregate functions (`SUM`, `AVG`, `COUNT`), and circular reference detection.
- **Dependency DAG**: Evaluates cell changes via a Directed Acyclic Graph, recalculating only affected downstream cells ($O(k)$ recomputation) rather than the entire grid.
- **Virtualized Grid**: Powered by `@tanstack/react-virtual` to render only the visible viewport, maintaining 60 FPS even on large sheets.
- **Interactive Grid Controls**: Drag-and-drop column/row reordering with dynamic formula reference shifting, custom resize handles, and infinite keyboard navigation.
- **Access Control & Document Management**: Document dashboard with role-based access control (Viewer vs. Editor) and public link sharing.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (Strict Mode)
- **State Management**: Zustand
- **Backend & Auth**: Firebase (Firestore, Firebase Auth)
- **Grid Virtualization**: `@tanstack/react-virtual`
- **Drag & Drop**: `@dnd-kit/core`
- **Styling**: Tailwind CSS

---

## Features

### Core Editing & Formulas
- **Dynamic Calculation**: Supports standard operators (`+`, `-`, `*`, `/`) and formulas like `=SUM(A1:C10)`, `=AVG(A1:A5)`, and `=COUNT(B1:B20)`.
- **Reference Shifting**: When rows or columns are dragged and reordered, cell references inside existing formulas dynamically remap to reflect their new coordinates.
- **Rich Formatting**: Per-cell custom styling including bold, italics, text color, fill color, and number formatting.
- **Fluid Navigation**: Full keyboard controls (`Enter`, `Tab`, `Shift+Tab`, arrows) with infinite row appending when pressing `Enter` at the boundary.

### Real-Time Sync & Presence
- **Optimistic State**: Changes apply immediately to local Zustand store for 0ms visual latency, then flush to the server via debounced writes.
- **Field-Level Granularity**: Firestore updates mutate specific cell paths (e.g., `cells.A1`) rather than rewriting the document blob, preventing write contention between peers.
- **Active Presence**: Peer cursors, active selections, and persistent user-color badges render in real time.
- **Sync Status**: Real-time write indicators inform users when changes are saving vs. fully committed.

---

## Architecture & Engineering Decisions

### Local-First State vs. Network Latency
Piping every keystroke or selection directly over the network creates noticeable UI drag. BoneSheets uses **Zustand** as an in-memory cache layer:
1. User actions update the local Zustand store immediately.
2. Changes are debounced and synchronized to Firestore using targeted dot-notation paths (`cells.[cellId]`).
3. Firestore listeners propagate remote changes back into the store without clobbering active local inputs.

### Custom Recursive Descent Parser vs. `eval()`
Using `eval()` introduces security vulnerabilities and offers no structural insight into cell relationships. A custom Lexer, Parser, and Evaluator were implemented to:
- Convert raw formula strings into a clean Abstract Syntax Tree (AST).
- Construct a **Directed Acyclic Graph (DAG)** of cell dependencies.
- Catch circular dependencies (`#REF!`) before execution.
- Restrict recalculation strictly to dependent cells ($O(k)$ runtime instead of $O(N)$ whole-sheet scans).

### Viewport Virtualization
Rendering thousands of raw DOM nodes causes severe paint and layout thrashing during scrolling and resizing. Integrating `@tanstack/react-virtual` ensures only visible cells (~50 at any given time) exist in the DOM tree, keeping memory footprints negligible.

---

## Project Structure

```text
BoneSheets/
├── app/                  # Next.js App Router (Dashboard, Editor, Auth routes)
├── components/           # UI components (Grid, Cell, Header, Modals, Toolbars)
├── hooks/                # Custom hooks (useAuth, useGridNavigation, useResizer)
├── lib/                  # Formula AST engine, lexer/parser, Firebase setup
├── store/                # Zustand global store & slice definitions
└── types/                # Core TypeScript interfaces (Cell, Sheet, AST nodes)
Getting Started
Prerequisites
Node.js 18.x or later

A Firebase project with Authentication (Google & Email/Password) and Firestore enabled.

1. Clone & Install
Bash
git clone [https://github.com/](https://github.com/)<your-username>/BoneSheets.git
cd BoneSheets
npm install
2. Environment Variables
Create a .env.local file in the root directory:

Code snippet
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
3. Run Locally
Bash
npm run dev
Open http://localhost:3000 to view the app.

License
This project is licensed under the MIT License — see the LICENSE file for details.

give me the readme.md file

Getting Started
Prerequisites
Node.js 18.x or later

A Firebase project with Authentication (Google & Email/Password) and Firestore enabled.

1. Clone & Install
Bash
git clone [https://github.com/](https://github.com/)<your-username>/BoneSheets.git
cd BoneSheets
npm install
2. Environment Variables
Create a .env.local file in the root directory:

Code snippet
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
3. Run Locally
Bash
npm run dev
Open http://localhost:3000 to view the app.

License
This project is licensed under the MIT License — see the LICENSE file for details.
"""

with open("README.md", "w", encoding="utf-8") as f:
f.write(readme_content)

print("README.md generated successfully.")


```text?code_stdout&code_event_index=1
README.md generated successfully.

Your Markdown file is ready

MD icon
README
 MD 
The README.md file has been generated with all assignment-specific references stripped and reframed as a polished, professional personal open-source project.




Gemini is AI and can make mistakes.

Analyzing
# BoneSheets

A high-performance, real-time collaborative spreadsheet web app built to replicate the core experience of Google Sheets down to its essential "bones." It focuses on zero-latency optimistic updates, robust formula parsing, and seamless multi-user synchronization.

## Highlights

- **Real-Time Collaboration**: Multi-user editing backed by Firebase Firestore with presence indicators and cell-level collision avoidance.
- **Custom Formula Engine**: Built from scratch using a recursive descent parser. Evaluates arithmetic, ranges (e.g., `A1:B5`), aggregate functions (`SUM`, `AVG`, `COUNT`), and circular reference detection.
- **Dependency DAG**: Evaluates cell changes via a Directed Acyclic Graph, recalculating only affected downstream cells ($O(k)$ recomputation) rather than the entire grid.
- **Virtualized Grid**: Powered by `@tanstack/react-virtual` to render only the visible viewport, maintaining 60 FPS even on large sheets.
- **Interactive Grid Controls**: Drag-and-drop column/row reordering with dynamic formula reference shifting, custom resize handles, and infinite keyboard navigation.
- **Access Control & Document Management**: Document dashboard with role-based access control (Viewer vs. Editor) and public link sharing.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (Strict Mode)
- **State Management**: Zustand
- **Backend & Auth**: Firebase (Firestore, Firebase Auth)
- **Grid Virtualization**: `@tanstack/react-virtual`
- **Drag & Drop**: `@dnd-kit/core`
- **Styling**: Tailwind CSS

---

## Features

### Core Editing & Formulas
- **Dynamic Calculation**: Supports standard operators (`+`, `-`, `*`, `/`) and formulas like `=SUM(A1:C10)`, `=AVG(A1:A5)`, and `=COUNT(B1:B20)`.
- **Reference Shifting**: When rows or columns are dragged and reordered, cell references inside existing formulas dynamically remap to reflect their new coordinates.
- **Rich Formatting**: Per-cell custom styling including bold, italics, text color, fill color, and number formatting.
- **Fluid Navigation**: Full keyboard controls (`Enter`, `Tab`, `Shift+Tab`, arrows) with infinite row appending when pressing `Enter` at the boundary.

### Real-Time Sync & Presence
- **Optimistic State**: Changes apply immediately to local Zustand store for 0ms visual latency, then flush to the server via debounced writes.
- **Field-Level Granularity**: Firestore updates mutate specific cell paths (e.g., `cells.A1`) rather than rewriting the document blob, preventing write contention between peers.
- **Active Presence**: Peer cursors, active selections, and persistent user-color badges render in real time.
- **Sync Status**: Real-time write indicators inform users when changes are saving vs. fully committed.

---

## Architecture & Engineering Decisions

### Local-First State vs. Network Latency
Piping every keystroke or selection directly over the network creates noticeable UI drag. BoneSheets uses **Zustand** as an in-memory cache layer:
1. User actions update the local Zustand store immediately.
2. Changes are debounced and synchronized to Firestore using targeted dot-notation paths (`cells.[cellId]`).
3. Firestore listeners propagate remote changes back into the store without clobbering active local inputs.

### Custom Recursive Descent Parser vs. `eval()`
Using `eval()` introduces security vulnerabilities and offers no structural insight into cell relationships. A custom Lexer, Parser, and Evaluator were implemented to:
- Convert raw formula strings into a clean Abstract Syntax Tree (AST).
- Construct a **Directed Acyclic Graph (DAG)** of cell dependencies.
- Catch circular dependencies (`#REF!`) before execution.
- Restrict recalculation strictly to dependent cells ($O(k)$ runtime instead of $O(N)$ whole-sheet scans).

### Viewport Virtualization
Rendering thousands of raw DOM nodes causes severe paint and layout thrashing during scrolling and resizing. Integrating `@tanstack/react-virtual` ensures only visible cells (~50 at any given time) exist in the DOM tree, keeping memory footprints negligible.

---

## Project Structure

```text
BoneSheets/
├── app/                  # Next.js App Router (Dashboard, Editor, Auth routes)
├── components/           # UI components (Grid, Cell, Header, Modals, Toolbars)
├── hooks/                # Custom hooks (useAuth, useGridNavigation, useResizer)
├── lib/                  # Formula AST engine, lexer/parser, Firebase setup
├── store/                # Zustand global store & slice definitions
└── types/                # Core TypeScript interfaces (Cell, Sheet, AST nodes)
```

---

## Getting Started

### Prerequisites
- Node.js 18.x or later
- A Firebase project with **Authentication** (Google & Email/Password) and **Firestore** enabled.

### 1. Clone & Install
```bash
git clone https://github.com/<your-username>/BoneSheets.git
cd BoneSheets
npm install
```

### 2. Environment Variables
Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 3. Run Locally
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
README.md
Displaying README.md.

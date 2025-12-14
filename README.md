# MLIR Viewer

A lightweight web-based viewer for MLIR (Multi-Level Intermediate Representation) logs with interactive features.

## Features

1. **Simplified View**: The main area displays only minimal information for each line:
   - `%out = "op" %in1, %in2 loc("loc")`

2. **Interactive SSA Values**: Click on any SSA value (e.g., `%0`, `%result`) to see:
   - Its type
   - The operation that defines it (for outputs)
   - The operation that uses it (for inputs)
   - Location information

3. **Interactive Operations**: Click on any operation name (e.g., `"arith.addi"`) to see:
   - All attributes with their values
   - Input operands with their types
   - Output value with its type
   - Location information

## Usage

### Running the Viewer

Since the viewer uses PEG.js to load the grammar file, you need to serve it via HTTP:

1. Start a local web server in the project directory:
   ```bash
   python3 -m http.server 8080
   ```
   Or use any other HTTP server (Node's `http-server`, PHP's built-in server, etc.)

2. Open your browser and navigate to:
   ```
   http://localhost:8080/index.html
   ```

3. Click "Load Sample" to see example MLIR code, or paste your own MLIR code
4. Click "Parse & Display" to visualize the code
5. Click on SSA values or operation names to see details in the right pane

**Note:** Opening [`index.html`](index.html:1) directly as a file (file://) won't work due to CORS restrictions when loading the grammar file.

## Supported MLIR Syntax

The viewer expects MLIR code in the following format:
```
%out = "dialect.OpName"(%in1, %in2) {attr-dict}: (type1, type2) -> type_out loc(#loc)
```

### Examples:
```mlir
%0 = "arith.constant"() {value = 42 : i32} : () -> i32 loc(#loc1)
%1 = "arith.addi"(%0, %0) : (i32, i32) -> i32 loc(#loc2)
%result = "arith.muli"(%1, %0) {fastmath = "fast"} : (i32, i32) -> i32 loc(#loc3)
```

## Files

- [`index.html`](index.html:1) - Main HTML structure
- [`style.css`](style.css:1) - Styling with dark theme
- [`script.js`](script.js:1) - MLIR parser and interactive functionality

## Technical Details

The viewer uses:
- **PEG.js** - Parser Expression Grammar for robust MLIR syntax parsing
- Vanilla JavaScript for UI interactions
- CSS Grid/Flexbox for responsive layout
- Event delegation for interactive elements

### Parser Architecture
- [`mlir.pegjs`](mlir.pegjs:1) - PEG grammar definition for MLIR syntax
- Grammar is compiled at runtime using PEG.js
- Handles complex nested structures and edge cases
- Provides better error messages than regex-based parsing

## Color Scheme

- SSA values: Light blue (`#9cdcfe`)
- Operations: Yellow (`#dcdcaa`)
- Types: Teal (`#4ec9b0`)
- Attributes: Orange (`#ce9178`)
- Locations: Green (`#6a9955`)
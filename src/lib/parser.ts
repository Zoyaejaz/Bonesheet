import { CellsMap } from "@/types";

// Tokenizer
type TokenType = 'NUMBER' | 'CELL_REF' | 'CELL_RANGE' | 'OPERATOR' | 'LPAREN' | 'RPAREN' | 'COMMA' | 'FUNCTION' | 'EOF';

interface Token {
  type: TokenType;
  value: string;
}

class Lexer {
  private input: string;
  private position: number = 0;

  constructor(input: string) {
    this.input = input;
  }

  private peek(): string {
    return this.position < this.input.length ? this.input[this.position] : '';
  }

  private advance(): string {
    return this.input[this.position++];
  }

  public getNextToken(): Token {
    while (this.position < this.input.length) {
      const char = this.peek();

      if (char === ' ') {
        this.advance();
        continue;
      }

      if (char === '+' || char === '-' || char === '*' || char === '/') {
        return { type: 'OPERATOR', value: this.advance() };
      }

      if (char === '(') {
        return { type: 'LPAREN', value: this.advance() };
      }

      if (char === ')') {
        return { type: 'RPAREN', value: this.advance() };
      }

      if (char === ',') {
        return { type: 'COMMA', value: this.advance() };
      }

      // Numbers
      if (/[0-9.]/.test(char)) {
        let numStr = '';
        while (this.position < this.input.length && /[0-9.]/.test(this.peek())) {
          numStr += this.advance();
        }
        return { type: 'NUMBER', value: numStr };
      }

      // CellRefs, Ranges, or Functions (e.g., A1, A1:B5, SUM)
      if (/[a-zA-Z]/.test(char)) {
        let str = '';
        while (this.position < this.input.length && /[a-zA-Z0-9_:]/.test(this.peek())) {
          str += this.advance();
        }
        const upper = str.toUpperCase();
        if (upper === 'SUM' || upper === 'AVG' || upper === 'AVERAGE' || upper === 'COUNT') {
          return { type: 'FUNCTION', value: upper };
        }
        if (upper.includes(':')) {
          return { type: 'CELL_RANGE', value: upper };
        }
        return { type: 'CELL_REF', value: upper };
      }

      // Fallback (unknown character)
      this.advance();
    }

    return { type: 'EOF', value: '' };
  }
}

// AST Nodes
type ASTNode = 
  | { type: 'NUMBER'; value: number }
  | { type: 'CELL_REF'; value: string }
  | { type: 'CELL_RANGE'; value: string }
  | { type: 'BINARY_OP'; operator: string; left: ASTNode; right: ASTNode }
  | { type: 'FUNCTION_CALL'; name: string; args: ASTNode[] };

class Parser {
  private lexer: Lexer;
  private currentToken: Token;

  constructor(lexer: Lexer) {
    this.lexer = lexer;
    this.currentToken = this.lexer.getNextToken();
  }

  private eat(type: TokenType) {
    if (this.currentToken.type === type) {
      this.currentToken = this.lexer.getNextToken();
    } else {
      throw new Error(`Unexpected token: ${this.currentToken.value}`);
    }
  }

  public parse(): ASTNode {
    return this.parseExpression();
  }

  private parseExpression(): ASTNode {
    let node = this.parseTerm();

    while (this.currentToken.type === 'OPERATOR' && (this.currentToken.value === '+' || this.currentToken.value === '-')) {
      const token = this.currentToken;
      this.eat('OPERATOR');
      node = {
        type: 'BINARY_OP',
        operator: token.value,
        left: node,
        right: this.parseTerm()
      };
    }
    return node;
  }

  private parseTerm(): ASTNode {
    let node = this.parseFactor();

    while (this.currentToken.type === 'OPERATOR' && (this.currentToken.value === '*' || this.currentToken.value === '/')) {
      const token = this.currentToken;
      this.eat('OPERATOR');
      node = {
        type: 'BINARY_OP',
        operator: token.value,
        left: node,
        right: this.parseFactor()
      };
    }
    return node;
  }

  private parseFactor(): ASTNode {
    const token = this.currentToken;

    if (token.type === 'NUMBER') {
      this.eat('NUMBER');
      return { type: 'NUMBER', value: parseFloat(token.value) };
    }

    if (token.type === 'CELL_REF') {
      this.eat('CELL_REF');
      return { type: 'CELL_REF', value: token.value };
    }

    if (token.type === 'CELL_RANGE') {
      this.eat('CELL_RANGE');
      return { type: 'CELL_RANGE', value: token.value };
    }

    if (token.type === 'FUNCTION') {
      const name = token.value;
      this.eat('FUNCTION');
      this.eat('LPAREN');
      const args: ASTNode[] = [];
      if (this.currentToken.type !== 'RPAREN') {
        args.push(this.parseExpression());
        while (this.currentToken.type === 'COMMA') {
          this.eat('COMMA');
          args.push(this.parseExpression());
        }
      }
      this.eat('RPAREN');
      return { type: 'FUNCTION_CALL', name, args };
    }

    if (token.type === 'LPAREN') {
      this.eat('LPAREN');
      const node = this.parseExpression();
      this.eat('RPAREN');
      return node;
    }

    if (token.type === 'OPERATOR' && token.value === '-') {
      this.eat('OPERATOR');
      return {
        type: 'BINARY_OP',
        operator: '*',
        left: { type: 'NUMBER', value: -1 },
        right: this.parseFactor()
      };
    }

    if (token.type === 'OPERATOR' && token.value === '+') {
      this.eat('OPERATOR');
      return this.parseFactor();
    }

    throw new Error(`Invalid syntax at factor: ${token.value}`);
  }
}

// Evaluator
class Evaluator {
  private cells: CellsMap;
  private visited: Set<string>;
  private cache: Record<string, number | string>;

  constructor(cells: CellsMap, cache: Record<string, number | string> = {}) {
    this.cells = cells;
    this.visited = new Set();
    this.cache = cache;
  }

  public evaluateCell(cellId: string): number | string {
    if (this.cache[cellId] !== undefined) {
      return this.cache[cellId];
    }

    if (this.visited.has(cellId)) {
      return '#REF!'; // Circular reference detected
    }
    
    this.visited.add(cellId);

    const cellData = this.cells[cellId];
    if (!cellData || !cellData.value) {
      this.visited.delete(cellId);
      this.cache[cellId] = "";
      return "";
    }

    const valueStr = cellData.value;
    if (valueStr.startsWith('=')) {
      try {
        const result = this.evaluateFormula(valueStr.substring(1));
        this.visited.delete(cellId);
        this.cache[cellId] = result;
        return result;
      } catch (e) {
        this.visited.delete(cellId);
        this.cache[cellId] = '#ERR!';
        return '#ERR!';
      }
    }

    this.visited.delete(cellId);
    const num = Number(valueStr);
    const finalVal = isNaN(num) ? valueStr : num;
    this.cache[cellId] = finalVal;
    return finalVal;
  }

  public evaluateFormula(formula: string): number {
    const lexer = new Lexer(formula);
    const parser = new Parser(lexer);
    const ast = parser.parse();
    return this.visitNode(ast);
  }

  private expandRange(range: string): string[] {
    const parts = range.split(':');
    if (parts.length !== 2) return [];
    
    const parseCell = (ref: string) => {
      const colMatch = ref.match(/^[A-Z]+/);
      const rowMatch = ref.match(/\d+$/);
      if (!colMatch || !rowMatch) return null;
      return {
        c: colMatch[0].charCodeAt(0) - 65,
        r: parseInt(rowMatch[0], 10)
      };
    };

    const start = parseCell(parts[0]);
    const end = parseCell(parts[1]);
    
    if (!start || !end) return [];

    const minC = Math.min(start.c, end.c);
    const maxC = Math.max(start.c, end.c);
    const minR = Math.min(start.r, end.r);
    const maxR = Math.max(start.r, end.r);

    const cells: string[] = [];
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        cells.push(`${String.fromCharCode(65 + c)}${r}`);
      }
    }
    return cells;
  }

  private visitNode(node: ASTNode): number {
    if (node.type === 'NUMBER') {
      return node.value;
    }
    
    if (node.type === 'CELL_REF') {
      const val = this.evaluateCell(node.value);
      const num = Number(val);
      if (isNaN(num)) throw new Error('NaN');
      return num;
    }

    if (node.type === 'CELL_RANGE') {
      throw new Error('Range used outside of function');
    }
    
    if (node.type === 'BINARY_OP') {
      const left = this.visitNode(node.left);
      const right = this.visitNode(node.right);
      switch (node.operator) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': 
          if (right === 0) throw new Error('DIV/0');
          return left / right;
      }
    }

    if (node.type === 'FUNCTION_CALL') {
      const argVals: number[] = [];
      for (const a of node.args) {
        if (a.type === 'CELL_RANGE') {
          const cells = this.expandRange(a.value);
          for (const c of cells) {
            const val = this.evaluateCell(c);
            const num = Number(val);
            if (!isNaN(num)) argVals.push(num);
          }
        } else {
          argVals.push(this.visitNode(a));
        }
      }

      if (node.name === 'SUM') {
        return argVals.reduce((acc, curr) => acc + curr, 0);
      }
      if (node.name === 'AVG' || node.name === 'AVERAGE') {
        if (argVals.length === 0) return 0;
        return argVals.reduce((acc, curr) => acc + curr, 0) / argVals.length;
      }
      if (node.name === 'COUNT') {
        return argVals.length;
      }
    }

    throw new Error('Unknown AST node');
  }

  public getDependencies(formula: string): string[] {
    const lexer = new Lexer(formula);
    const parser = new Parser(lexer);
    try {
      const ast = parser.parse();
      const deps = new Set<string>();
      this.extractDependencies(ast, deps);
      return Array.from(deps);
    } catch {
      return [];
    }
  }

  private extractDependencies(node: ASTNode, deps: Set<string>) {
    if (node.type === 'CELL_REF') {
      deps.add(node.value);
    } else if (node.type === 'CELL_RANGE') {
      const cells = this.expandRange(node.value);
      cells.forEach(c => deps.add(c));
    } else if (node.type === 'BINARY_OP') {
      this.extractDependencies(node.left, deps);
      this.extractDependencies(node.right, deps);
    } else if (node.type === 'FUNCTION_CALL') {
      node.args.forEach(arg => this.extractDependencies(arg, deps));
    }
  }
}

/**
 * Builds a dependency graph and topologically sorts the cells for selective evaluation.
 */
export const buildDependencyGraph = (cells: CellsMap) => {
  const graph: Record<string, string[]> = {};
  const inDegree: Record<string, number> = {};
  
  // Initialize
  Object.keys(cells).forEach(cellId => {
    graph[cellId] = [];
    inDegree[cellId] = 0;
  });

  const evaluator = new Evaluator(cells);

  // Build edges
  Object.keys(cells).forEach(cellId => {
    const data = cells[cellId];
    if (data && data.value.startsWith('=')) {
      const deps = evaluator.getDependencies(data.value.substring(1));
      deps.forEach(dep => {
        if (!graph[dep]) {
          graph[dep] = [];
          inDegree[dep] = 0;
        }
        graph[dep].push(cellId);
        inDegree[cellId] = (inDegree[cellId] || 0) + 1;
      });
    }
  });

  return { graph, inDegree };
};

export const evaluateCells = (cells: CellsMap): CellsMap => {
  const evaluatedCells: CellsMap = { ...cells };
  
  const cache: Record<string, number | string> = {};
  const evaluator = new Evaluator(cells, cache);
  
  for (const cellId of Object.keys(cells)) {
    const computedVal = evaluator.evaluateCell(cellId);
    
    let finalVal = computedVal;
    if (computedVal === '#ERR!' || (typeof computedVal === 'number' && isNaN(computedVal))) {
      finalVal = '#VALUE!';
    }
    
    evaluatedCells[cellId] = {
      ...cells[cellId],
      computedValue: finalVal
    };
  }

  return evaluatedCells;
};

export const evaluateChangedCells = (cells: CellsMap, changedCellIds: string[]): CellsMap => {
  const evaluatedCells: CellsMap = { ...cells };
  const { graph } = buildDependencyGraph(cells);
  
  const affected = new Set<string>();
  const queue = [...changedCellIds];
  
  while (queue.length > 0) {
    const curr = queue.shift()!;
    affected.add(curr);
    const dependents = graph[curr] || [];
    for (const dep of dependents) {
      if (!affected.has(dep)) {
        queue.push(dep);
      }
    }
  }

  // Pre-fill cache with known computedValues for unaffected cells
  const cache: Record<string, number | string> = {};
  for (const cellId of Object.keys(cells)) {
    if (!affected.has(cellId)) {
      if (cells[cellId]?.computedValue !== undefined) {
         cache[cellId] = cells[cellId].computedValue as string | number;
      }
    }
  }

  const evaluator = new Evaluator(cells, cache);
  
  // Re-evaluate affected cells
  for (const cellId of affected) {
    const computedVal = evaluator.evaluateCell(cellId);
    let finalVal = computedVal;
    if (computedVal === '#ERR!' || (typeof computedVal === 'number' && isNaN(computedVal))) {
      finalVal = '#VALUE!';
    }
    evaluatedCells[cellId] = {
      ...cells[cellId],
      computedValue: finalVal
    };
  }

  return evaluatedCells;
};

// ==========================================
// DRAG AND DROP UTILITIES
// ==========================================

export const colIndexToLetter = (index: number): string => {
  let temp = index;
  let letter = '';
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
};

export const letterToColIndex = (letter: string): number => {
  let index = 0;
  for (let i = 0; i < letter.length; i++) {
    index = index * 26 + (letter.charCodeAt(i) - 64);
  }
  return index - 1;
};

/**
 * Calculates a new coordinate index given an old index, 
 * the index of the item that was dragged, and where it was dropped.
 */
export const getShiftedIndex = (currentIndex: number, fromIndex: number, toIndex: number): number => {
  if (currentIndex === fromIndex) {
    return toIndex; // The item itself moved
  }
  
  if (fromIndex < toIndex) {
    // Moved down/right: Items between from and to shift up/left (-1)
    if (currentIndex > fromIndex && currentIndex <= toIndex) {
      return currentIndex - 1;
    }
  } else if (fromIndex > toIndex) {
    // Moved up/left: Items between to and from shift down/right (+1)
    if (currentIndex >= toIndex && currentIndex < fromIndex) {
      return currentIndex + 1;
    }
  }
  
  return currentIndex; // Unaffected
};

/**
 * Scans a formula string and shifts all matching cell references
 * according to the from/to indices. Preserves exact formula text (casing, spaces).
 */
export const shiftFormula = (formula: string, type: 'col' | 'row', fromIdx: number, toIdx: number): string => {
  if (!formula.startsWith('=')) return formula;

  // Regex matches A1, AB12, A1:B5 but attempts to capture pieces
  // Matches: 1 = Col (A-Z), 2 = Row (1-999)
  const cellRefRegex = /([A-Z]+)(\d+)/gi;

  return formula.replace(cellRefRegex, (match, colStr, rowStr) => {
    let colIndex = letterToColIndex(colStr.toUpperCase());
    let rowIndex = parseInt(rowStr, 10) - 1; // 0-indexed

    if (type === 'col') {
      const newColIndex = getShiftedIndex(colIndex, fromIdx, toIdx);
      return `${colIndexToLetter(newColIndex)}${rowIndex + 1}`;
    } else {
      const newRowIndex = getShiftedIndex(rowIndex, fromIdx, toIdx);
      return `${colStr.toUpperCase()}${newRowIndex + 1}`;
    }
  });
};

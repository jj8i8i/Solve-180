// --- The Definitive Solver ---
onmessage = function(e) {
    try {
        const { numbers, target, level } = e.data;
        const solver = new Solver(numbers, target, level);
        const result = solver.solve();
        postMessage({ result });
    } catch (error) {
        console.error("Critical Error in Solver Worker:", error);
        postMessage({ result: { solutions: [], closest: { value: Infinity } } });
    }
};

class Solver {
    constructor(numbers, target, level) {
        this.initialNumbers = numbers; this.target = target; this.level = level;
        this.solutions = []; this.closest = { value: Infinity, str: '', complexity: Infinity, derivation: null };
    }

    solve() {
        const initialItems = this.initialNumbers.map(n => ({ value: n, str: n.toString(), complexity: 0, derivation: null }));
        
        postMessage({ status: 'กำลังลองวิธีพื้นฐาน (+ - × ÷)...' });
        this.runPhase(initialItems, ['B'], 3000);
        if (this.solutions.length > 0) return this.formatResults();

        if (this.level >= 1) {
            postMessage({ status: 'กำลังลองวิธีขั้นสูง (ยกกำลัง, ราก)...' });
            this.runPhase(initialItems, ['B', '1', '2'], 7000, true); // `true` to continue building on previous results
            if (this.solutions.length > 0) return this.formatResults();
        }
        
        if (this.level >= 3) {
            postMessage({ status: 'กำลังทุ่มสุดตัว (แฟคทอเรียล, ซิกม่า)...' });
            this.runPhase(initialItems, ['B', '1', '2', '3'], 10000, true);
        }

        return this.formatResults();
    }

    runPhase(initialItems, allowedLevels, timeout, isContinuation = false) {
        const queue = [initialItems];
        const memo = isContinuation ? this.memo : new Map();
        const startTime = Date.now();
        
        const key = initialItems.map(it => this.formatNumber(it.value)).sort().join('|');
        memo.set(key, true);

        while (queue.length > 0) {
            if (Date.now() - startTime > timeout) { console.log('Phase timed out.'); break; }
            
            const currentItems = queue.shift();
            
            const nextMoves = [
                ...this.generateUnaryMoves(currentItems, allowedLevels),
                ...this.generateBinaryMoves(currentItems, allowedLevels),
                ...this.generateSigmaMoves(currentItems, allowedLevels)
            ];

            for (const move of nextMoves) {
                if (move.length === 1) {
                    const item = move[0];
                    if (Math.abs(item.value - this.target) < 0.0001) this.solutions.push(item);
                    else if (item.value % 1 === 0) {
                        if (Math.abs(item.value - this.target) < Math.abs(this.closest.value - this.target)) this.closest = item;
                        else if (Math.abs(item.value - this.target) === Math.abs(this.closest.value - this.target) && item.complexity < this.closest.complexity) this.closest = item;
                    }
                }

                const moveKey = move.map(it => this.formatNumber(it.value)).sort().join('|');
                if (!memo.has(moveKey)) {
                    memo.set(moveKey, true);
                    queue.push(move);
                }
            }
        }
        this.memo = memo;
    }
    
    formatResults() {
        this.solutions.sort((a, b) => a.complexity - b.complexity);
        return { solutions: this.solutions, closest: this.closest };
    }

    generateUnaryMoves(items, levels) {
        const moves = [];
        if (levels.includes('2')) {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.value > 0) {
                    const remaining = items.filter((_, idx) => idx !== i);
                    const sqrtVal = Math.sqrt(item.value);
                    moves.push([...remaining, { value: sqrtVal, str: `\\sqrt{${item.str}}`, complexity: item.complexity + 5, derivation: { op: '√', inputs: [item], resultStr: `${this.formatNumber(sqrtVal)}` } }]);
                }
            }
        }
        if (levels.includes('3')) {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.value >= 0 && item.value <= 10 && item.value % 1 === 0) {
                     const remaining = items.filter((_, idx) => idx !== i);
                     const factVal = this.factorial(item.value);
                     moves.push([...remaining, { value: factVal, str: `(${item.str})!`, complexity: item.complexity + 8, derivation: { op: '!', inputs: [item], resultStr: `${this.formatNumber(factVal)}` } }]);
                }
            }
        }
        return moves;
    }

    generateBinaryMoves(items, levels) {
        const moves = [];
        for (let i = 0; i < items.length; i++) {
            for (let j = i + 1; j < items.length; j++) {
                const remaining = items.filter((_, idx) => idx !== i && idx !== j);
                if(levels.includes('B')) {
                    moves.push(...this.tryOp(items[i], items[j], '+', remaining, true));
                    moves.push(...this.tryOp(items[i], items[j], '*', remaining, true));
                    moves.push(...this.tryOp(items[i], items[j], '-', remaining, false));
                    moves.push(...this.tryOp(items[j], items[i], '-', remaining, false));
                    moves.push(...this.tryOp(items[i], items[j], '/', remaining, false));
                    moves.push(...this.tryOp(items[j], items[i], '/', remaining, false));
                }
                if(levels.includes('1')) {
                    moves.push(...this.tryOp(items[i], items[j], '^', remaining, false));
                    moves.push(...this.tryOp(items[j], items[i], '^', remaining, false));
                }
                if(levels.includes('2')) {
                    moves.push(...this.tryOp(items[i], items[j], 'root', remaining, false));
                    moves.push(...this.tryOp(items[j], items[i], 'root', remaining, false));
                }
            }
        }
        return moves;
    }
    
    tryOp(a, b, op, remaining, isCommutative = false) {
        if (isCommutative && a.str > b.str) [a, b] = [b, a];
        let value, str, complexity;
        switch (op) {
            case '+': value = a.value + b.value; str = `(${a.str}+${b.str})`; complexity = a.complexity + b.complexity + 1; break;
            case '-': if (a.value < b.value) return []; value = a.value - b.value; str = `(${a.str}-${b.str})`; complexity = a.complexity + b.complexity + 1.1; break;
            case '*': if (a.value === 1 || b.value === 1) return []; value = a.value * b.value; str = `${this.addParen(a, '*')}*${this.addParen(b, '*')}`; complexity = a.complexity + b.complexity + 1.2; break;
            case '/': if (b.value === 0 || b.value === 1) return []; value = a.value / b.value; str = `\\frac{${a.str}}{${b.str}}`; complexity = a.complexity + b.complexity + 1.5; break;
            case '^': if (b.value === 1 || Math.abs(b.value) > 10 || Math.abs(a.value) > 20) return []; value = Math.pow(a.value, b.value); str = `{${this.addParen(a, '^')}}^{${b.str}}`; complexity = a.complexity + b.complexity + 4; break;
            case 'root': if (b.value <= 1 || b.value > 10 || a.value < 0) return []; value = Math.pow(a.value, 1/b.value); str = `\\sqrt[${b.str}]{${a.str}}`; complexity = a.complexity + b.complexity + 5; break;
            default: return [];
        }
        if (!isFinite(value) || (value % 1 !== 0 && remaining.every(item => item.value % 1 === 0) && !this.level.includes('2'))) return [];
        const derivation = { op, inputs: [a, b], resultStr: this.formatNumber(value) };
        return [[...remaining, { value, str, complexity, derivation }]];
    }

    generateSigmaMoves(items, levels) {
        if (!levels.includes('3') || items.length < 2) return [];
        const moves = [];
        for (let i = 0; i < items.length; i++) {
            for (let j = i + 1; j < items.length; j++) {
                const sBound = items[i], eBound = items[j];
                const remaining = items.filter((_, idx) => idx !== i && idx !== j);
                const start = Math.round(Math.min(sBound.value, eBound.value)), end = Math.round(Math.max(sBound.value, eBound.value));
                if (start <= 0 || end > 10 || end - start > 8) continue;
                const strI = sBound.value < eBound.value ? sBound.str : eBound.str; const strEnd = sBound.value < eBound.value ? eBound.str : sBound.str;
                const simplePatterns = [{ p: 'i', s: 'i', c: 15 }, { p: 'i*i', s: 'i \\times i', c: 16 }, { p: 'i!', s: 'i!', c: 18 }];
                for (const pat of simplePatterns) {
                    const sigmaResult = this.calculateSigma(start, end, pat.p);
                    if (sigmaResult === null || !isFinite(sigmaResult)) continue;
                    const newItem = { value: sigmaResult, str: `\\sum_{i=${strI}}^{${strEnd}} ${pat.s}`, complexity: sBound.complexity + eBound.complexity + pat.c, derivation: { op: 'Σ', inputs: [sBound, eBound], resultStr: `${this.formatNumber(sigmaResult)}` } };
                    moves.push([...remaining, newItem]);
                }
            }
        }
        return moves;
    }
    
    factorial = (n) => (n <= 1 ? 1 : n * this.factorial(n - 1));
    formatNumber = (n) => parseFloat(n.toFixed(3).replace(/\.?0+$/, ""));
    addParen = (item, op) => {
        if (!item.derivation) return item.str;
        const opMap = {'+':0, '-':0, '*':1, '/':1, '^':2, 'root':2 }; const currentOpPrec = opMap[op];
        const itemOpPrec = opMap[item.derivation.op] ?? 3; if (itemOpPrec < currentOpPrec) return `(${item.str})`; return item.str;
    };
    calculateSigma(start, end, pattern) {
        let sum = 0;
        for (let i = start; i <= end; i++) {
            let term;
            switch(pattern) {
                case 'i': term = i; break; case 'i*i': term = i * i; break;
                case 'i!': if (i > 8) return null; term = this.factorial(i); break;
                default: return null;
            }
            if (!isFinite(term)) return null; sum += term;
        }
        return sum;
    }
}

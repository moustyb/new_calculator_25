// Science Calculator — Safe parser mapping to Math
(() => {
  const exprInput = document.getElementById('expression');
  const resultDiv = document.getElementById('result');
  const toast = document.querySelector('.toast');
  const keypad = document.querySelector('.keypad');

  let memory = null;

  // Live evaluation on input change
  exprInput.addEventListener('input', () => {
    updateLiveResult(exprInput.value);
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      evaluate();
      e.preventDefault();
    } else if (e.key === 'Backspace') {
      // default behavior is fine
    }
  });

  // Click handling for buttons
  keypad.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const key = btn.getAttribute('data-key');
    const action = btn.getAttribute('data-action');

    if (key) {
      if (key === 'pi') insert('π');
      else if (key === 'e') insert('e');
      else insert(key);
      exprInput.focus();
      updateLiveResult(exprInput.value);
      return;
    }

    if (action) {
      switch (action) {
        case 'equals':
          evaluate();
          break;
        case 'clear':
          exprInput.value = '';
          updateLiveResult('');
          hideToast();
          break;
        case 'backspace':
          exprInput.value = exprInput.value.slice(0, -1);
          updateLiveResult(exprInput.value);
          break;
        case 'ms':
          memory = evaluateSilent(exprInput.value);
          if (memory != null) showToast(`Stored: ${memory}`);
          else showToast('Nothing to store. Enter a valid expression.');
          break;
        case 'mr':
          if (memory == null) showToast('Memory is empty.');
          else insert(String(memory));
          break;
      }
    }
  });

  function insert(text) {
    const start = exprInput.selectionStart;
    const end = exprInput.selectionEnd;
    const before = exprInput.value.slice(0, start);
    const after = exprInput.value.slice(end);
    exprInput.value = before + text + after;
    const caret = start + text.length;
    exprInput.setSelectionRange(caret, caret);
    updateLiveResult(exprInput.value);
  }

  function updateLiveResult(raw) {
    const val = evaluateSilent(raw);
    if (val == null || Number.isNaN(val)) {
      resultDiv.textContent = '= …';
    } else {
      resultDiv.textContent = '= ' + formatNumber(val);
    }
  }

  function evaluate() {
    const val = evaluateSilent(exprInput.value);
    if (val == null || Number.isNaN(val)) {
      showToast('Invalid expression.');
      exprInput.classList.remove('success-pulse');
      return;
    }
    exprInput.value = String(val);
    exprInput.classList.add('success-pulse');
    setTimeout(() => exprInput.classList.remove('success-pulse'), 500);
    updateLiveResult(exprInput.value);
    hideToast();
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.hidden = false;
  }
  function hideToast() {
    toast.hidden = true;
    toast.textContent = '';
  }

  // Formatting to avoid long floats
  function formatNumber(n) {
    const abs = Math.abs(n);
    if (abs !== 0 && (abs < 1e-6 || abs > 1e9)) {
      return n.toExponential(6);
    }
    return Number.isInteger(n) ? n.toString() : n.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  }

  // Safe evaluator: tokenize and map to Math
  function evaluateSilent(raw) {
    if (!raw || !raw.trim()) return null;
    try {
      const expr = normalize(raw);
      // Disallow letters outside known functions/constants
      if (/([A-Za-z_]+)/.test(expr.replace(/(sin|cos|tan|log|ln|sqrt|pi|e)/g, ''))) {
        return null;
      }
      const output = compute(expr);
      return output;
    } catch {
      return null;
    }
  }

  // Normalize to internal tokens
  function normalize(s) {
    return s
      .replace(/\s+/g, '')
      .replace(/π/g, 'pi')
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-')
      .replace(/\^/g, '^');
  }

  // Parse and compute using shunting-yard + RPN
  function compute(expr) {
    // Tokenize numbers, operators, parentheses, functions, constants
    const tokens = [];
    for (let i = 0; i < expr.length;) {
      const ch = expr[i];

      // Numbers
      if (/[0-9.]/.test(ch)) {
        let num = ch; i++;
        while (i < expr.length && /[0-9.]/.test(expr[i])) num += expr[i++];
        tokens.push({ type: 'num', value: parseFloat(num) });
        continue;
      }

      // Constants
      if (expr.startsWith('pi', i)) { tokens.push({ type: 'num', value: Math.PI }); i += 2; continue; }
      if (expr.startsWith('e', i)) {
        // Avoid matching exponent part of numbers; only standalone 'e'
        // If previous token is a number and next char is +/- digit, treat as part of scientific notation
        const prev = tokens[tokens.length - 1];
        const next = expr[i + 1];
        if (prev && prev.type === 'num' && (next === '+' || next === '-') && /[0-9.]/.test(expr[i + 2])) {
          // fall through to operator
        } else {
          tokens.push({ type: 'num', value: Math.E }); i += 1; continue;
        }
      }

      // Functions
      const funcs = ['sin', 'cos', 'tan', 'log', 'ln', 'sqrt'];
      let matchedFunc = null;
      for (const f of funcs) {
        if (expr.startsWith(f, i)) { matchedFunc = f; break; }
      }
      if (matchedFunc) {
        tokens.push({ type: 'func', value: matchedFunc });
        i += matchedFunc.length;
        continue;
      }

      // Operators and parentheses
      if ('+-*/^()'.includes(ch)) {
        tokens.push({ type: 'op', value: ch });
        i++;
        continue;
      }

      // Scientific notation (e.g., 1e-6) handled by collapsing tokens:
      if (ch === 'e') {
        tokens.push({ type: 'op', value: 'e' }); // placeholder
        i++;
        continue;
      }

      // Unknown token
      throw new Error('Unknown token');
    }

    // Merge scientific notation like [num][e][+/-][num]
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type === 'num' && tokens[i + 1]?.value === 'e' && tokens[i + 2]?.type === 'op' && ['+','-'].includes(tokens[i + 2].value) && tokens[i + 3]?.type === 'num') {
        const base = tokens[i].value;
        const sign = tokens[i + 2].value === '-' ? -1 : 1;
        const exp = sign * tokens[i + 3].value;
        tokens.splice(i, 4, { type: 'num', value: base * Math.pow(10, exp) });
      }
    }

    // Shunting-yard to RPN
    const out = [];
    const stack = [];
    const prec = { '+':1, '-':1, '*':2, '/':2, '^':3 };
    const rightAssoc = { '^': true };

    for (let t of tokens) {
      if (t.type === 'num') out.push(t);
      else if (t.type === 'func') stack.push(t);
      else if (t.type === 'op' && t.value === '(') stack.push(t);
      else if (t.type === 'op' && t.value === ')') {
        while (stack.length && stack[stack.length - 1].value !== '(') out.push(stack.pop());
        if (!stack.length) throw new Error('Mismatched parentheses');
        stack.pop(); // remove '('
        // if function on stack, pop it too
        if (stack.length && stack[stack.length - 1].type === 'func') out.push(stack.pop());
      } else if (t.type === 'op') {
        while (stack.length) {
          const top = stack[stack.length - 1];
          if (top.type === 'func') { out.push(stack.pop()); continue; }
          if (top.type === 'op' && top.value !== '(' &&
              (prec[top.value] > prec[t.value] || (prec[top.value] === prec[t.value] && !rightAssoc[t.value]))) {
            out.push(stack.pop());
          } else break;
        }
        stack.push(t);
      }
    }
    while (stack.length) {
      const top = stack.pop();
      if (top.value === '(') throw new Error('Mismatched parentheses');
      out.push(top);
    }

    // Evaluate RPN
    const st = [];
    for (let t of out) {
      if (t.type === 'num') st.push(t.value);
      else if (t.type === 'func') {
        const a = st.pop();
        if (a == null) throw new Error('Invalid function application');
        st.push(applyFunc(t.value, a));
      } else if (t.type === 'op') {
        const b = st.pop();
        const a = st.pop();
        if (a == null || b == null) throw new Error('Invalid operation');
        st.push(applyOp(t.value, a, b));
      }
    }
    if (st.length !== 1) throw new Error('Invalid expression');
    return st[0];
  }

  function applyFunc(name, x) {
    // trig use degrees for UX; switch to radians internally
    const toRad = (deg) => deg * Math.PI / 180;
    switch (name) {
      case 'sin': return Math.sin(toRad(x));
      case 'cos': return Math.cos(toRad(x));
      case 'tan': return Math.tan(toRad(x));
      case 'log': return Math.log10(x);
      case 'ln':  return Math.log(x);
      case 'sqrt': return Math.sqrt(x);
      default: throw new Error('Unknown function');
    }
  }

  function applyOp(op, a, b) {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return a / b;
      case '^': return Math.pow(a, b);
      default: throw new Error('Unknown operator');
    }
  }
})();

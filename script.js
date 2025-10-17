const exprInput = document.getElementById("expression");
const keypad = document.querySelector(".keypad");

keypad.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const key = btn.dataset.key;
  const action = btn.dataset.action;

  if (key) {
    if (key === "pi") {
      exprInput.value += "Math.PI";
    } else if (["sin(", "cos(", "tan(", "log(", "ln(", "sqrt("].includes(key)) {
      if (key === "ln(") {
        exprInput.value += "Math.log(";
      } else if (key === "log(") {
        exprInput.value += "Math.log10(";
      } else {
        exprInput.value += "Math." + key;
      }
    } else if (key === "^") {
      exprInput.value += "**";
    } else {
      exprInput.value += key;
    }
  } else if (action) {
    switch (action) {
      case "clear":
        exprInput.value = "";
        break;
      case "backspace":
        exprInput.value = exprInput.value.slice(0, -1);
        break;
      case "equals":
        let expr = exprInput.value.trim();
        if (!expr) {
          exprInput.value = "0";
          break;
        }
        try {
          // Evaluate the expression safely
          const result = new Function("return " + expr)();
          exprInput.value = isNaN(result) || !isFinite(result) ? "Error" : result;
        } catch (error) {
          exprInput.value = "Error";
        }
        break;
    }
  }
});

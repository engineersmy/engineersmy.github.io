// Scrambles a Rust snippet into its Ruby equivalent and back, one character at a time.
(() => {
  const root = document.querySelector("[data-morph]");
  if (!root) return;

  const out = root.querySelector("code");
  const file = root.querySelector(".morph-file");
  const toggle = root.querySelector(".morph-toggle");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // Line N of one language morphs into line N of the other, so keep them aligned
  const SOURCES = {
    rust: {
      file: "main.rs",
      lines: [
        "fn greet(name: &str) -> String {",
        '    format!("Selamat datang, {name}!")',
        "}",
        "",
        "fn main() {",
        '    let crew = ["rustacean", "rubyist"];',
        "    for who in crew {",
        '        println!("{}", greet(who));',
        "    }",
        "}",
      ],
    },
    ruby: {
      file: "main.rb",
      lines: [
        "def greet(name)",
        '  "Selamat datang, #{name}!"',
        "end",
        "",
        "# no main() needed",
        "crew = %w[rustacean rubyist]",
        "crew.each do |who|",
        "  puts greet(who)",
        "end",
        "",
      ],
    },
  };

  const RULES = {
    rust: [
      ["com", /\/\/.*/y],
      ["str", /"(?:[^"\\]|\\.)*"/y],
      ["mac", /[a-z_]\w*!/y],
      ["kw", /\b(?:fn|let|for|in|mut|return)\b/y],
      ["ty", /\b(?:[A-Z]\w*|str)\b/y],
      ["fn", /[a-z_]\w*(?=\()/y],
      ["pun", /[{}()[\];,&<>=:-]+/y],
    ],
    ruby: [
      ["str", /"(?:[^"\\]|\\.)*"|%w\[[^\]]*\]/y],
      ["com", /#.*/y],
      ["kw", /\b(?:def|end|do)\b/y],
      ["fn", /\b(?:puts|each)\b|[a-z_]\w*(?=\()/y],
      ["pun", /[()[\]|.,=]+/y],
    ],
  };

  const GLYPHS = "!<>-_\\/[]{}=+*^?#&|~01";
  const HOLD_MS = 3200;
  const REDUCED_HOLD_MS = 5000;

  // One highlight class per character, so a half-morphed line can mix both languages
  function classify(line, lang) {
    const classes = new Array(line.length).fill("");
    const word = /\w+/y;
    let i = 0;
    outer: while (i < line.length) {
      for (const [cls, re] of RULES[lang]) {
        re.lastIndex = i;
        const m = re.exec(line);
        if (m && m[0].length) {
          classes.fill(cls, i, i + m[0].length);
          i += m[0].length;
          continue outer;
        }
      }
      word.lastIndex = i;
      const m = word.exec(line);
      i += m ? m[0].length : 1;
    }
    return classes;
  }

  const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function renderLine(chars, classes) {
    let html = "";
    let run = "";
    let runCls = null;
    const flush = () => {
      if (!run) return;
      html += runCls ? `<span class="t-${runCls}">${escape(run)}</span>` : escape(run);
      run = "";
    };
    for (let k = 0; k < chars.length; k++) {
      if (classes[k] !== runCls) {
        flush();
        runCls = classes[k];
      }
      run += chars[k];
    }
    flush();
    // A trailing empty line in <pre> collapses, which would shrink the card by a row
    return html || " ";
  }

  const highlighted = {};
  for (const lang of Object.keys(SOURCES)) {
    highlighted[lang] = SOURCES[lang].lines
      .map((line) => renderLine([...line], classify(line, lang)))
      .join("\n");
  }

  // Precompute when each character starts scrambling and when it settles
  function makePlan(from, to) {
    let duration = 0;
    const lines = SOURCES[from].lines.map((a, row) => {
      const b = SOURCES[to].lines[row];
      const aCls = classify(a, from);
      const bCls = classify(b, to);
      const cells = [];
      for (let k = 0; k < Math.max(a.length, b.length); k++) {
        const oldCh = a[k] ?? " ";
        const newCh = b[k] ?? " ";
        const start = row * 70 + Math.random() * 450;
        const end = oldCh === newCh ? start : start + 120 + Math.random() * 380;
        duration = Math.max(duration, end);
        cells.push({ oldCh, newCh, oldCls: aCls[k] ?? "", newCls: bCls[k] ?? "", start, end });
      }
      return cells;
    });
    return { to, lines, duration };
  }

  function renderPlan(plan, t) {
    out.innerHTML = plan.lines
      .map((cells) => {
        const chars = [];
        const classes = [];
        for (const c of cells) {
          if (t < c.start) {
            chars.push(c.oldCh);
            classes.push(c.oldCls);
          } else if (t < c.end) {
            chars.push(GLYPHS[(Math.random() * GLYPHS.length) | 0]);
            classes.push("glitch");
          } else {
            chars.push(c.newCh);
            classes.push(c.newCls);
          }
        }
        return renderLine(chars, classes);
      })
      .join("\n");
  }

  let lang = "rust";
  let phase = "hold";
  let elapsed = 0;
  let plan = null;
  let last = null;
  let raf = 0;
  let paused = false;
  let visible = false;

  const other = (l) => (l === "rust" ? "ruby" : "rust");

  function setLang(l) {
    root.dataset.lang = l;
    file.textContent = SOURCES[l].file;
  }

  function frame(now) {
    const dt = last === null ? 0 : Math.min(now - last, 100);
    last = now;
    elapsed += dt;

    const hold = reduceMotion.matches ? REDUCED_HOLD_MS : HOLD_MS;
    if (phase === "hold" && elapsed >= hold) {
      const to = other(lang);
      plan = reduceMotion.matches ? { to, duration: 0 } : makePlan(lang, to);
      phase = "morph";
      elapsed = 0;
      setLang(to);
    }
    if (phase === "morph") {
      if (elapsed >= plan.duration) {
        lang = plan.to;
        out.innerHTML = highlighted[lang];
        phase = "hold";
        elapsed = 0;
      } else {
        renderPlan(plan, elapsed);
      }
    }
    raf = requestAnimationFrame(frame);
  }

  function sync() {
    const run = visible && !paused && !document.hidden;
    if (run && !raf) {
      last = null;
      raf = requestAnimationFrame(frame);
    } else if (!run && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  toggle.addEventListener("click", () => {
    paused = !paused;
    toggle.setAttribute("aria-pressed", String(paused));
    toggle.setAttribute("aria-label", paused ? "Play code animation" : "Pause code animation");
    sync();
  });

  document.addEventListener("visibilitychange", sync);

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  }).observe(root);

  setLang(lang);
  out.innerHTML = highlighted[lang];
  toggle.hidden = false;
})();

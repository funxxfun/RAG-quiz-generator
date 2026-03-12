import { useState, useCallback } from "react";

interface QuizItem {
  type: "まるばつ" | "4択" | "穴埋め";
  q: string;
  a: string;
  hint: string;
  choices?: string[];
}

interface SourceItem {
  url: string;
  title: string;
  chars: number;
}

const TYPE_COLOR: Record<string, [string, string]> = {
  "まるばつ": ["#43E97B", "#38F9D7"],
  "4択":      ["#667eea", "#764ba2"],
  "穴埋め":   ["#4FACFE", "#00F2FE"],
};

export default function App() {
  const [manualText, setManualText] = useState("");
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [context, setContext] = useState("");
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState("");
  const [count, setCount] = useState(10);
  const [currentIdx, setCurrentIdx] = useState<number | null>(null);
  const [userAnswer, setUserAnswer] = useState("");
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [phase, setPhase] = useState<"home" | "quiz">("home");
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);

  const addManualText = useCallback(() => {
    if (!manualText.trim() || manualText.trim().length < 50) return;
    const title = `テキスト ${sources.length + 1}`;
    const text = manualText.trim().slice(0, 6000);
    setSources(s => [...s, { url: "(貼り付け)", title, chars: text.length }]);
    setContext(c => c + `\n\n## ${title}\n${text}`);
    setStatus(`✅ テキストを追加しました：${text.length}文字`);
    setManualText("");
  }, [manualText, sources.length]);

  const generateQuiz = useCallback(async () => {
    if (!context.trim()) return;
    setGenerating(true);
    setStatus("AIがクイズを生成中...");
    try {
      const prompt = `以下のテキスト情報をもとに、${count}問のクイズを作成してください。

【情報源】
${context.slice(0, 8000)}

【出力形式】
必ずJSON配列のみを出力し、説明文やmarkdownコードブロックは不要です。
各問題は以下の形式：
[
  {
    "type": "まるばつ" | "4択" | "穴埋め",
    "q": "問題文",
    "a": "正解",
    "hint": "解説（50字程度）",
    "choices": ["A: 選択肢1", "B: 選択肢2", "C: 選択肢3", "D: 選択肢4"]
  }
]

【ルール】
- まるばつ：aは"〇"または"✗"
- 4択：aは"A"〜"D"、choicesは必須
- 穴埋め：問題文に"___"を入れる、aは答えの単語
- 3種類をバランスよく（まるばつ4割・4択4割・穴埋め2割）
- テキストの内容に忠実に、重要な知識を問う問題を作成
- 日本語で作成`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          messages: [{ role: "user", content: prompt }]
        })
      });
      const data = await res.json();
      const raw = data.content?.find((c: { type: string }) => c.type === "text")?.text || "";
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed: QuizItem[] = JSON.parse(clean);
      setQuizzes(q => [...q, ...parsed]);
      setStatus(`✅ ${parsed.length}問のクイズを生成しました！`);
    } catch (e) {
      setStatus("❌ 生成失敗：" + String(e));
    }
    setGenerating(false);
  }, [context, count]);

  const startQuiz = () => {
    if (quizzes.length === 0) return;
    setCurrentIdx(0);
    setUserAnswer("");
    setResult(null);
    setScore(0);
    setAnswered(0);
    setPhase("quiz");
  };

  const submitAnswer = (ans: string) => {
    if (currentIdx === null) return;
    const q = quizzes[currentIdx];
    const ok = ans.trim().toLowerCase() === q.a.toLowerCase() ||
      (q.a === "〇" && ["o","○","まる"].includes(ans.toLowerCase())) ||
      (q.a === "✗" && ["x","×","ばつ"].includes(ans.toLowerCase()));
    setUserAnswer(ans);
    setResult(ok ? "correct" : "wrong");
    setAnswered(n => n + 1);
    if (ok) setScore(n => n + 1);
  };

  const nextQ = () => {
    if (currentIdx === null) return;
    if (currentIdx + 1 >= quizzes.length) {
      setPhase("home");
      setCurrentIdx(null);
    } else {
      setCurrentIdx(currentIdx + 1);
      setUserAnswer("");
      setResult(null);
    }
  };

  const clearAll = () => {
    setSources([]); setContext(""); setQuizzes([]);
    setStatus(""); setPhase("home"); setCurrentIdx(null);
  };

  const cur = currentIdx !== null ? quizzes[currentIdx] : null;
  const [c1, c2] = cur ? (TYPE_COLOR[cur.type] || ["#4FACFE","#00F2FE"]) : ["#4FACFE","#00F2FE"];

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(160deg,#0F2027,#203A43,#2C5364)", display:"flex", flexDirection:"column", alignItems:"center", padding:"24px 16px", fontFamily:"'Segoe UI',sans-serif", boxSizing:"border-box" }}>

      <div style={{ textAlign:"center", marginBottom:20 }}>
        <div style={{ fontSize:36 }}>🧠</div>
        <h1 style={{ fontSize:20, fontWeight:900, margin:"4px 0 2px", background:"linear-gradient(90deg,#4FACFE,#43E97B,#FFB347)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>RAGクイズジェネレーター</h1>
        <p style={{ fontSize:11, color:"#6B8899", margin:0 }}>URLを読み込んでAIがオリジナルクイズを自動生成</p>
      </div>

      {phase === "home" && (
        <div style={{ width:"100%", maxWidth:480, display:"flex", flexDirection:"column", gap:14 }}>

          <div style={{ background:"#162533", borderRadius:18, padding:"16px 18px" }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#4FACFE", marginBottom:6 }}>① テキストを貼り付けて取り込む</div>
            <div style={{ fontSize:11, color:"#6B8899", marginBottom:10 }}>ブラウザで対象ページを開き、本文を選択して <kbd style={{background:"#0F1E2A",padding:"1px 6px",borderRadius:4,color:"#4FACFE"}}>Ctrl+C</kbd> → ここに <kbd style={{background:"#0F1E2A",padding:"1px 6px",borderRadius:4,color:"#4FACFE"}}>Ctrl+V</kbd></div>
            <textarea value={manualText} onChange={e => setManualText(e.target.value)}
              placeholder={"ここにテキストを貼り付け…\n\n複数の記事を追加することもできます。"}
              rows={6}
              style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:"2px solid #4FACFE44", background:"#0F1E2A", color:"#E0EAF0", fontSize:12, outline:"none", resize:"vertical", boxSizing:"border-box", lineHeight:1.6 }}/>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:8 }}>
              <span style={{ fontSize:11, color:"#6B8899" }}>{manualText.length} 文字</span>
              <button onClick={addManualText} disabled={manualText.trim().length < 50}
                style={{ padding:"8px 20px", borderRadius:10, border:"none", background: manualText.trim().length < 50 ? "#1e3a4a" : "linear-gradient(90deg,#4FACFE,#00F2FE)", color:"#fff", fontWeight:700, fontSize:13, cursor: manualText.trim().length < 50 ? "default" : "pointer" }}>
                追加する
              </button>
            </div>
            {status && <div style={{ marginTop:8, fontSize:11, color: status.startsWith("✅") ? "#43E97B" : "#FF6B9D" }}>{status}</div>}
          </div>

          {sources.length > 0 && (
            <div style={{ background:"#162533", borderRadius:18, padding:"16px 18px" }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#43E97B", marginBottom:10 }}>📚 取り込み済みソース（{sources.length}件）</div>
              {sources.map((s, i) => (
                <div key={i} style={{ background:"#0F1E2A", borderRadius:10, padding:"8px 12px", marginBottom:6, fontSize:11 }}>
                  <div style={{ color:"#E0EAF0", fontWeight:700, marginBottom:2 }}>{s.title}</div>
                  <div style={{ color:"#6B8899" }}>{s.url.slice(0, 50)}… ｜ {s.chars.toLocaleString()}文字</div>
                </div>
              ))}
            </div>
          )}

          {context && (
            <div style={{ background:"#162533", borderRadius:18, padding:"16px 18px" }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#FFB347", marginBottom:10 }}>② AIでクイズを生成する</div>
              <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:10 }}>
                <span style={{ fontSize:12, color:"#aaa" }}>問題数：</span>
                {[5,10,15,20].map(n => (
                  <button key={n} onClick={() => setCount(n)}
                    style={{ padding:"4px 12px", borderRadius:20, border:"none", fontWeight:700, fontSize:12, cursor:"pointer", background: count===n ? "#FFB347" : "#1e3a4a", color: count===n ? "#fff" : "#6B8899" }}>{n}問</button>
                ))}
              </div>
              <button onClick={generateQuiz} disabled={generating}
                style={{ width:"100%", padding:"11px", borderRadius:12, border:"none", background: generating ? "#1e3a4a" : "linear-gradient(90deg,#FFB347,#f953c6)", color:"#fff", fontWeight:800, fontSize:14, cursor: generating ? "default" : "pointer" }}>
                {generating ? "🤖 生成中…" : "🤖 クイズを生成する"}
              </button>
            </div>
          )}

          {quizzes.length > 0 && (
            <div style={{ background:"#162533", borderRadius:18, padding:"16px 18px" }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#A18CD1", marginBottom:10 }}>③ クイズで学習する</div>
              <div style={{ background:"#0F1E2A", borderRadius:10, padding:"10px 14px", marginBottom:12, fontSize:12, color:"#aaa" }}>
                {quizzes.length}問生成済み ｜
                まるばつ {quizzes.filter(q=>q.type==="まるばつ").length}問 ／
                4択 {quizzes.filter(q=>q.type==="4択").length}問 ／
                穴埋め {quizzes.filter(q=>q.type==="穴埋め").length}問
                {answered > 0 && <span style={{ color:"#43E97B" }}>　｜　前回スコア {score}/{answered}</span>}
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={startQuiz}
                  style={{ flex:2, padding:"11px", borderRadius:12, border:"none", background:"linear-gradient(90deg,#43E97B,#38F9D7)", color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer" }}>
                  ▶ クイズスタート
                </button>
                <button onClick={clearAll}
                  style={{ flex:1, padding:"11px", borderRadius:12, border:"none", background:"#1e3a4a", color:"#6B8899", fontWeight:700, fontSize:13, cursor:"pointer" }}>
                  🗑 リセット
                </button>
              </div>
            </div>
          )}

          {sources.length === 0 && (
            <div style={{ background:"#0F1E2A", borderRadius:14, padding:"14px 16px", fontSize:11, color:"#6B8899", lineHeight:1.9 }}>
              <div style={{ color:"#4FACFE", fontWeight:700, marginBottom:6 }}>📖 使い方</div>
              <div>1️⃣ 学習したいWebページを開いて本文をコピー</div>
              <div>2️⃣ テキストエリアに貼り付けて「追加する」</div>
              <div>3️⃣ 複数記事を重ねて追加することも可能</div>
              <div>4️⃣「クイズを生成する」→「クイズスタート」！</div>
            </div>
          )}
        </div>
      )}

      {phase === "quiz" && cur && (
        <div style={{ width:"100%", maxWidth:460 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <span style={{ fontSize:12, color:"#6B8899" }}>{(currentIdx ?? 0) + 1} / {quizzes.length}問</span>
            <span style={{ fontSize:12, color:"#43E97B" }}>✅ {score}正解</span>
            <button onClick={() => { setPhase("home"); setCurrentIdx(null); }}
              style={{ fontSize:11, color:"#6B8899", background:"none", border:"none", cursor:"pointer" }}>× 終了</button>
          </div>

          <div style={{ background:"#162533", borderRadius:24, overflow:"hidden", boxShadow:"0 8px 40px rgba(0,0,0,0.4)" }}>
            <div style={{ background:`linear-gradient(90deg,${c1},${c2})`, height:5 }}/>
            <div style={{ padding:"20px 20px 18px" }}>
              <div style={{ marginBottom:10 }}>
                <span style={{ fontSize:10, padding:"2px 10px", borderRadius:20, color:"#fff", background:`linear-gradient(90deg,${c1},${c2})`, fontWeight:700 }}>{cur.type}</span>
              </div>
              <div style={{ background:"#0F1E2A", borderRadius:14, padding:"14px 16px", marginBottom:14, fontSize:15, fontWeight:700, color:"#E0EAF0", lineHeight:1.8, borderLeft:`4px solid ${c1}`, whiteSpace:"pre-wrap" }}>
                {cur.q}
              </div>

              {result === null && cur.type === "まるばつ" && (
                <div style={{ display:"flex", gap:10 }}>
                  {["〇","✗"].map(ch => (
                    <button key={ch} onClick={() => submitAnswer(ch)}
                      style={{ flex:1, padding:"14px", borderRadius:12, border:`2px solid ${ch==="〇"?"#43E97B44":"#FF6B9D44"}`, background:"#0F1E2A", color: ch==="〇"?"#43E97B":"#FF6B9D", fontWeight:900, fontSize:28, cursor:"pointer" }}
                      onMouseEnter={e=>(e.currentTarget.style.background="#1a3a4a")}
                      onMouseLeave={e=>(e.currentTarget.style.background="#0F1E2A")}>
                      {ch}
                    </button>
                  ))}
                </div>
              )}

              {result === null && cur.type === "4択" && cur.choices && (
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {cur.choices.map((ch, i) => {
                    const key = ["A","B","C","D"][i];
                    return (
                      <button key={key} onClick={() => submitAnswer(key)}
                        style={{ padding:"10px 14px", borderRadius:12, border:`2px solid ${c1}44`, background:"#0F1E2A", color:"#E0EAF0", fontWeight:700, fontSize:13, cursor:"pointer", textAlign:"left" }}
                        onMouseEnter={e=>(e.currentTarget.style.background="#1a3a4a")}
                        onMouseLeave={e=>(e.currentTarget.style.background="#0F1E2A")}>
                        <span style={{ color:c1, marginRight:8, fontFamily:"monospace" }}>{key}.</span>{ch.replace(/^[A-D]: /,"")}
                      </button>
                    );
                  })}
                </div>
              )}

              {result === null && cur.type === "穴埋め" && (
                <div style={{ display:"flex", gap:8 }}>
                  <input value={userAnswer} onChange={e=>setUserAnswer(e.target.value)}
                    onKeyDown={e=>e.key==="Enter" && submitAnswer(userAnswer)}
                    placeholder="答えを入力…"
                    style={{ flex:1, padding:"10px 14px", borderRadius:12, border:`2px solid ${c1}55`, outline:"none", fontSize:14, fontWeight:700, color:"#E0EAF0", background:"#0F1E2A" }}/>
                  <button onClick={() => submitAnswer(userAnswer)}
                    style={{ padding:"10px 18px", borderRadius:12, border:"none", background:`linear-gradient(90deg,${c1},${c2})`, color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer" }}>送信</button>
                </div>
              )}

              {result === "correct" && (
                <div style={{ background:"#0A2A1A", borderRadius:14, padding:"12px 16px", border:"2px solid #43E97B" }}>
                  <div style={{ fontSize:18, fontWeight:900, color:"#43E97B" }}>⭕ 正解！</div>
                  <div style={{ fontSize:13, color:"#A0BFC0", marginTop:4 }}>答え：<strong style={{ color:"#fff" }}>{cur.a}{cur.choices ? `: ${cur.choices[["A","B","C","D"].indexOf(cur.a)]?.replace(/^[A-D]: /,"")}` : ""}</strong></div>
                  {cur.hint && <div style={{ fontSize:12, color:"#6B8899", marginTop:6 }}>💡 {cur.hint}</div>}
                </div>
              )}
              {result === "wrong" && (
                <div style={{ background:"#2A0A1A", borderRadius:14, padding:"12px 16px", border:"2px solid #FF6B9D" }}>
                  <div style={{ fontSize:18, fontWeight:900, color:"#FF6B9D" }}>❌ 不正解…</div>
                  <div style={{ fontSize:13, color:"#A0BFC0", marginTop:4 }}>あなた：<strong style={{ color:"#FF6B9D" }}>{userAnswer}</strong></div>
                  <div style={{ fontSize:13, color:"#A0BFC0", marginTop:2 }}>正解：<strong style={{ color:"#FFB347" }}>{cur.a}{cur.choices ? `: ${cur.choices[["A","B","C","D"].indexOf(cur.a)]?.replace(/^[A-D]: /,"")}` : ""}</strong></div>
                  {cur.hint && <div style={{ fontSize:12, color:"#6B8899", marginTop:6 }}>💡 {cur.hint}</div>}
                </div>
              )}
            </div>
          </div>

          {result !== null && (
            <div style={{ marginTop:14, textAlign:"center" }}>
              <button onClick={nextQ}
                style={{ padding:"12px 44px", borderRadius:50, border:"none", background:`linear-gradient(135deg,${c1},${c2})`, color:"#fff", fontWeight:900, fontSize:15, cursor:"pointer" }}>
                {currentIdx !== null && currentIdx + 1 >= quizzes.length ? "🏁 結果を見る" : "次の問題 →"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

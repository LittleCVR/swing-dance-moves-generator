import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Shuffle, Play, Repeat, Wand2 } from "lucide-react";

// ---------------------------------------------
// 基本型別
// ---------------------------------------------

type Position = "closed" | "open" | "handshake" | "any";

type Move = {
  id: string;
  name: string;
  counts: number; // 幾拍
  start: Position;
  end: Position;
  notes?: string;
};

// ---------------------------------------------
// 動作資料庫（可自行增減）
// 這裡先以常見的 Lindy / ECS 位置概念簡化為 closed / open / handshake
// 若想要加入 Charleston 或 Tandem，可新增 position 種類並擴充動作
// ---------------------------------------------

const MOVES: Move[] = [
  // 6 拍（Six-count）
  {
    id: "send_out_6",
    name: "Send Out (6)",
    counts: 6,
    start: "closed",
    end: "open",
    notes: "Closed → Open 的基本轉換",
  },
  {
    id: "return_to_closed_6",
    name: "Return to Closed / Circle to Closed (6)",
    counts: 6,
    start: "open",
    end: "closed",
  },
  {
    id: "change_places_inside_6",
    name: "Change Places (Inside Turn, 6)",
    counts: 6,
    start: "open",
    end: "open",
  },
  {
    id: "change_places_outside_6",
    name: "Change Places (Outside Turn, 6)",
    counts: 6,
    start: "open",
    end: "open",
  },
  {
    id: "tuck_turn_6",
    name: "Tuck Turn (6)",
    counts: 6,
    start: "closed", // 依使用者在描述中的例子，設定為需從 closed 起始
    end: "open",
  },
  {
    id: "handshake_pass_6",
    name: "Handshake Pass (6)",
    counts: 6,
    start: "handshake",
    end: "open",
  },

  // 8 拍（Eight-count）
  {
    id: "swingout_8",
    name: "Swingout (8)",
    counts: 8,
    start: "open",
    end: "open",
  },
  {
    id: "swingin_8",
    name: "Swing-in to Closed / Circle to Closed (8)",
    counts: 8,
    start: "open",
    end: "closed",
  },
  {
    id: "circle_open_8",
    name: "Lindy Circle to Open (8)",
    counts: 8,
    start: "closed",
    end: "open",
  },
  {
    id: "outside_turn_8",
    name: "Outside Turn (8)",
    counts: 8,
    start: "open",
    end: "open",
  },

  // 4 拍（Break / Filler）
  {
    id: "rock_break_4",
    name: "Rock Step Break (4)",
    counts: 4,
    start: "any",
    end: "any", // 視作不改變位置，方便銜接
    notes: "小休止或過渡用",
  },

  // 10 拍（少見，作為特殊組合練習）
  {
    id: "promenade_to_swingout_10",
    name: "Promenade → Swingout (10)",
    counts: 10,
    start: "closed",
    end: "open",
    notes: "示意 10 拍組合，可自行替換為實際習慣的 10 拍動作",
  },
];

// 可用的拍子長度集合（控制隨機拆分時會用到哪些）
const ALLOWED_COUNTS = [4, 6, 8, 10];

// ---------------------------------------------
// 小工具函式
// ---------------------------------------------

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function partitionBeatsRandom(total: number, allowed = ALLOWED_COUNTS): number[] {
  // 盡量在可用的拍長內隨機拆分成多段，直到剛好湊成 total
  // 若遇到死路，多嘗試幾次
  for (let attempt = 0; attempt < 300; attempt++) {
    const parts: number[] = [];
    let remain = total;
    while (remain > 0) {
      const candidates = allowed.filter((c) => c <= remain);
      if (candidates.length === 0) break;
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      parts.push(pick);
      remain -= pick;
    }
    if (remain === 0) return parts;
  }
  // 萬一實在拆不出來（理論上不會），退回全部 8
  return new Array(Math.ceil(total / 8)).fill(8).map((_, i, a) =>
    i === a.length - 1 ? total - 8 * (a.length - 1) : 8
  );
}

// 回傳可接到的動作集合（拍子長度要符合，起始位置要相容）
function candidatesFor(counts: number, startPos: Position, pool: Move[]): Move[] {
  return pool.filter((m) => m.counts === counts && (m.start === startPos || m.start === "any"));
}

// 將 any 視為保持位置不變
function nextPos(current: Position, move: Move): Position {
  const end = move.end === "any" ? current : move.end;
  return end;
}

// 回溯法組合產生器
function buildSequence(
  structure: number[],
  start: Position,
  pool: Move[],
  maxBacktrack = 5000
): Move[] | null {
  const result: Move[] = [];
  let pos: Position = start;

  // 動態回溯（每一步根據當前 pos 重新取候選）
  let steps = 0;
  const picks: number[] = new Array(structure.length).fill(0);

  let i = 0;
  while (i < structure.length) {
    if (steps++ > maxBacktrack) return null;

    const count = structure[i];
    const cands = shuffle(candidatesFor(count, pos, pool));

    if (picks[i] >= cands.length) {
      // 回溯
      if (i === 0) return null;
      i -= 1;
      result.pop()!;
      pos = i === 0 ? start : result.reduce((p, m, idx) => (idx === i - 1 ? nextPos(p, m) : p), start);
      // 重新計算 pos：從頭計到第 i-1 個的 end
      pos = start;
      for (let k = 0; k < i; k++) pos = nextPos(pos, result[k]);
      picks[i] = 0; // 重置當前層的指標
      picks[i] += 1; // 避免重選上一個
      continue;
    }

    const move = cands[picks[i]];

    if (move) {
      result.push(move);
      pos = nextPos(pos, move);
      i += 1;
      if (i < structure.length) picks[i] = 0; // 下一段從 0 開始
    } else {
      picks[i] += 1;
    }
  }

  return result;
}

// 解析使用者輸入的結構字串（例如："6 8 6 8 4"）
function parseStructure(input: string): number[] | null {
  const parts = input
    .trim()
    .split(/\s+/)
    .map((s) => Number(s))
    .filter((n) => !Number.isNaN(n));
  if (parts.length === 0) return null;
  return parts;
}

// ---------------------------------------------
// UI 元件
// ---------------------------------------------

const positions: { value: Position; label: string }[] = [
  { value: "closed", label: "Closed" },
  { value: "open", label: "Open" },
  { value: "handshake", label: "Handshake" },
];

export default function App() {
  const [totalBeats, setTotalBeats] = useState<number>(32);
  const [mode, setMode] = useState<"random" | "manual">("random");
  const [manual, setManual] = useState<string>("");
  const [startPos, setStartPos] = useState<Position>("closed");
  const [structure, setStructure] = useState<number[]>([8, 8, 8, 8]);
  const [sequence, setSequence] = useState<Move[] | null>(null);
  const [error, setError] = useState<string>("");

  // 當 total 或 mode / manual 改變時，預先計算當前結構（僅展示）
  const previewStructure = useMemo(() => {
    if (mode === "manual") {
      const p = parseStructure(manual);
      return p && p.length > 0 ? p : [];
    }
    return partitionBeatsRandom(totalBeats);
  }, [mode, manual, totalBeats]);

  function handleJam() {
    setError("");
    // 取得最終要採用的結構
    let target: number[] | null = null;
    if (mode === "manual") {
      target = parseStructure(manual);
      if (!target) {
        setError("請輸入有效的拍子結構，例如：6 8 6 8 4");
        setSequence(null);
        return;
      }
    } else {
      target = partitionBeatsRandom(totalBeats);
    }

    // 檢查總拍數
    const sum = target.reduce((a, b) => a + b, 0);
    if (sum !== totalBeats) {
      setError(`拍子結構(${sum}) 與總拍數(${totalBeats})不一致`);
      setSequence(null);
      return;
    }

    // 試著用回溯產生
    for (let tries = 0; tries < 200; tries++) {
      const seq = buildSequence(target, startPos, MOVES, 8000);
      if (seq) {
        setSequence(seq);
        setStructure(target);
        return;
      }
    }

    setSequence(null);
    setStructure(target);
    setError("找不到可用的連續動作組合。請嘗試：1) 改變起始位置、2) 放寬/修改拍子結構、3) 增加動作庫。");
  }

  return (
    <div className="min-h-screen w-full bg-neutral-50 flex flex-col items-center p-6">
      <div className="w-full max-w-4xl">
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Swing Dance Movement Generator</h1>
          <p className="text-neutral-600 mt-1">自訂拍子結構與起始位置，一鍵 <span className="font-semibold">JAM!!!</span> 生成可銜接的舞步序列。</p>
        </header>

        {/* 控制面板 */}
        <section className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-white rounded-2xl shadow">
            <label className="block text-sm text-neutral-500 mb-1">總拍數（beats）</label>
            <input
              type="number"
              className="w-full border rounded-xl px-3 py-2"
              min={4}
              step={2}
              value={totalBeats}
              onChange={(e) => setTotalBeats(Number(e.target.value))}
            />
            <p className="text-xs text-neutral-500 mt-2">預設 32 拍（4×8）。</p>
          </div>

          <div className="p-4 bg-white rounded-2xl shadow">
            <label className="block text-sm text-neutral-500 mb-2">拍子結構模式</label>
            <div className="flex items-center gap-3">
              <button
                className={`px-3 py-2 rounded-xl border ${mode === "random" ? "bg-black text-white" : "bg-white"}`}
                onClick={() => setMode("random")}
              >
                <Shuffle className="inline w-4 h-4 mr-1" /> 隨機
              </button>
              <button
                className={`px-3 py-2 rounded-xl border ${mode === "manual" ? "bg-black text-white" : "bg-white"}`}
                onClick={() => setMode("manual")}
              >
                <Wand2 className="inline w-4 h-4 mr-1" /> 手動
              </button>
            </div>
            {mode === "manual" ? (
              <div className="mt-3">
                <input
                  type="text"
                  placeholder="例如：6 8 6 8 4"
                  className="w-full border rounded-xl px-3 py-2"
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                />
                <p className="text-xs text-neutral-500 mt-2">以空白分隔；總和必須等於上方的總拍數。</p>
              </div>
            ) : (
              <p className="text-xs text-neutral-500 mt-2">將會自動拆分為多段（允許 4/6/8/10 拍）。</p>
            )}
          </div>

          <div className="p-4 bg-white rounded-2xl shadow">
            <label className="block text-sm text-neutral-500 mb-1">起始位置（Start Position）</label>
            <select
              className="w-full border rounded-xl px-3 py-2"
              value={startPos}
              onChange={(e) => setStartPos(e.target.value as Position)}
            >
              {positions.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>

            <div className="mt-3 text-sm text-neutral-600">
              <div className="font-medium mb-1">預覽拍子結構：</div>
              <div className="flex flex-wrap gap-2">
                {previewStructure.length > 0 ? (
                  previewStructure.map((n, i) => (
                    <span key={i} className="px-2 py-1 rounded-lg bg-neutral-100 border text-sm">
                      {n}
                    </span>
                  ))
                ) : (
                  <span className="text-neutral-400">—</span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* JAM!!! */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={handleJam}
            className="px-5 py-3 rounded-2xl bg-black text-white shadow flex items-center gap-2"
            title="Generate"
          >
            <Play className="w-4 h-4" /> JAM!!!
          </button>
          <button
            onClick={() => {
              setSequence(null);
              setError("");
            }}
            className="px-4 py-3 rounded-2xl border shadow bg-white flex items-center gap-2"
          >
            <Repeat className="w-4 h-4" /> 清空
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl mb-6">
            {error}
          </div>
        )}

        {/* 結果區塊 */}
        <section className="bg-white rounded-2xl shadow p-4">
          <h2 className="text-lg font-semibold mb-3">結果</h2>
          {sequence ? (
            <div className="space-y-3">
              {sequence.map((m, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: idx * 0.04 }}
                  className="flex items-center justify-between border rounded-xl px-3 py-2"
                >
                  <div>
                    <div className="font-medium">{idx + 1}. {m.name}</div>
                    <div className="text-xs text-neutral-500">
                      {m.counts} 拍 · {m.start.toUpperCase()} → {m.end.toUpperCase()}
                      {m.notes ? ` · ${m.notes}` : ""}
                    </div>
                  </div>
                  <div className="text-sm font-mono text-neutral-600">{structure[idx]} 拍</div>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-neutral-500">尚未產生結果。設定參數後按下「JAM!!!」吧 🎷</p>
          )}
        </section>

        {/* 動作庫說明 */}
        <section className="mt-6 text-sm text-neutral-600">
          <h3 className="font-semibold mb-2">動作庫（可自行擴充）</h3>
          <p className="mb-2">
            目前內建了常見的 6/8 拍 Lindy / ECS 動作與 4/10 拍示意。若你在課堂上使用不同版本的起訖位置（例如 Tuck Turn 從 open 開始），只要修改上方
            <span className="font-mono"> MOVES </span> 陣列的 <span className="font-mono">start</span> / <span className="font-mono">end</span>，或新增符合你習慣的變體即可。
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>位置代號：<span className="font-mono">closed</span> / <span className="font-mono">open</span> / <span className="font-mono">handshake</span> / <span className="font-mono">any</span>（any 代表不限制且不改變位置）。</li>
            <li>若要加入 Charleston / Tandem / Cross-hand 等，擴充 <span className="font-mono">Position</span> 型別並在資料庫中正確標註起訖位置即可。</li>
            <li>若遇到無法產生，通常是因為結構太嚴格或起訖位置難以銜接，請嘗試換起始位置、改結構、或增添中介動作（如 4 拍 break）。</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

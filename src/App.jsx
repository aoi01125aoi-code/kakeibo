import { useState, useEffect, useCallback } from "react";

const BASE_SALARY = 211000;
const STORAGE_KEY = "kakeibo4_v1";

const BUDGET_CATEGORIES = [
  { id: "rent",      label: "家賃",           limit: 66300,  icon: "🏠", bank: "okb",     note: "" },
  { id: "savings",   label: "貯金",           limit: 20000,  icon: "🏦", bank: "okb",     note: "" },
  { id: "social",    label: "交際費",          limit: 20000,  icon: "🥂", bank: "okb",     note: "PayPay" },
  { id: "beauty",    label: "美容",            limit: 25000,  icon: "💄", bank: "shinkin", note: "EPOS" },
  { id: "subscr",    label: "サブスク",        limit: 5400,   icon: "📱", bank: "shinkin", note: "EPOS" },
  { id: "transport", label: "交通費",          limit: 5000,   icon: "🚃", bank: "shinkin", note: "SuicaチャージEPOS" },
  { id: "utility",   label: "光熱費",          limit: 15000,  icon: "💡", bank: "conbini", sub: "pay",   note: "" },
  { id: "paidy",     label: "ペイディ",        limit: 8000,   icon: "📦", bank: "conbini", sub: "pay",   note: "" },
  { id: "zozo",      label: "ZOZO",            limit: 10000,  icon: "👗", bank: "conbini", sub: "pay",   note: "" },
  { id: "daily",     label: "日用品・ペット",  limit: 7000,   icon: "🧴", bank: "conbini", sub: "other", note: "" },
  { id: "family",    label: "実家",            limit: 10000,  icon: "🏡", bank: "conbini", sub: "other", note: "" },
  { id: "emergency", label: "緊急・病院",      limit: 10000,  icon: "🏥", bank: "conbini", sub: "other", note: "" },
  { id: "food",      label: "食費",            limit: 7000,   icon: "🍱", bank: "miive",   note: "" },
];

const BANKS = [
  { id: "okb",     label: "OKB",             color: "#2563c4", bg: "#eef3fc", border: "#c5d8f7", debitDay: 27 },
  { id: "shinkin", label: "信用金庫（EPOS）", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe", debitDay: 27 },
  { id: "conbini", label: "現金管理",         color: "#b45309", bg: "#fef9ee", border: "#fde68a",
    subs: [{ id: "pay", label: "コンビニ等払い" }, { id: "other", label: "その他・管理" }] },
  { id: "miive",   label: "miive",            color: "#c2410c", bg: "#fff7ed", border: "#fed7aa" },
];

const TOTAL_LIMIT = BUDGET_CATEGORIES.reduce((s, c) => s + c.limit, 0);

function yen(n) { return `¥${Number(n).toLocaleString("ja-JP")}`; }
function getMonthKey(y, m) { return `${y}-${String(m + 1).padStart(2, "0")}`; }
const MONTHS_JP = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

// ── Standalone input component defined OUTSIDE App to prevent remount ──
function EditInput({ value, onChange, onSave, onCancel, isText }) {
  return (
    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
      <input
        autoFocus
        type={isText ? "text" : "number"}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
        placeholder={isText ? "メモ" : "0"}
        style={{
          width: isText ? 110 : 84, padding: "4px 7px",
          border: "1.5px solid #1a1a1a", borderRadius: 7,
          fontSize: 13, fontWeight: 600, outline: "none",
          background: "#fff", color: "#1a1a1a", fontFamily: "inherit",
          textAlign: isText ? "left" : "right",
        }}
      />
      <button
        onClick={onSave}
        style={{ background: "#1a1a1a", border: "none", borderRadius: 7, cursor: "pointer", padding: "4px 9px", fontSize: 11, fontWeight: 700, color: "#fff" }}
      >✓</button>
    </div>
  );
}

export default function App() {
  const now = new Date();
  const [year, setYear]       = useState(now.getFullYear());
  const [month, setMonth]     = useState(now.getMonth());
  const [records, setRecords] = useState({});
  const [editing, setEditing] = useState(null);
  const [inputVal, setInputVal] = useState("");
  const [view, setView]       = useState("main");
  const [saved, setSaved]     = useState(false);
  const [collapsed, setCollapsed] = useState({});

  useEffect(() => {
    try { const r = localStorage.getItem(STORAGE_KEY); if (r) setRecords(JSON.parse(r)); } catch {}
    if (typeof window !== "undefined" && window.storage) {
      window.storage.get(STORAGE_KEY).then(r => { if (r?.value) setRecords(JSON.parse(r.value)); }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); } catch {}
    if (typeof window !== "undefined" && window.storage) {
      window.storage.set(STORAGE_KEY, JSON.stringify(records)).catch(() => {});
    }
  }, [records]);

  const mk = getMonthKey(year, month);
  const monthData = records[mk] || {};
  const salary    = monthData.__salary   ?? BASE_SALARY;
  const side      = monthData.__side     ?? 0;
  const sideNote  = monthData.__sidenote ?? "";
  const totalIncome = salary + side;

  function getSpent(id) { return monthData[id] ?? null; }

  function openEdit(key) {
    let val = "";
    if (key === "salary") val = String(salary);
    else if (key === "side") val = side > 0 ? String(side) : "";
    else if (key === "sidenote") val = sideNote;
    else { const v = getSpent(key); val = v !== null ? String(v) : ""; }
    setInputVal(val);
    setEditing(key);
  }

  const handleSave = useCallback(() => {
    if (!editing) return;
    if (editing === "sidenote") {
      setRecords(p => ({ ...p, [mk]: { ...(p[mk] || {}), __sidenote: inputVal } }));
      setEditing(null); flashSaved(); return;
    }
    const n = Number(inputVal);
    if (inputVal === "" || isNaN(n) || n < 0) { setEditing(null); return; }
    const field = editing === "salary" ? "__salary" : editing === "side" ? "__side" : editing;
    setRecords(p => ({ ...p, [mk]: { ...(p[mk] || {}), [field]: n } }));
    setEditing(null); flashSaved();
  }, [editing, inputVal, mk]);

  const handleCancel = useCallback(() => setEditing(null), []);
  const handleChange = useCallback((v) => setInputVal(v), []);

  function clearEntry(id) {
    setRecords(p => { const d = { ...(p[mk] || {}) }; delete d[id]; return { ...p, [mk]: d }; });
  }
  function clearSide() {
    setRecords(p => { const d = { ...(p[mk] || {}) }; delete d.__side; delete d.__sidenote; return { ...p, [mk]: d }; });
  }
  function flashSaved() { setSaved(true); setTimeout(() => setSaved(false), 1500); }
  function prevMonth() { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); }

  const totalSpent = BUDGET_CATEGORIES.reduce((s, c) => s + (getSpent(c.id) ?? 0), 0);
  const balance = totalIncome - totalSpent;

  function bankSpent(bankId) {
    return BUDGET_CATEGORIES.filter(c => c.bank === bankId).reduce((s, c) => s + (getSpent(c.id) ?? 0), 0);
  }
  function bankLimit(bankId) {
    return BUDGET_CATEGORIES.filter(c => c.bank === bankId).reduce((s, c) => s + c.limit, 0);
  }

  const historyMonths = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month - i, 1);
    const k = getMonthKey(d.getFullYear(), d.getMonth());
    const data = records[k] || {};
    const spent = BUDGET_CATEGORIES.reduce((s, c) => s + (data[c.id] ?? 0), 0);
    const inc = (data.__salary ?? BASE_SALARY) + (data.__side ?? 0);
    historyMonths.push({ label: `${d.getFullYear()}/${MONTHS_JP[d.getMonth()]}`, spent, income: inc, key: k, data });
  }
  const maxHistory = Math.max(...historyMonths.map(h => Math.max(h.spent, h.income)), 1);

  // ── Render helpers (plain functions, not components) ──
  function editInput(isText = false) {
    return <EditInput value={inputVal} onChange={handleChange} onSave={handleSave} onCancel={handleCancel} isText={isText} />;
  }

  function smallBtn(label, onClick, style = {}) {
    return (
      <button onClick={onClick} style={{ background: "#f0ece6", border: "none", borderRadius: 7, cursor: "pointer", padding: "3px 9px", fontSize: 11, fontWeight: 600, color: "#555", ...style }}>
        {label}
      </button>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f5f3f0", fontFamily: "'Hiragino Sans','Noto Sans JP',sans-serif", maxWidth: 480, margin: "0 auto", color: "#1a1a1a" }}>

      {/* Header */}
      <div style={{ padding: "22px 18px 0", background: "#f5f3f0", position: "sticky", top: 0, zIndex: 10, borderBottom: "1px solid #e4e0da" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>家計簿</span>
          <div style={{ display: "flex", gap: 4, background: "#e4e0da", borderRadius: 20, padding: 3 }}>
            {[{ v: "main", label: "記録" }, { v: "history", label: "履歴" }].map(tab => (
              <button key={tab.v} onClick={() => setView(tab.v)} style={{
                padding: "5px 14px", border: "none", borderRadius: 16, cursor: "pointer", fontSize: 12, fontWeight: 600,
                background: view === tab.v ? "#fff" : "transparent",
                color: view === tab.v ? "#1a1a1a" : "#999",
                boxShadow: view === tab.v ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              }}>{tab.label}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 12 }}>
          <button onClick={prevMonth} style={{ background: "none", border: "none", cursor: "pointer", color: "#bbb", fontSize: 22, padding: 0 }}>‹</button>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{year}年 {MONTHS_JP[month]}</span>
          <button onClick={nextMonth} style={{ background: "none", border: "none", cursor: "pointer", color: "#bbb", fontSize: 22, padding: 0 }}>›</button>
        </div>
      </div>

      <div style={{ padding: "14px 16px 80px" }}>
        {view === "main" && <>

          {/* Income card */}
          <div style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", marginBottom: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: 10, color: "#aaa", letterSpacing: 0.5, marginBottom: 10 }}>収入</div>

            {/* Salary */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>💼</span>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>本業給与</span>
                  <span style={{ fontSize: 10, color: "#aaa", marginLeft: 6 }}>毎月25日</span>
                </div>
              </div>
              {editing === "salary" ? editInput() : (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{yen(salary)}</span>
                  {smallBtn("編集", () => openEdit("salary"))}
                </div>
              )}
            </div>

            {/* Side income */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid #f2ede7" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>✨</span>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>副業</span>
                  {sideNote && editing !== "sidenote" && <span style={{ fontSize: 10, color: "#aaa", marginLeft: 6 }}>{sideNote}</span>}
                </div>
              </div>
              {editing === "side" ? editInput() :
               editing === "sidenote" ? editInput(true) : (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {side > 0 && <span style={{ fontSize: 14, fontWeight: 700, color: "#0e7a5e" }}>+{yen(side)}</span>}
                  {smallBtn(side > 0 ? "編集" : "入力", () => openEdit("side"))}
                  {side > 0 && <>
                    <button onClick={() => openEdit("sidenote")} style={{ background: "#f0ece6", border: "none", borderRadius: 7, cursor: "pointer", padding: "3px 7px", fontSize: 11, color: "#888" }}>📝</button>
                    <button onClick={clearSide} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#ccc", padding: "2px 3px" }}>×</button>
                  </>}
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 8, borderTop: "1px solid #f2ede7" }}>
              <span style={{ fontSize: 11, color: "#aaa" }}>収入合計</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#0e7a5e" }}>{yen(totalIncome)}</span>
            </div>
          </div>

          {/* Summary */}
          <div style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", marginBottom: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 10, color: "#aaa", marginBottom: 2 }}>支出合計</div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{yen(totalSpent)}<span style={{ fontSize: 11, color: "#bbb", fontWeight: 400, marginLeft: 4 }}>/ {yen(TOTAL_LIMIT)}</span></div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, color: "#aaa", marginBottom: 2 }}>収支</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: balance >= 0 ? "#0e7a5e" : "#d94f4f" }}>
                  {balance >= 0 ? "+" : "−"}{yen(Math.abs(balance))}
                </div>
              </div>
            </div>
            <div style={{ height: 5, background: "#ede9e3", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 99, width: `${Math.min(100, (totalSpent / totalIncome) * 100)}%`, background: totalSpent > totalIncome ? "#d94f4f" : "#444", transition: "width 0.4s" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 5 }}>
              <span style={{ fontSize: 10, color: balance < 0 ? "#d94f4f" : "#bbb" }}>
                残り {balance >= 0 ? yen(balance) : `−${yen(Math.abs(balance))}`}
              </span>
            </div>
          </div>

          {/* 26日アラート */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#fff5f5", border: "1.5px solid #fecaca",
            borderRadius: 10, padding: "9px 14px", marginBottom: 14,
          }}>
            <span style={{ fontSize: 14 }}>⚠️</span>
            <span style={{ fontSize: 12, color: "#c0392b", fontWeight: 600 }}>
              毎月26日に銀行振り分けが必要です
            </span>
            <span style={{ fontSize: 10, color: "#e57373", marginLeft: "auto" }}>25日入金 → 27日引落</span>
          </div>

          {/* Bank groups */}
          {BANKS.map(bank => {
            const cats = BUDGET_CATEGORIES.filter(c => c.bank === bank.id);
            const bSpent = bankSpent(bank.id);
            const bLimit = bankLimit(bank.id);
            const bOver  = bLimit > 0 && bSpent > bLimit;
            const isCollapsed = collapsed[bank.id];

            function renderCatRow(cat) {
              const spent = getSpent(cat.id);
              const isEd  = editing === cat.id;
              const over  = spent !== null && cat.limit > 0 && spent > cat.limit;
              const pct   = (spent !== null && cat.limit > 0) ? Math.min(100, (spent / cat.limit) * 100) : 0;
              return (
                <div key={cat.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid " + bank.border }}>
                  <span style={{ fontSize: 17, width: 22, textAlign: "center", flexShrink: 0 }}>{cat.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{cat.label}</span>
                        {cat.note && <span style={{ fontSize: 10, color: bank.color, marginLeft: 6, opacity: 0.7 }}>{cat.note}</span>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        {spent !== null && !isEd && (
                          <span style={{ fontSize: 13, fontWeight: 700, color: over ? "#d94f4f" : "#1a1a1a" }}>{yen(spent)}</span>
                        )}
                        {cat.limit > 0 && <span style={{ fontSize: 11, color: "#c0bab2" }}>{yen(cat.limit)}</span>}
                      </div>
                    </div>
                    {spent !== null && !isEd && cat.limit > 0 && (
                      <div style={{ marginTop: 5, height: 3, background: bank.border, borderRadius: 99 }}>
                        <div style={{ height: "100%", borderRadius: 99, width: `${pct}%`, background: over ? "#d94f4f" : bank.color, opacity: 0.7 }} />
                      </div>
                    )}
                  </div>
                  {!isEd ? (
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      <button onClick={() => openEdit(cat.id)}
                        style={{ background: bank.bg, border: `1px solid ${bank.border}`, borderRadius: 7, cursor: "pointer", padding: "3px 9px", fontSize: 11, fontWeight: 600, color: bank.color }}>
                        {spent !== null ? "編集" : "入力"}
                      </button>
                      {spent !== null && (
                        <button onClick={() => clearEntry(cat.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#ccc", padding: "2px 3px" }}>×</button>
                      )}
                    </div>
                  ) : editInput()}
                </div>
              );
            }

            return (
              <div key={bank.id} style={{ background: bank.bg, border: `1.5px solid ${bank.border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 10 }}>
                <button onClick={() => setCollapsed(p => ({ ...p, [bank.id]: !p[bank.id] }))}
                  style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 800, color: bank.color, letterSpacing: 0.5 }}>{bank.label}</span>
                      {bank.debitDay && (
                        <span style={{ fontSize: 10, color: bank.color, opacity: 0.6, marginLeft: 7 }}>引落 {bank.debitDay}日</span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {bLimit > 0 && (
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: bOver ? "#d94f4f" : bank.color }}>{yen(bSpent)}</span>
                          <span style={{ fontSize: 10, color: "#bbb", marginLeft: 4 }}>/ {yen(bLimit)}</span>
                        </div>
                      )}
                      <span style={{ fontSize: 12, color: bank.color, display: "inline-block", transition: "transform 0.2s", transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>▾</span>
                    </div>
                  </div>
                  {!isCollapsed && bLimit > 0 && (
                    <div style={{ marginTop: 8, height: 3, background: bank.border, borderRadius: 99 }}>
                      <div style={{ height: "100%", borderRadius: 99, width: `${Math.min(100, (bSpent / bLimit) * 100)}%`, background: bOver ? "#d94f4f" : bank.color, opacity: 0.6 }} />
                    </div>
                  )}
                </button>
                {!isCollapsed && (
                  bank.subs
                    ? bank.subs.map(sub => (
                        <div key={sub.id}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: bank.color, opacity: 0.6, letterSpacing: 0.5, marginTop: 12 }}>{sub.label}</div>
                          {cats.filter(c => c.sub === sub.id).map(renderCatRow)}
                        </div>
                      ))
                    : cats.map(renderCatRow)
                )}
              </div>
            );
          })}
        </>}

        {view === "history" && (
          <div>
            <div style={{ background: "#fff", borderRadius: 14, padding: "16px", marginBottom: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: 11, color: "#aaa", marginBottom: 12 }}>月別収支（過去6ヶ月）</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 110 }}>
                {historyMonths.map((hm, i) => {
                  const isCur = hm.key === mk;
                  const sH = Math.max(3, (hm.spent / maxHistory) * 96);
                  const iH = Math.max(3, (hm.income / maxHistory) * 96);
                  return (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{ width: "100%", height: 96, display: "flex", alignItems: "flex-end", gap: 2, justifyContent: "center" }}>
                        <div style={{ width: "44%", height: iH, borderRadius: "3px 3px 0 0", background: isCur ? "#0e7a5e" : "#b8dfc7" }} />
                        <div style={{ width: "44%", height: sH, borderRadius: "3px 3px 0 0", background: isCur ? "#1a1a1a" : "#dbd5cc" }} />
                      </div>
                      <div style={{ fontSize: 9, color: isCur ? "#1a1a1a" : "#bbb", marginTop: 4, fontWeight: isCur ? 700 : 400 }}>
                        {hm.label.split("/")[1]}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
                {[["#0e7a5e", "収入"], ["#1a1a1a", "支出"]].map(([c, l]) => (
                  <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
                    <span style={{ fontSize: 10, color: "#aaa" }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>

            {historyMonths.slice().reverse().map(hm => {
              const cats = BUDGET_CATEGORIES.filter(c => hm.data[c.id] !== undefined);
              const hmSide = hm.data.__side ?? 0;
              const hmSideNote = hm.data.__sidenote ?? "";
              if (cats.length === 0 && hmSide === 0) return null;
              const bal = hm.income - hm.spent;
              return (
                <div key={hm.key} style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", marginBottom: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{hm.label.replace("/", "年 ")}</span>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10, color: "#aaa" }}>収入 {yen(hm.income)}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: bal < 0 ? "#d94f4f" : "#1a1a1a" }}>
                        収支 {bal >= 0 ? "+" : "−"}{yen(Math.abs(bal))}
                      </div>
                    </div>
                  </div>
                  {hmSide > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderTop: "1px solid #f2ede7" }}>
                      <span style={{ fontSize: 12, color: "#777" }}>✨ 副業{hmSideNote ? `（${hmSideNote}）` : ""}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#0e7a5e" }}>+{yen(hmSide)}</span>
                    </div>
                  )}
                  {BANKS.map(bank => {
                    const bc = cats.filter(c => c.bank === bank.id);
                    if (bc.length === 0) return null;
                    return (
                      <div key={bank.id} style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 10, color: bank.color, fontWeight: 700, marginBottom: 4 }}>{bank.label}</div>
                        {bc.map(cat => (
                          <div key={cat.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderTop: `1px solid ${bank.border}` }}>
                            <span style={{ fontSize: 12, color: "#777" }}>{cat.icon} {cat.label}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: hm.data[cat.id] > cat.limit ? "#d94f4f" : "#1a1a1a" }}>
                              {yen(hm.data[cat.id])}
                              {hm.data[cat.id] > cat.limit && <span style={{ fontSize: 10, color: "#d94f4f", marginLeft: 3 }}>超過</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {saved && (
        <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", background: "#1a1a1a", color: "#fff", padding: "9px 18px", borderRadius: 20, fontSize: 12, fontWeight: 600, zIndex: 100, animation: "fadeUp 0.2s ease" }}>
          保存しました
        </div>
      )}
      <style>{`@keyframes fadeUp { from { opacity:0; transform: translateX(-50%) translateY(8px); } to { opacity:1; transform: translateX(-50%) translateY(0); } }`}</style>
    </div>
  );
}

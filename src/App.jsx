import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
} from "recharts";
import {
  Users, Plus, Trash2, LogOut, Check, X,
  ChevronDown, Wallet, PiggyBank, AlertTriangle, Pencil,
  CalendarPlus, ShieldCheck, Info, UserPlus, Shield, FileDown, Printer,
} from "lucide-react";
import { storageGet, storageSet } from "./storage.js";
import { listAllowedUsers, addAllowedUser, updateAllowedUserRole, removeAllowedUser } from "./auth.js";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const PALETTE = ["#C79A2B","#3E7A5C","#A6512C","#5B7B9A","#8B6F3E","#6B8E4E","#B08968","#4A6B6B","#9C6B9E","#7A8B4E","#C4783B","#5C7A8A"];
const DEFAULT_RULES = { minContribution: 500, penaltyAmount: 50, penaltySplit: "equal" };

const monthsInit = (val = null) => MONTHS.reduce((acc, m) => { acc[m] = val; return acc; }, {});
const uid = () => `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const formatRand = (n) => {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return "R" + Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const currentCalendarYear = new Date().getFullYear();

export default function StokvelDashboard({ role, myEmail, onSignOut }) {
  const isAdmin = role === "admin";

  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState(null); // { years, members }
  const [currentYear, setCurrentYear] = useState(null);
  const [yearData, setYearData] = useState(null); // { contributions, interest, rules }
  const [tab, setTab] = useState("overview");

  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");

  const [showAddYear, setShowAddYear] = useState(false);
  const [newYearVal, setNewYearVal] = useState("");

  const [editingCell, setEditingCell] = useState(null); // {memberId, month}
  const [draftVal, setDraftVal] = useState("");

  const [accessList, setAccessList] = useState([]);
  const [accessLoaded, setAccessLoaded] = useState(false);
  const [newAccessEmail, setNewAccessEmail] = useState("");
  const [newAccessRole, setNewAccessRole] = useState("member");
  const [accessError, setAccessError] = useState("");

  // ---------- storage helpers ----------
  const loadSettings = useCallback(async () => {
    try {
      const val = await storageGet("stokvel:settings");
      if (val) return val;
    } catch (e) { setError("Could not reach the database. Check your Supabase connection settings."); }
    const def = { years: [currentCalendarYear], members: [] };
    try { await storageSet("stokvel:settings", def); } catch (e) { setError("Could not save initial settings. Check your Supabase connection."); }
    return def;
  }, []);

  const loadYear = useCallback(async (year, memberIds) => {
    const key = `stokvel:year:${year}`;
    try {
      const parsed = await storageGet(key);
      if (parsed) {
        let changed = false;
        memberIds.forEach((id) => {
          if (!parsed.contributions[id]) { parsed.contributions[id] = monthsInit(null); changed = true; }
        });
        if (!parsed.rules) { parsed.rules = { ...DEFAULT_RULES }; changed = true; }
        if (changed) { try { await storageSet(key, parsed); } catch (e) {} }
        return parsed;
      }
    } catch (e) { /* not found, fall through */ }
    const def = {
      contributions: memberIds.reduce((acc, id) => { acc[id] = monthsInit(null); return acc; }, {}),
      interest: monthsInit(0),
      rules: { ...DEFAULT_RULES },
    };
    try { await storageSet(key, def); } catch (e) { setError("Could not save initial year data."); }
    return def;
  }, []);

  useEffect(() => {
    (async () => {
      const s = await loadSettings();
      setSettings(s);
      const y = s.years[s.years.length - 1] || currentCalendarYear;
      setCurrentYear(y);
      const yd = await loadYear(y, s.members.map((m) => m.id));
      setYearData(yd);
      setReady(true);
    })();
  }, [loadSettings, loadYear]);

  useEffect(() => {
    if (!isAdmin || tab !== "settings") return;
    setAccessLoaded(false);
    listAllowedUsers()
      .then((rows) => { setAccessList(rows); setAccessLoaded(true); })
      .catch(() => { setAccessError("Could not load the access list."); setAccessLoaded(true); });
  }, [isAdmin, tab]);

  const switchYear = async (year) => {
    setCurrentYear(year);
    const yd = await loadYear(year, settings.members.map((m) => m.id));
    setYearData(yd);
  };

  const saveSettings = async (next) => {
    setSettings(next);
    try { await storageSet("stokvel:settings", next); }
    catch (e) { setError("Could not save — your last change may not persist."); }
  };
  const saveYearData = async (next) => {
    setYearData(next);
    try { await storageSet(`stokvel:year:${currentYear}`, next); }
    catch (e) { setError("Could not save — your last change may not persist."); }
  };

  // ---------- actions ----------
  const addMember = async () => {
    const name = newMemberName.trim();
    if (!name) return;
    const id = uid();
    const nextSettings = { ...settings, members: [...settings.members, { id, name }] };
    await saveSettings(nextSettings);
    const nextYear = { ...yearData, contributions: { ...yearData.contributions, [id]: monthsInit(null) } };
    await saveYearData(nextYear);
    setNewMemberName(""); setShowAddMember(false);
  };

  const removeMember = async (id) => {
    const nextSettings = { ...settings, members: settings.members.filter((m) => m.id !== id) };
    await saveSettings(nextSettings);
    const contributions = { ...yearData.contributions };
    delete contributions[id];
    await saveYearData({ ...yearData, contributions });
  };

  const commitCell = async () => {
    if (!editingCell) return;
    const { memberId, month } = editingCell;
    const trimmed = draftVal.trim();
    let val = null;
    if (trimmed !== "") {
      const num = parseFloat(trimmed);
      if (Number.isNaN(num)) { setEditingCell(null); setDraftVal(""); return; }
      val = Math.round(num * 100) / 100;
    }
    const nextContrib = { ...yearData.contributions, [memberId]: { ...yearData.contributions[memberId], [month]: val } };
    await saveYearData({ ...yearData, contributions: nextContrib });
    setEditingCell(null); setDraftVal("");
  };

  const updateInterest = async (month, value) => {
    const num = value.trim() === "" ? 0 : (parseFloat(value) || 0);
    await saveYearData({ ...yearData, interest: { ...yearData.interest, [month]: num } });
  };

  const updateRule = async (field, value) => {
    const num = parseFloat(value);
    const parsed = field === "penaltySplit" ? value : (Number.isNaN(num) ? 0 : num);
    const rules = { ...(yearData.rules || DEFAULT_RULES), [field]: parsed };
    await saveYearData({ ...yearData, rules });
  };

  const addYear = async () => {
    const y = parseInt(newYearVal, 10);
    if (!y || settings.years.includes(y)) { setShowAddYear(false); return; }
    const nextSettings = { ...settings, years: [...settings.years, y].sort() };
    await saveSettings(nextSettings);
    setShowAddYear(false); setNewYearVal("");
    await switchYear(y);
  };

  // ---------- access list actions ----------
  const refreshAccessList = async () => {
    try { setAccessList(await listAllowedUsers()); } catch (e) { setAccessError("Could not refresh the access list."); }
  };
  const handleAddAccess = async () => {
    const email = newAccessEmail.trim().toLowerCase();
    if (!email) return;
    setAccessError("");
    try {
      await addAllowedUser(email, newAccessRole);
      setNewAccessEmail(""); setNewAccessRole("member");
      await refreshAccessList();
    } catch (e) { setAccessError("Could not add that email — it may already be on the list."); }
  };
  const handleToggleRole = async (email, currentRole) => {
    const nextRole = currentRole === "admin" ? "member" : "admin";
    try { await updateAllowedUserRole(email, nextRole); await refreshAccessList(); }
    catch (e) { setAccessError("Could not update that person's role."); }
  };
  const handleRemoveAccess = async (email) => {
    try { await removeAllowedUser(email); await refreshAccessList(); }
    catch (e) { setAccessError("Could not remove that person."); }
  };

  // ---------- derived data ----------
  const totals = useMemo(() => {
    if (!settings || !yearData) return null;
    const rules = yearData.rules || DEFAULT_RULES;
    const totalInterest = MONTHS.reduce((s, m) => s + (yearData.interest[m] || 0), 0);

    const rows = settings.members.map((mem) => {
      const monthly = yearData.contributions[mem.id] || monthsInit(null);
      const rawContribution = MONTHS.reduce((s, m) => s + (monthly[m] || 0), 0);
      const shortfallMonths = MONTHS.filter((m) => monthly[m] !== null && monthly[m] < rules.minContribution).length;
      const penaltyTotal = shortfallMonths * rules.penaltyAmount;
      const netContribution = Math.max(0, rawContribution - penaltyTotal);
      return { ...mem, monthly, rawContribution, shortfallMonths, penaltyTotal, netContribution };
    });

    const totalNetContributionAll = rows.reduce((s, r) => s + r.netContribution, 0);
    const totalRawContributionAll = rows.reduce((s, r) => s + r.rawContribution, 0);
    const totalPenaltiesAll = rows.reduce((s, r) => s + r.penaltyTotal, 0);
    const penaltySplit = rules.penaltySplit || "equal";
    const combinedBonus = totalInterest + totalPenaltiesAll;
    const memberCount = rows.length;

    const withShare = rows.map((r) => {
      const pct = totalNetContributionAll > 0 ? r.netContribution / totalNetContributionAll : 0;
      // proportional: interest + penalties pooled, split by contribution share
      // equal: interest split by contribution share, penalties split equally
      const interestShare = pct * totalInterest;
      const penaltyShare = penaltySplit === "equal"
        ? (memberCount > 0 ? totalPenaltiesAll / memberCount : 0)
        : pct * totalPenaltiesAll;
      const bonusShare = interestShare + penaltyShare;
      return { ...r, pct, interestShare, penaltyShare, bonusShare, totalShare: r.netContribution + bonusShare };
    });

    const totalPool = totalRawContributionAll + totalInterest;
    return { rows: withShare, totalRawContributionAll, totalNetContributionAll, totalInterest, totalPenaltiesAll, combinedBonus, totalPool, rules, penaltySplit };
  }, [settings, yearData]);

  if (!ready || !totals) {
    return (
      <div className="sv-app sv-loading">
        <style>{CSS}</style>
        <div className="sv-loading-stamp">Opening the ledger…</div>
      </div>
    );
  }

  return (
    <div className="sv-app">
      <style>{CSS}</style>

      <div className="sv-header">
        <div className="sv-header-top">
          <div>
            <div className="sv-eyebrow">Stokvel Ledger</div>
            <h1 className="sv-title">Magents Stokvel</h1>
          </div>
          <div className="sv-stamp">
            <div className="sv-stamp-label">Total Pool</div>
            <div className="sv-stamp-value">{formatRand(totals.totalPool)}</div>
            <div className="sv-stamp-year">{currentYear}</div>
          </div>
        </div>

        <div className="sv-header-bottom">
          <div className="sv-year-select">
            <select value={currentYear} onChange={(e) => switchYear(parseInt(e.target.value, 10))}>
              {settings.years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <ChevronDown size={14} />
            {isAdmin && (
              <button className="sv-icon-btn" title="Add a year" onClick={() => setShowAddYear(true)}>
                <CalendarPlus size={15} />
              </button>
            )}
          </div>

          <div className="sv-role-area">
            <span className={"sv-role-badge" + (isAdmin ? " sv-role-admin" : "")}>
              {isAdmin && <ShieldCheck size={13} />} {myEmail}
            </span>
            <button className="sv-text-btn" onClick={onSignOut}><LogOut size={13} /> Sign out</button>
          </div>
        </div>
      </div>

      {error && <div className="sv-banner sv-banner-error"><AlertTriangle size={14} /> {error}</div>}

      <div className="sv-tabs">
        <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>Overview</button>
        <button className={tab === "ledger" ? "active" : ""} onClick={() => setTab("ledger")}>Ledger</button>
        <button className={tab === "members" ? "active" : ""} onClick={() => setTab("members")}>Members</button>
        <button className={tab === "reports" ? "active" : ""} onClick={() => setTab("reports")}>Reports</button>
        {isAdmin && <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>Settings</button>}
      </div>

      <div className="sv-content">
        {tab === "overview" && <Overview totals={totals} />}
        {tab === "ledger" && (
          <Ledger
            totals={totals}
            isAdmin={isAdmin}
            editingCell={editingCell}
            setEditingCell={setEditingCell}
            draftVal={draftVal}
            setDraftVal={setDraftVal}
            commitCell={commitCell}
          />
        )}
        {tab === "members" && (
          <Members
            totals={totals}
            isAdmin={isAdmin}
            showAddMember={showAddMember}
            setShowAddMember={setShowAddMember}
            newMemberName={newMemberName}
            setNewMemberName={setNewMemberName}
            addMember={addMember}
            removeMember={removeMember}
          />
        )}
        {tab === "reports" && <Reports totals={totals} year={currentYear} />}
        {tab === "settings" && isAdmin && (
          <SettingsTab
            yearData={yearData}
            updateInterest={updateInterest}
            updateRule={updateRule}
            totals={totals}
            accessList={accessList}
            accessLoaded={accessLoaded}
            accessError={accessError}
            newAccessEmail={newAccessEmail}
            setNewAccessEmail={setNewAccessEmail}
            newAccessRole={newAccessRole}
            setNewAccessRole={setNewAccessRole}
            handleAddAccess={handleAddAccess}
            handleToggleRole={handleToggleRole}
            handleRemoveAccess={handleRemoveAccess}
            myEmail={myEmail}
          />
        )}
      </div>

      {showAddYear && (
        <Modal onClose={() => setShowAddYear(false)}>
          <h3><CalendarPlus size={16} /> Add a year</h3>
          <input
            type="number" autoFocus placeholder="e.g. 2027" value={newYearVal}
            onChange={(e) => setNewYearVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addYear()}
          />
          <div className="sv-modal-actions">
            <button className="sv-btn sv-btn-ghost" onClick={() => setShowAddYear(false)}>Cancel</button>
            <button className="sv-btn sv-btn-primary" onClick={addYear}>Add year</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------------- subcomponents ----------------

function Overview({ totals }) {
  if (totals.rows.length === 0) {
    return <EmptyState text="No members yet. Add your stokvel members under the Members tab to start tracking contributions." />;
  }
  const barData = totals.rows.map((r) => ({ name: r.name.split(" ")[0], value: r.rawContribution }));
  const pieData = totals.rows.map((r) => ({ name: r.name, value: Math.round(r.totalShare * 100) / 100 }));

  return (
    <div className="sv-overview">
      <div className="sv-cards">
        <Card icon={<Wallet size={18} />} label="Total Contributions" value={formatRand(totals.totalRawContributionAll)} />
        <Card icon={<PiggyBank size={18} />} label="Total Interest" value={formatRand(totals.totalInterest)} accent />
        <Card icon={<AlertTriangle size={18} />} label="Total Penalties (pooled)" value={formatRand(totals.totalPenaltiesAll)} warn />
        <Card icon={<Users size={18} />} label="Members" value={String(totals.rows.length)} />
      </div>

      <div className="sv-charts">
        <div className="sv-chart-card">
          <div className="sv-chart-title">Contributions by member</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D9CBA3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontFamily: "var(--font-body)", fontSize: 11, fill: "#5b4f36" }} axisLine={{ stroke: "#D9CBA3" }} tickLine={false} />
              <YAxis tick={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "#5b4f36" }} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => `R${v >= 1000 ? (v/1000)+"k" : v}`} />
              <Tooltip formatter={(v) => formatRand(v)} contentStyle={{ fontFamily: "var(--font-body)", borderRadius: 8, border: "1px solid #D9CBA3" }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {barData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="sv-chart-card">
          <div className="sv-chart-title">Share of the pool</div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={1}>
                {pieData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => formatRand(v)} contentStyle={{ fontFamily: "var(--font-body)", borderRadius: 8, border: "1px solid #D9CBA3" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="sv-note"><Info size={13} /> {totals.penaltySplit === "equal"
        ? <>Payout happens in December: each member's own penalty is deducted from their contribution first. The bank interest ({formatRand(totals.totalInterest)}) is split by contribution share, and all penalties collected ({formatRand(totals.totalPenaltiesAll)}) are split equally between every member.</>
        : <>Payout happens in December: each member's own penalty is deducted from their contribution first. Then all penalties collected, plus the bank interest ({formatRand(totals.combinedBonus)} combined), are pooled and redistributed to everyone by their (post-penalty) contribution share.</>}</div>
    </div>
  );
}

function Card({ icon, label, value, accent, warn }) {
  return (
    <div className={"sv-card" + (accent ? " sv-card-accent" : "") + (warn ? " sv-card-warn" : "")}>
      <div className="sv-card-icon">{icon}</div>
      <div>
        <div className="sv-card-label">{label}</div>
        <div className="sv-card-value">{value}</div>
      </div>
    </div>
  );
}

function Ledger({ totals, isAdmin, editingCell, setEditingCell, draftVal, setDraftVal, commitCell }) {
  const min = totals.rules.minContribution;
  const penalty = totals.rules.penaltyAmount;
  if (totals.rows.length === 0) {
    return <EmptyState text="No members yet. Add members under the Members tab, then come back here to log monthly contributions." />;
  }
  return (
    <div className="sv-ledger-wrap">
      <div className="sv-legend">
        <span><i className="sv-dot sv-dot-zero" /> Below {formatRand(min)} — counts as missed, R{penalty} penalty</span>
        <span><i className="sv-dot sv-dot-blank" /> — not due yet</span>
        {isAdmin && <span className="sv-legend-hint"><Pencil size={12} /> Click a cell to edit</span>}
      </div>
      <div className="sv-table-scroll">
        <table className="sv-table">
          <thead>
            <tr>
              <th className="sv-sticky-col">Member</th>
              {MONTHS.map((m) => <th key={m}>{m}</th>)}
              <th className="sv-total-col">Total</th>
            </tr>
          </thead>
          <tbody>
            {totals.rows.map((r) => (
              <tr key={r.id}>
                <td className="sv-sticky-col sv-member-name">{r.name}</td>
                {MONTHS.map((m) => {
                  const val = r.monthly[m];
                  const isEditing = editingCell && editingCell.memberId === r.id && editingCell.month === m;
                  if (isEditing) {
                    return (
                      <td key={m} className="sv-cell-editing">
                        <input
                          autoFocus type="text" inputMode="decimal" value={draftVal}
                          onChange={(e) => setDraftVal(e.target.value)}
                          onBlur={commitCell}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitCell();
                            if (e.key === "Escape") setEditingCell(null);
                          }}
                        />
                      </td>
                    );
                  }
                  const shortfall = val !== null && val < min;
                  return (
                    <td
                      key={m}
                      className={"sv-cell" + (shortfall ? " sv-cell-zero" : val === null ? " sv-cell-blank" : "") + (isAdmin ? " sv-cell-clickable" : "")}
                      onClick={() => { if (!isAdmin) return; setEditingCell({ memberId: r.id, month: m }); setDraftVal(val === null ? "" : String(val)); }}
                    >
                      {val === null ? "—" : formatRand(val)}
                    </td>
                  );
                })}
                <td className="sv-total-col">{formatRand(r.rawContribution)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="sv-sticky-col">Monthly total</td>
              {MONTHS.map((m) => {
                const sum = totals.rows.reduce((s, r) => s + (r.monthly[m] || 0), 0);
                return <td key={m}>{formatRand(sum)}</td>;
              })}
              <td className="sv-total-col">{formatRand(totals.totalRawContributionAll)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function Members({ totals, isAdmin, showAddMember, setShowAddMember, newMemberName, setNewMemberName, addMember, removeMember }) {
  return (
    <div className="sv-members">
      {isAdmin && (
        <div className="sv-add-member">
          {showAddMember ? (
            <div className="sv-add-member-form">
              <input
                autoFocus placeholder="Member name" value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addMember()}
              />
              <button className="sv-btn sv-btn-primary" onClick={addMember}><Check size={14} /> Add</button>
              <button className="sv-btn sv-btn-ghost" onClick={() => { setShowAddMember(false); setNewMemberName(""); }}><X size={14} /></button>
            </div>
          ) : (
            <button className="sv-btn sv-btn-primary" onClick={() => setShowAddMember(true)}><Plus size={14} /> Add member</button>
          )}
        </div>
      )}

      {totals.rows.length === 0 ? (
        <EmptyState text={isAdmin ? "No members yet — add your first one above." : "No members have been added yet."} />
      ) : (
        <div className="sv-member-grid">
          {totals.rows.map((r) => (
            <div className="sv-member-card" key={r.id}>
              <div className="sv-member-card-top">
                <div className="sv-member-avatar" style={{ background: PALETTE[totals.rows.indexOf(r) % PALETTE.length] }}>
                  {r.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </div>
                {isAdmin && (
                  <button className="sv-icon-btn sv-icon-btn-danger" title="Remove member" onClick={() => removeMember(r.id)}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <div className="sv-member-card-name">{r.name}</div>
              <div className="sv-member-card-row"><span>Contributed</span><b>{formatRand(r.rawContribution)}</b></div>
              {r.penaltyTotal > 0 && (
                <div className="sv-member-card-row sv-member-card-row-warn"><span>Penalty deducted</span><b>-{formatRand(r.penaltyTotal)}</b></div>
              )}
              <div className="sv-member-card-row"><span>Net contribution</span><b>{formatRand(r.netContribution)}</b></div>
              <div className="sv-member-card-row"><span>Share of pool</span><b>{(r.pct * 100).toFixed(1)}%</b></div>
              <div className="sv-member-card-row"><span>Interest &amp; penalty share</span><b>{formatRand(r.bonusShare)}</b></div>
              <div className="sv-member-card-row sv-member-card-total"><span>Total payout</span><b>{formatRand(r.totalShare)}</b></div>

              {r.shortfallMonths > 0 && (
                <div className="sv-member-card-flag"><AlertTriangle size={12} /> {r.shortfallMonths} short month{r.shortfallMonths > 1 ? "s" : ""} this year</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsTab({
  yearData, updateInterest, updateRule, totals,
  accessList, accessLoaded, accessError,
  newAccessEmail, setNewAccessEmail, newAccessRole, setNewAccessRole,
  handleAddAccess, handleToggleRole, handleRemoveAccess, myEmail,
}) {
  const rules = yearData.rules || DEFAULT_RULES;
  return (
    <div className="sv-settings">
      <div className="sv-settings-block">
        <div className="sv-settings-block-title">Contribution rules</div>
        <div className="sv-settings-hint">If a member's monthly contribution falls below the minimum, a penalty is deducted automatically from their own total. Choose below how the penalties collected are shared out at payout.</div>
        <div className="sv-rule-row">
          <label>
            <span>Minimum monthly contribution</span>
            <input type="number" step="1" value={rules.minContribution} onChange={(e) => updateRule("minContribution", e.target.value)} />
          </label>
          <label>
            <span>Penalty per missed month</span>
            <input type="number" step="1" value={rules.penaltyAmount} onChange={(e) => updateRule("penaltyAmount", e.target.value)} />
          </label>
        </div>
        <label className="sv-split-row">
          <span>How penalties are shared at payout</span>
          <select value={rules.penaltySplit || "equal"} onChange={(e) => updateRule("penaltySplit", e.target.value)}>
            <option value="proportional">Pooled with interest, split by contribution share</option>
            <option value="equal">Split equally between all members (interest stays separate)</option>
          </select>
        </label>
        {totals.totalPenaltiesAll > 0 && (
          <div className="sv-settings-total">Total penalties this year: <b>{formatRand(totals.totalPenaltiesAll)}</b></div>
        )}
      </div>

      <div className="sv-settings-block">
        <div className="sv-settings-block-title">Bank interest by month</div>
        <div className="sv-settings-hint">Enter what the bank paid each month. This pools with the year's penalties and is split among members based on their (post-penalty) share of contributions.</div>
        <div className="sv-mini-grid">
          {MONTHS.map((m) => (
            <label key={m}>
              <span>{m}</span>
              <input type="number" step="0.01" value={yearData.interest[m] === 0 ? "" : yearData.interest[m]} placeholder="0"
                onChange={(e) => updateInterest(m, e.target.value)} />
            </label>
          ))}
        </div>
        <div className="sv-settings-total">Total interest: <b>{formatRand(totals.totalInterest)}</b></div>
      </div>

      <div className="sv-settings-block">
        <div className="sv-settings-block-title"><Shield size={15} style={{ verticalAlign: "-2px", marginRight: 5 }} />Manage access</div>
        <div className="sv-settings-hint">Only emails on this list can sign in and view the dashboard. Add each member's email so they can check their own numbers — admins can also edit.</div>

        <div className="sv-add-access-form">
          <input
            type="email" placeholder="member@email.com" value={newAccessEmail}
            onChange={(e) => setNewAccessEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddAccess()}
          />
          <select value={newAccessRole} onChange={(e) => setNewAccessRole(e.target.value)}>
            <option value="member">Member (view only)</option>
            <option value="admin">Admin</option>
          </select>
          <button className="sv-btn sv-btn-primary" onClick={handleAddAccess}><UserPlus size={14} /> Add</button>
        </div>
        {accessError && <div className="sv-form-error">{accessError}</div>}

        {!accessLoaded ? (
          <div className="sv-settings-hint">Loading access list…</div>
        ) : accessList.length === 0 ? (
          <div className="sv-settings-hint">Nobody's been added yet — add yourself and your members above.</div>
        ) : (
          <div className="sv-access-list">
            {accessList.map((u) => (
              <div className="sv-access-row" key={u.email}>
                <span className="sv-access-email">{u.email}{u.email === myEmail && <em> (you)</em>}</span>
                <span className={"sv-role-pill" + (u.role === "admin" ? " sv-role-pill-admin" : "")}>{u.role}</span>
                <button className="sv-btn sv-btn-ghost sv-btn-small" onClick={() => handleToggleRole(u.email, u.role)}>
                  Make {u.role === "admin" ? "member" : "admin"}
                </button>
                <button className="sv-icon-btn sv-icon-btn-danger" title="Remove access" onClick={() => handleRemoveAccess(u.email)}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="sv-empty">
      <Users size={22} />
      <p>{text}</p>
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div className="sv-modal-backdrop" onClick={onClose}>
      <div className="sv-modal" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500..700&family=Space+Mono:wght@400;700&family=Work+Sans:wght@400;500;600&display=swap');

.sv-app {
  --ink: #0F231F;
  --ink-2: #16332B;
  --paper: #F1E9D2;
  --paper-2: #E8DEC0;
  --line: #D9CBA3;
  --gold: #C79A2B;
  --gold-dark: #9C7A1E;
  --rust: #A6512C;
  --positive: #3E7A5C;
  --text-dark: #1D2A24;
  --text-muted: #6b6350;
  --text-light: #F4EEDD;
  --font-display: 'Fraunces', serif;
  --font-body: 'Work Sans', sans-serif;
  --font-mono: 'Space Mono', monospace;
  font-family: var(--font-body);
  color: var(--text-dark);
  background: var(--paper);
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--line);
  max-width: 100%;
}
.sv-app * { box-sizing: border-box; }
.sv-loading { display:flex; align-items:center; justify-content:center; min-height: 220px; }
.sv-loading-stamp { font-family: var(--font-display); color: var(--ink); font-size: 18px; }

.sv-header { background: linear-gradient(160deg, var(--ink) 0%, var(--ink-2) 100%); color: var(--text-light); padding: 22px 24px 16px; }
.sv-header-top { display:flex; justify-content:space-between; align-items:flex-start; gap: 16px; }
.sv-eyebrow { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--gold); margin-bottom: 4px; }
.sv-title { font-family: var(--font-display); font-weight: 600; font-size: 28px; margin: 0; letter-spacing: -0.01em; }
.sv-stamp { border: 1.5px solid var(--gold); border-radius: 50%; width: 108px; height: 108px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; flex-shrink:0; background: rgba(199,154,43,0.06); }
.sv-stamp-label { font-family: var(--font-mono); font-size: 8px; text-transform:uppercase; letter-spacing:0.08em; color: var(--gold); }
.sv-stamp-value { font-family: var(--font-display); font-size: 15px; font-weight: 600; line-height: 1.2; margin-top: 2px; }
.sv-stamp-year { font-family: var(--font-mono); font-size: 9px; color: rgba(244,238,221,0.6); margin-top: 2px; }

.sv-header-bottom { display:flex; justify-content:space-between; align-items:center; margin-top: 18px; padding-top: 14px; border-top: 1px dashed rgba(199,154,43,0.35); flex-wrap: wrap; gap: 10px; }
.sv-year-select { display:flex; align-items:center; gap: 4px; font-family: var(--font-mono); font-size: 13px; }
.sv-year-select select { background: transparent; color: var(--text-light); border: 1px solid rgba(244,238,221,0.3); border-radius: 6px; padding: 4px 6px; font-family: var(--font-mono); font-size: 13px; }
.sv-year-select select option { color: var(--text-dark); }
.sv-role-area { display:flex; align-items:center; gap: 10px; }
.sv-role-badge { font-family: var(--font-mono); font-size: 11px; display:flex; align-items:center; gap:4px; padding: 4px 9px; border-radius: 20px; background: rgba(244,238,221,0.1); color: rgba(244,238,221,0.75); }
.sv-role-admin { background: rgba(199,154,43,0.18); color: var(--gold); }
.sv-text-btn { background: none; border: none; color: var(--text-light); font-family: var(--font-body); font-size: 12.5px; display:flex; align-items:center; gap:4px; cursor:pointer; opacity: 0.85; padding: 4px 2px; }
.sv-text-btn:hover { opacity: 1; text-decoration: underline; }
.sv-icon-btn { background: rgba(244,238,221,0.1); border: none; border-radius: 6px; padding: 4px 6px; color: var(--text-light); cursor: pointer; display:flex; align-items:center; }
.sv-icon-btn:hover { background: rgba(244,238,221,0.2); }
.sv-icon-btn-danger { background: transparent; color: var(--rust); }
.sv-icon-btn-danger:hover { background: rgba(166,81,44,0.12); }

.sv-banner { display:flex; align-items:center; gap:8px; font-size: 12.5px; padding: 9px 24px; background: rgba(199,154,43,0.12); color: var(--gold-dark); border-bottom: 1px solid var(--line); }
.sv-banner-error { background: rgba(166,81,44,0.12); color: var(--rust); }

.sv-tabs { display:flex; gap: 2px; padding: 0 20px; background: var(--paper-2); border-bottom: 1px solid var(--line); overflow-x: auto; }
.sv-tabs button { font-family: var(--font-body); font-weight: 500; font-size: 13.5px; color: var(--text-muted); background: none; border: none; padding: 12px 14px; cursor: pointer; border-bottom: 2px solid transparent; white-space: nowrap; }
.sv-tabs button.active { color: var(--ink); border-bottom-color: var(--gold); }
.sv-tabs button:hover { color: var(--ink); }

.sv-content { padding: 20px 24px 28px; }

.sv-cards { display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px; }
.sv-card { background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 14px; display:flex; gap: 10px; align-items:flex-start; }
.sv-card-icon { color: var(--ink-2); margin-top: 2px; }
.sv-card-accent .sv-card-icon { color: var(--gold-dark); }
.sv-card-warn .sv-card-icon { color: var(--rust); }
.sv-card-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
.sv-card-value { font-family: var(--font-mono); font-size: 18px; font-weight: 700; margin-top: 2px; }

.sv-charts { display:grid; grid-template-columns: 1.3fr 1fr; gap: 14px; }
@media (max-width: 720px) { .sv-charts { grid-template-columns: 1fr; } }
.sv-chart-card { background:#fff; border: 1px solid var(--line); border-radius: 10px; padding: 14px; }
.sv-chart-title { font-family: var(--font-display); font-size: 14.5px; font-weight: 600; margin-bottom: 6px; }

.sv-note { display:flex; gap:6px; align-items:flex-start; font-size: 12px; color: var(--text-muted); margin-top: 16px; }

.sv-legend { display:flex; gap: 16px; align-items:center; font-size: 11.5px; color: var(--text-muted); margin-bottom: 8px; flex-wrap: wrap; }
.sv-legend-hint { margin-left: auto; display:flex; align-items:center; gap:4px; }
.sv-dot { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:5px; }
.sv-dot-zero { background: var(--rust); }
.sv-dot-blank { background: var(--line); }

.sv-table-scroll { overflow-x: auto; border: 1px solid var(--line); border-radius: 10px; }
.sv-table { border-collapse: collapse; width: 100%; font-size: 12.5px; background: #fff; }
.sv-table th, .sv-table td { padding: 8px 10px; text-align: right; white-space: nowrap; border-bottom: 1px solid var(--line); }
.sv-table th { font-family: var(--font-mono); font-size: 10.5px; text-transform: uppercase; color: var(--text-muted); background: var(--paper-2); text-align: right; }
.sv-table th.sv-sticky-col, .sv-table td.sv-sticky-col { text-align: left; position: sticky; left: 0; background: var(--paper-2); z-index: 1; }
.sv-table td.sv-sticky-col { background: #fff; font-weight: 500; }
.sv-member-name { font-family: var(--font-body); }
.sv-total-col { font-family: var(--font-mono); font-weight: 700; background: rgba(199,154,43,0.06); }
.sv-cell { font-family: var(--font-mono); }
.sv-cell-zero { color: var(--rust); font-weight: 700; }
.sv-cell-blank { color: var(--line); }
.sv-cell-clickable { cursor: pointer; }
.sv-cell-clickable:hover { background: rgba(199,154,43,0.1); }
.sv-cell-editing input { width: 68px; font-family: var(--font-mono); font-size: 12.5px; padding: 3px 5px; border: 1px solid var(--gold); border-radius: 4px; text-align: right; }
.sv-table tfoot td { font-weight: 700; background: var(--paper-2); font-family: var(--font-mono); }

.sv-add-member { margin-bottom: 16px; }
.sv-add-member-form { display:flex; gap: 8px; align-items:center; }
.sv-add-member-form input { flex: 1; max-width: 260px; }

.sv-member-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; }
.sv-member-card { background:#fff; border: 1px solid var(--line); border-radius: 10px; padding: 14px; }
.sv-member-card-top { display:flex; justify-content:space-between; align-items:flex-start; }
.sv-member-avatar { width: 34px; height: 34px; border-radius: 50%; color: #fff; display:flex; align-items:center; justify-content:center; font-family: var(--font-mono); font-size: 12px; font-weight: 700; }
.sv-member-card-name { font-family: var(--font-display); font-weight: 600; font-size: 15px; margin: 10px 0 8px; }
.sv-member-card-row { display:flex; justify-content:space-between; font-size: 12.5px; color: var(--text-muted); padding: 3px 0; }
.sv-member-card-row b { font-family: var(--font-mono); color: var(--text-dark); }
.sv-member-card-row-warn b { color: var(--rust); }
.sv-member-card-total { border-top: 1px dashed var(--line); margin-top: 4px; padding-top: 7px; }
.sv-member-card-total b { color: var(--positive); font-size: 13.5px; }
.sv-member-card-flag { display:flex; align-items:center; gap:5px; font-size: 11px; color: var(--rust); margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--line); }

.sv-settings-block { background:#fff; border: 1px solid var(--line); border-radius: 10px; padding: 16px; margin-bottom: 14px; }
.sv-settings-block-title { font-family: var(--font-display); font-weight: 600; font-size: 15px; margin-bottom: 3px; display:flex; align-items:center; }
.sv-settings-hint { font-size: 12px; color: var(--text-muted); margin-bottom: 12px; }
.sv-rule-row { display:flex; gap: 14px; flex-wrap: wrap; }
.sv-rule-row label { display:flex; flex-direction:column; gap: 4px; font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); text-transform: uppercase; flex: 1; min-width: 160px; }
.sv-rule-row input { font-family: var(--font-mono); padding: 7px 8px; border: 1px solid var(--line); border-radius: 6px; font-size: 13px; }
.sv-split-row { display:flex; flex-direction:column; gap: 4px; margin-top: 14px; font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); text-transform: uppercase; }
.sv-split-row select { font-family: var(--font-body); font-size: 13px; text-transform: none; padding: 8px; border: 1px solid var(--line); border-radius: 7px; background: #fff; color: var(--text-dark); }
.sv-report-actions { display:flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
.sv-mini-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(78px, 1fr)); gap: 8px; }
.sv-mini-grid label { display:flex; flex-direction:column; gap: 3px; font-size: 10.5px; color: var(--text-muted); font-family: var(--font-mono); text-transform: uppercase; }
.sv-mini-grid input { font-family: var(--font-mono); padding: 5px 6px; border: 1px solid var(--line); border-radius: 5px; font-size: 12.5px; }
.sv-settings-total { margin-top: 12px; font-size: 13px; }
.sv-settings-total b { font-family: var(--font-mono); }

.sv-add-access-form { display:flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.sv-add-access-form input { flex: 2; min-width: 180px; }
.sv-add-access-form select { flex: 1; min-width: 140px; font-family: var(--font-body); font-size: 13px; padding: 8px 8px; border: 1px solid var(--line); border-radius: 7px; background: #fff; }
.sv-access-list { display:flex; flex-direction:column; gap: 6px; }
.sv-access-row { display:flex; align-items:center; gap: 8px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; flex-wrap: wrap; }
.sv-access-email { flex: 1; min-width: 140px; font-size: 13px; }
.sv-access-email em { color: var(--text-muted); font-style: normal; font-size: 11px; }
.sv-role-pill { font-family: var(--font-mono); font-size: 10.5px; text-transform: uppercase; padding: 2px 8px; border-radius: 20px; background: var(--paper-2); color: var(--text-muted); }
.sv-role-pill-admin { background: rgba(199,154,43,0.18); color: var(--gold-dark); }

.sv-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap: 10px; padding: 48px 20px; color: var(--text-muted); text-align:center; }
.sv-empty p { max-width: 340px; font-size: 13.5px; margin: 0; }

.sv-btn { font-family: var(--font-body); font-size: 13px; font-weight: 500; padding: 8px 14px; border-radius: 7px; border: 1px solid transparent; cursor: pointer; display:inline-flex; align-items:center; gap: 6px; }
.sv-btn-primary { background: var(--ink); color: var(--text-light); }
.sv-btn-primary:hover { background: var(--ink-2); }
.sv-btn-ghost { background: transparent; border-color: var(--line); color: var(--text-dark); }
.sv-btn-ghost:hover { background: var(--paper-2); }
.sv-btn-small { padding: 5px 9px; font-size: 11.5px; }

.sv-app input[type="text"], .sv-app input[type="number"], .sv-app input[type="email"] {
  font-family: var(--font-body); font-size: 13.5px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 7px; width: 100%; background:#fff; color: var(--text-dark);
}
.sv-app input:focus { outline: none; border-color: var(--gold); box-shadow: 0 0 0 2px rgba(199,154,43,0.15); }

.sv-modal-backdrop { position: fixed; inset: 0; background: rgba(15,35,31,0.55); display:flex; align-items:center; justify-content:center; z-index: 50; padding: 16px; }
.sv-modal { background: var(--paper); border-radius: 12px; padding: 20px; width: 320px; max-width: 100%; border: 1px solid var(--line); }
.sv-modal h3 { font-family: var(--font-display); font-size: 16px; margin: 0 0 12px; display:flex; align-items:center; gap: 7px; }
.sv-modal-actions { display:flex; justify-content:flex-end; gap: 8px; margin-top: 14px; }
.sv-form-error { color: var(--rust); font-size: 12px; margin: -4px 0 10px; }
.sv-form-ok { color: var(--positive); font-size: 12px; margin-top: 6px; }
`;

// ---------------- reports ----------------

const splitDescription = (totals) =>
  totals.penaltySplit === "equal"
    ? "Interest shared by contribution; penalties shared equally between all members"
    : "Interest and penalties pooled and shared by contribution";

const r2 = (n) => (Math.round((n || 0) * 100) / 100).toFixed(2);
const csvEscape = (v) => {
  const s = String(v === null || v === undefined ? "" : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

function downloadCsv(totals, year) {
  const lines = [];
  lines.push(["Magents Stokvel report", year]);
  lines.push(["Generated", new Date().toLocaleDateString("en-ZA")]);
  lines.push([]);
  lines.push(["Member", ...MONTHS, "Total contributed", "Short months", "Penalty deducted", "Net contribution", "Share of pool %", "Interest share", "Penalty share", "Total payout"]);
  totals.rows.forEach((r) => lines.push([
    r.name,
    ...MONTHS.map((m) => (r.monthly[m] === null ? "" : r2(r.monthly[m]))),
    r2(r.rawContribution), r.shortfallMonths, r2(r.penaltyTotal), r2(r.netContribution),
    (r.pct * 100).toFixed(2), r2(r.interestShare), r2(r.penaltyShare), r2(r.totalShare),
  ]));
  lines.push([]);
  lines.push(["Club totals"]);
  lines.push(["Total contributions", r2(totals.totalRawContributionAll)]);
  lines.push(["Total interest", r2(totals.totalInterest)]);
  lines.push(["Total penalties", r2(totals.totalPenaltiesAll)]);
  lines.push(["Total pool", r2(totals.totalPool)]);
  lines.push([]);
  lines.push(["Rules"]);
  lines.push(["Minimum monthly contribution", r2(totals.rules.minContribution)]);
  lines.push(["Penalty per missed month", r2(totals.rules.penaltyAmount)]);
  lines.push(["Sharing", splitDescription(totals)]);

  const csv = "\uFEFF" + lines.map((l) => l.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "magents-stokvel-report-" + year + ".csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function printReport(totals, year) {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const rows = totals.rows.map((r) =>
    "<tr><td>" + esc(r.name) + "</td><td>" + formatRand(r.rawContribution) + "</td><td>" + (r.penaltyTotal > 0 ? "-" + formatRand(r.penaltyTotal) : "R0.00") +
    "</td><td>" + formatRand(r.netContribution) + "</td><td>" + (r.pct * 100).toFixed(1) + "%</td><td>" + formatRand(r.interestShare) +
    "</td><td>" + formatRand(r.penaltyShare) + "</td><td><b>" + formatRand(r.totalShare) + "</b></td></tr>"
  ).join("");
  const html = "<!doctype html><html><head><meta charset='utf-8'><title>Magents Stokvel " + year + " report</title>" +
    "<style>body{font-family:Arial,sans-serif;color:#1D2A24;padding:24px}h1{margin:0 0 4px}p{margin:2px 0;color:#555;font-size:13px}" +
    "table{border-collapse:collapse;width:100%;margin-top:16px;font-size:12px}th,td{border:1px solid #ccc;padding:6px 8px;text-align:right}" +
    "th:first-child,td:first-child{text-align:left}th{background:#eee}.tot{margin-top:16px;font-size:13px}.tot div{margin:3px 0}</style></head><body>" +
    "<h1>Magents Stokvel — " + year + " report</h1>" +
    "<p>Generated " + new Date().toLocaleDateString("en-ZA") + "</p>" +
    "<p>" + esc(splitDescription(totals)) + ". Minimum monthly contribution " + formatRand(totals.rules.minContribution) + ", penalty " + formatRand(totals.rules.penaltyAmount) + " per missed month.</p>" +
    "<table><thead><tr><th>Member</th><th>Contributed</th><th>Penalty</th><th>Net contribution</th><th>Share</th><th>Interest share</th><th>Penalty share</th><th>Total payout</th></tr></thead><tbody>" + rows + "</tbody></table>" +
    "<div class='tot'><div>Total contributions: <b>" + formatRand(totals.totalRawContributionAll) + "</b></div>" +
    "<div>Total interest: <b>" + formatRand(totals.totalInterest) + "</b></div>" +
    "<div>Total penalties: <b>" + formatRand(totals.totalPenaltiesAll) + "</b></div>" +
    "<div>Total pool: <b>" + formatRand(totals.totalPool) + "</b></div></div></body></html>";
  const w = window.open("", "_blank");
  if (!w) { alert("Your browser blocked the report window. Allow pop-ups for this site and try again."); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

function Reports({ totals, year }) {
  if (totals.rows.length === 0) {
    return <EmptyState text="No members yet — once contributions are recorded, you can export a report here." />;
  }
  const sum = (key) => totals.rows.reduce((s, r) => s + r[key], 0);
  return (
    <div className="sv-reports">
      <div className="sv-report-actions">
        <button className="sv-btn sv-btn-primary" onClick={() => downloadCsv(totals, year)}><FileDown size={14} /> Download CSV (opens in Excel)</button>
        <button className="sv-btn sv-btn-ghost" onClick={() => printReport(totals, year)}><Printer size={14} /> Print / save as PDF</button>
      </div>
      <div className="sv-note" style={{ marginTop: 0, marginBottom: 12 }}><Info size={13} /> {splitDescription(totals)}.</div>
      <div className="sv-table-scroll">
        <table className="sv-table">
          <thead>
            <tr>
              <th className="sv-sticky-col">Member</th>
              <th>Contributed</th><th>Penalty</th><th>Net</th><th>Share</th><th>Interest</th><th>Penalty share</th><th className="sv-total-col">Total payout</th>
            </tr>
          </thead>
          <tbody>
            {totals.rows.map((r) => (
              <tr key={r.id}>
                <td className="sv-sticky-col sv-member-name">{r.name}</td>
                <td className="sv-cell">{formatRand(r.rawContribution)}</td>
                <td className={"sv-cell" + (r.penaltyTotal > 0 ? " sv-cell-zero" : "")}>{r.penaltyTotal > 0 ? "-" + formatRand(r.penaltyTotal) : "R0.00"}</td>
                <td className="sv-cell">{formatRand(r.netContribution)}</td>
                <td className="sv-cell">{(r.pct * 100).toFixed(1)}%</td>
                <td className="sv-cell">{formatRand(r.interestShare)}</td>
                <td className="sv-cell">{formatRand(r.penaltyShare)}</td>
                <td className="sv-total-col">{formatRand(r.totalShare)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="sv-sticky-col">Totals</td>
              <td>{formatRand(sum("rawContribution"))}</td>
              <td>-{formatRand(sum("penaltyTotal"))}</td>
              <td>{formatRand(sum("netContribution"))}</td>
              <td>100%</td>
              <td>{formatRand(sum("interestShare"))}</td>
              <td>{formatRand(sum("penaltyShare"))}</td>
              <td className="sv-total-col">{formatRand(sum("totalShare"))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

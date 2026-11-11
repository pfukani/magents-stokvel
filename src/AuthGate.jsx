import React, { useState, useEffect } from "react";
import { LogOut, AlertTriangle } from "lucide-react";
import { getSession, onAuthChange, sendMagicLink, signOut, fetchMyAccess } from "./auth.js";
import App from "./App.jsx";

export default function AuthGate() {
  const [session, setSession] = useState(undefined); // undefined = checking, null = signed out
  const [access, setAccess] = useState(undefined); // undefined = checking, null = not registered
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    getSession().then(setSession);
    const unsub = onAuthChange(setSession);
    return unsub;
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    if (!session) { setAccess(null); return; }
    setAccess(undefined);
    fetchMyAccess(session.user.email)
      .then(setAccess)
      .catch(() => setError("Could not check your access. Try refreshing the page."));
  }, [session]);

  const handleSend = async (e) => {
    e.preventDefault();
    setError(""); setSending(true);
    try {
      await sendMagicLink(email);
      setSent(true);
    } catch (err) {
      setError("Could not send the sign-in link. Check the email address and try again.");
    } finally {
      setSending(false);
    }
  };

  if (session === undefined || (session && access === undefined)) {
    return <div style={loadingStyle}>Opening the ledger…</div>;
  }

  if (!session) {
    return (
      <div style={wrapStyle}>
        <div style={cardStyle}>
          <h2 style={titleStyle}>Magents Stokvel</h2>
          {sent ? (
            <>
              <p style={textStyle}>Check <b>{email}</b> for a sign-in link, then come back to this tab.</p>
              <button style={ghostBtnStyle} onClick={() => { setSent(false); setError(""); }}>Use a different email</button>
            </>
          ) : (
            <form onSubmit={handleSend}>
              <p style={textStyle}>Enter your email to get a sign-in link. Only emails your admin has added can access this dashboard.</p>
              <input
                type="email" required placeholder="you@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
              />
              <button type="submit" disabled={sending} style={btnStyle}>{sending ? "Sending…" : "Send sign-in link"}</button>
              {error && <p style={errorStyle}>{error}</p>}
            </form>
          )}
        </div>
      </div>
    );
  }

  if (!access) {
    return (
      <div style={wrapStyle}>
        <div style={cardStyle}>
          <h2 style={titleStyle}><AlertTriangle size={17} style={{ verticalAlign: "-2px", marginRight: 6 }} />Not registered</h2>
          <p style={textStyle}><b>{session.user.email}</b> isn't registered for this stokvel yet. Ask your admin to add your email under Settings → Manage access.</p>
          <button style={btnStyle} onClick={() => signOut()}><LogOut size={14} style={{ verticalAlign: "-2px", marginRight: 5 }} />Sign out and try another email</button>
        </div>
      </div>
    );
  }

  return <App role={access.role} myEmail={access.email} onSignOut={signOut} />;
}

const wrapStyle = { display: "flex", alignItems: "center", justifyContent: "center", minHeight: 340, fontFamily: "'Work Sans', sans-serif" };
const loadingStyle = { ...wrapStyle, color: "#6b6350", fontFamily: "Georgia, serif", fontSize: 17 };
const cardStyle = { background: "#F1E9D2", border: "1px solid #D9CBA3", borderRadius: 14, padding: 26, width: 340, maxWidth: "100%", boxSizing: "border-box" };
const titleStyle = { fontFamily: "Georgia, serif", marginTop: 0, marginBottom: 12, fontSize: 20, color: "#1D2A24" };
const textStyle = { color: "#6b6350", fontSize: 13.5, lineHeight: 1.5 };
const inputStyle = { width: "100%", padding: "9px 10px", border: "1px solid #D9CBA3", borderRadius: 7, fontSize: 14, marginBottom: 10, boxSizing: "border-box", fontFamily: "'Work Sans', sans-serif" };
const btnStyle = { background: "#0F231F", color: "#F4EEDD", border: "none", borderRadius: 7, padding: "9px 16px", fontSize: 13.5, cursor: "pointer", width: "100%" };
const ghostBtnStyle = { ...btnStyle, background: "transparent", color: "#1D2A24", border: "1px solid #D9CBA3", marginTop: 10 };
const errorStyle = { color: "#A6512C", fontSize: 12.5, marginTop: 6 };

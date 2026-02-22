/**
 * BankUpdates.jsx
 * ─────────────────
 * User-facing "Updates from Banks" tab.
 * Shows a live feed of everything banks have communicated:
 *   - KYC accepted / rejected (with reason)
 *   - Additional document requests (with message)
 *   - Pending decisions (no action yet)
 * Also shows an at-a-glance summary bar.
 */
import { useState, useEffect, useRef } from 'react';
import { consentService, kycService } from '../services/api';
import toast from 'react-hot-toast';

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(iso) {
    if (!iso) return 'Unknown';
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return new Date(iso).toLocaleDateString();
}

// ── Update card types ─────────────────────────────────────────────────────────
const CARD_STYLES = {
    accepted: {
        bg: 'rgba(16,185,129,0.08)',
        border: 'rgba(16,185,129,0.3)',
        accent: '#10b981',
        icon: '✅',
        title: 'KYC Accepted & Verified',
    },
    rejected: {
        bg: 'rgba(239,68,68,0.08)',
        border: 'rgba(239,68,68,0.3)',
        accent: '#ef4444',
        icon: '❌',
        title: 'KYC Rejected',
    },
    doc_request: {
        bg: 'rgba(234,179,8,0.08)',
        border: 'rgba(234,179,8,0.3)',
        accent: '#facc15',
        icon: '📨',
        title: 'Additional Documents Required',
    },
    pending: {
        bg: 'rgba(255,255,255,0.03)',
        border: 'rgba(255,255,255,0.08)',
        accent: 'var(--text-muted)',
        icon: '⏳',
        title: 'Awaiting Bank Decision',
    },
    granted_only: {
        bg: 'rgba(79,70,229,0.06)',
        border: 'rgba(79,70,229,0.2)',
        accent: '#6366f1',
        icon: '🔓',
        title: 'Consent Granted — No Decision Yet',
    },
};

function getCardType(consent) {
    if (consent.bank_decision === 'accepted') return 'accepted';
    if (consent.bank_decision === 'rejected') return 'rejected';
    if (consent.doc_request_message) return 'doc_request';
    if (consent.status === 'granted') return 'granted_only';
    return 'pending';
}

// ── InlineUploader ─────────────────────────────────────────────────────────────
function InlineUploader({ onUploaded }) {
    const [file, setFile] = useState(null);
    const [docType, setDocType] = useState('passport');
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const inputRef = useRef();

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const dropped = e.dataTransfer.files[0];
        if (dropped) setFile(dropped);
    };

    const handleUpload = async () => {
        if (!file) return;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('doc_type', docType);
            formData.append('validity_days', '365');
            toast.loading('Encrypting & Uploading...', { id: 'add-doc' });
            await kycService.upload(formData);
            toast.success('Additional document uploaded! ✅', { id: 'add-doc' });
            setFile(null);
            onUploaded?.();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Upload failed', { id: 'add-doc' });
        } finally {
            setUploading(false);
        }
    };

    return (
        <div onClick={e => e.stopPropagation()} style={{ marginTop: '1rem' }}>
            <p style={{ fontSize: '0.72rem', color: '#facc15', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.6rem' }}>📤 Upload Requested Document</p>

            {/* Drag-drop zone */}
            <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                style={{
                    padding: '1.25rem',
                    borderRadius: '10px',
                    border: `2px dashed ${dragOver ? '#facc15' : 'rgba(234,179,8,0.4)'}`,
                    background: dragOver ? 'rgba(234,179,8,0.08)' : 'rgba(0,0,0,0.2)',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    marginBottom: '0.75rem',
                }}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    style={{ display: 'none' }}
                    onChange={e => setFile(e.target.files[0])}
                />
                {file ? (
                    <div>
                        <p style={{ fontSize: '1.5rem', marginBottom: '4px' }}>📎</p>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>{file.name}</p>
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{(file.size / 1024).toFixed(1)} KB · Click to change</p>
                    </div>
                ) : (
                    <div>
                        <p style={{ fontSize: '1.5rem', marginBottom: '4px' }}>📁</p>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Drag & drop or <span style={{ color: '#facc15' }}>click to browse</span></p>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>Image or PDF</p>
                    </div>
                )}
            </div>

            {/* Doc type selector */}
            <select
                value={docType}
                onChange={e => setDocType(e.target.value)}
                onClick={e => e.stopPropagation()}
                style={{
                    width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px',
                    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(234,179,8,0.3)',
                    color: 'var(--text-primary)', fontSize: '0.83rem', marginBottom: '0.65rem',
                }}
            >
                <option value="passport">🛂 Passport</option>
                <option value="aadhaar">🪪 Aadhaar Card</option>
                <option value="pan">💳 PAN Card</option>
                <option value="driving_license">🚗 Driving License</option>
                <option value="voter_id">🗳️ Voter ID</option>
                <option value="other">📄 Other</option>
            </select>

            <button
                className="btn btn-full"
                onClick={handleUpload}
                disabled={!file || uploading}
                style={{
                    background: file ? 'linear-gradient(135deg,#facc15,#f59e0b)' : 'rgba(255,255,255,0.06)',
                    color: file ? '#000' : 'var(--text-muted)',
                    fontWeight: 700, padding: '0.7rem', borderRadius: '8px',
                    cursor: file ? 'pointer' : 'not-allowed',
                    border: 'none', width: '100%', fontSize: '0.88rem',
                    transition: 'all 0.2s ease',
                }}
            >
                {uploading ? '⏳ Uploading...' : '✅ Submit Document'}
            </button>
        </div>
    );
}

// ── UpdateCard ─────────────────────────────────────────────────────────────────
function UpdateCard({ consent, onRefresh }) {
    const type = getCardType(consent);
    const style = CARD_STYLES[type];
    const [expanded, setExpanded] = useState(false);

    return (
        <div
            onClick={() => setExpanded(v => !v)}
            style={{
                padding: '1.25rem',
                borderRadius: '14px',
                background: style.bg,
                border: `1px solid ${style.border}`,
                cursor: 'pointer',
                transition: 'transform 0.15s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '40px', height: '40px', borderRadius: '12px',
                        background: `${style.accent}22`, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0,
                    }}>
                        {style.icon}
                    </div>
                    <div>
                        <p style={{ fontWeight: 700, color: style.accent, fontSize: '0.9rem', marginBottom: '2px' }}>
                            {style.title}
                        </p>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                            🏦 {consent.bank_name}
                            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>  ·  {consent.bank_email}</span>
                        </p>
                    </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {timeAgo(consent.decided_at || consent.doc_request_at || consent.granted_at || consent.requested_at)}
                    </p>
                    <span style={{
                        fontSize: '0.65rem', padding: '2px 8px', borderRadius: '9999px',
                        background: `${style.accent}22`, color: style.accent, marginTop: '4px', display: 'inline-block',
                    }}>
                        {consent.status?.toUpperCase()}
                    </span>
                </div>
            </div>

            {/* Expandable Detail */}
            {expanded && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid ${style.border}` }}>
                    {/* Rejection reason */}
                    {type === 'rejected' && consent.rejection_reason && (
                        <div style={{ marginBottom: '0.75rem', padding: '0.75rem', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                            <p style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Reason from Bank</p>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{consent.rejection_reason}</p>
                        </div>
                    )}

                    {/* Doc request message + inline uploader */}
                    {consent.doc_request_message && (
                        <div style={{ marginBottom: '0.75rem', padding: '0.75rem', borderRadius: '8px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)' }}>
                            <p style={{ fontSize: '0.7rem', color: '#facc15', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                                📨 Bank Message
                                {consent.doc_request_at && <span style={{ fontWeight: 400, marginLeft: '6px' }}>— {timeAgo(consent.doc_request_at)}</span>}
                            </p>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>{consent.doc_request_message}</p>
                            <InlineUploader onUploaded={onRefresh} />
                        </div>
                    )}

                    {/* Dates */}
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                        {consent.granted_at && <Chip label="Granted" value={new Date(consent.granted_at).toLocaleString()} />}
                        {consent.decided_at && <Chip label="Decided" value={new Date(consent.decided_at).toLocaleString()} accent={style.accent} />}
                        {consent.requested_at && <Chip label="Requested" value={new Date(consent.requested_at).toLocaleString()} />}
                    </div>
                </div>
            )}

            {/* Expand hint */}
            <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'right' }}>
                {expanded ? '▲ Collapse' : type === 'doc_request' ? '▼ View request & Upload' : '▼ Details'}
            </p>
        </div>
    );
}

function Chip({ label, value, accent }) {
    return (
        <div style={{ padding: '4px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '1px' }}>{label}</p>
            <p style={{ fontSize: '0.75rem', color: accent || 'var(--text-secondary)', fontWeight: 600 }}>{value}</p>
        </div>
    );
}

// ── Summary Bar ───────────────────────────────────────────────────────────────
function SummaryBar({ consents }) {
    const accepted = consents.filter(c => c.bank_decision === 'accepted').length;
    const rejected = consents.filter(c => c.bank_decision === 'rejected').length;
    const docReqs = consents.filter(c => c.doc_request_message && c.bank_decision !== 'accepted').length;
    const waiting = consents.filter(c => !c.bank_decision).length;

    const items = [
        { label: 'Accepted', value: accepted, color: '#10b981', icon: '✅' },
        { label: 'Rejected', value: rejected, color: '#ef4444', icon: '❌' },
        { label: 'Doc Requests', value: docReqs, color: '#facc15', icon: '📨' },
        { label: 'Awaiting', value: waiting, color: '#6366f1', icon: '⏳' },
    ];

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
            {items.map(item => (
                <div key={item.label} className="stat-card" style={{ textAlign: 'center', padding: '1.25rem' }}>
                    <p style={{ fontSize: '1.8rem', marginBottom: '4px' }}>{item.icon}</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 800, color: item.color }}>{item.value}</p>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{item.label}</p>
                </div>
            ))}
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function BankUpdates() {
    const [consents, setConsents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all | accepted | rejected | doc_request | pending

    const load = async () => {
        setLoading(true);
        try {
            const res = await consentService.getMyConsents();
            const all = res.data || [];

            // Sort: most recent activity first
            all.sort((a, b) => {
                const ta = new Date(a.decided_at || a.doc_request_at || a.granted_at || a.requested_at || 0).getTime();
                const tb = new Date(b.decided_at || b.doc_request_at || b.granted_at || b.requested_at || 0).getTime();
                return tb - ta;
            });

            setConsents(all);
        } catch (err) {
            toast.error('Failed to load updates');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        const interval = setInterval(load, 30000); // auto-refresh every 30s
        return () => clearInterval(interval);
    }, []);

    const filtered = consents.filter(c => {
        if (filter === 'all') return true;
        if (filter === 'accepted') return c.bank_decision === 'accepted';
        if (filter === 'rejected') return c.bank_decision === 'rejected';
        if (filter === 'doc_request') return !!c.doc_request_message;
        if (filter === 'pending') return !c.bank_decision;
        return true;
    });

    const FILTERS = [
        { id: 'all', label: '🔍 All' },
        { id: 'accepted', label: '✅ Accepted' },
        { id: 'rejected', label: '❌ Rejected' },
        { id: 'doc_request', label: '📨 Doc Requests' },
        { id: 'pending', label: '⏳ Awaiting' },
    ];

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', margin: 0 }}>
                        🔔 <span style={{ color: 'var(--text-primary)' }}>Bank</span>{' '}
                        <span style={{ background: 'var(--grad-premium)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            Updates
                        </span>
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
                        All updates from banks — verifications, rejections, and document requests
                    </p>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
                    {loading ? '⏳' : '↺'} Refresh
                </button>
            </div>

            {loading ? (
                <div style={{ display: 'grid', gap: '1rem', marginTop: '2rem' }}>
                    {[1, 2, 3].map(i => <div key={i} className="pulse" style={{ height: '80px', borderRadius: '14px' }} />)}
                </div>
            ) : (
                <>
                    <SummaryBar consents={consents} />

                    {/* Filter tabs */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                        {FILTERS.map(f => (
                            <button
                                key={f.id}
                                className="btn btn-sm"
                                onClick={() => setFilter(f.id)}
                                style={{
                                    padding: '0.4rem 0.9rem',
                                    fontSize: '0.8rem',
                                    background: filter === f.id ? 'var(--grad-premium)' : 'rgba(255,255,255,0.05)',
                                    color: filter === f.id ? '#fff' : 'var(--text-secondary)',
                                    border: filter === f.id ? 'none' : '1px solid var(--border-glass)',
                                    borderRadius: '9999px',
                                }}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    {/* Feed */}
                    {filtered.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '4rem 2rem', borderRadius: '16px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)' }}>
                            <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>No updates yet</p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                                Once a bank reviews your KYC or requests documents, it will appear here.
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {filtered.map(c => (
                                <UpdateCard key={c.consent_id} consent={c} onRefresh={load} />
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

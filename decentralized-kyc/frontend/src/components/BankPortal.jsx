import { useState, useEffect } from 'react';
import { consentService, kycService } from '../services/api';
import toast from 'react-hot-toast';

const STATUS_STYLES = {
    pending: { bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.35)', color: '#facc15', label: '⏳ Pending' },
    granted: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)', color: '#10b981', label: '✅ Granted' },
    revoked: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)', color: '#ef4444', label: '🚫 Revoked' },
};

function DetailPanel({ consentId, onClose }) {
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [verifying, setVerifying] = useState(false);
    const [rejecting, setRejecting] = useState(false);
    const [showRejectForm, setShowRejectForm] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [docData, setDocData] = useState(null);
    const [docLoading, setDocLoading] = useState(false);
    const [showDocRequestForm, setShowDocRequestForm] = useState(false);
    const [docRequestMsg, setDocRequestMsg] = useState('Please upload an additional supporting document for KYC verification.');
    const [sendingDocRequest, setSendingDocRequest] = useState(false);

    const loadDetail = () => {
        setLoading(true);
        consentService.getRequestDetail(consentId)
            .then(res => setDetail(res.data))
            .catch(() => toast.error('Failed to load request details'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { loadDetail(); }, [consentId]);

    const handleAccept = async () => {
        setVerifying(true);
        try {
            await kycService.verifyKyc(consentId);
            toast.success('KYC Accepted & Verified! ✅');
            loadDetail();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Verification failed');
        } finally { setVerifying(false); }
    };

    const handleReject = async () => {
        setRejecting(true);
        try {
            await kycService.rejectKyc(consentId, rejectionReason);
            toast.success('KYC Rejected.');
            setShowRejectForm(false);
            loadDetail();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Rejection failed');
        } finally { setRejecting(false); }
    };

    const handleViewDocument = async () => {
        if (docData) { setDocData(null); return; } // toggle off
        setDocLoading(true);
        try {
            const res = await kycService.viewDocument(consentId);
            setDocData(res.data);
            toast.success('Document loaded ✅');
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to load document');
        } finally { setDocLoading(false); }
    };

    const handleRequestMoreDocs = async () => {
        setSendingDocRequest(true);
        try {
            await kycService.requestMoreDocs(consentId, docRequestMsg);
            toast.success('Document request sent to user! 📨');
            setShowDocRequestForm(false);
            loadDetail();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Request failed');
        } finally { setSendingDocRequest(false); }
    };

    if (loading) return (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="pulse" style={{ height: '200px', borderRadius: '12px' }} />
        </div>
    );

    if (!detail) return null;

    const s = STATUS_STYLES[detail.status] || STATUS_STYLES.pending;
    const kyc = detail.kyc;
    const isGranted = detail.status === 'granted';
    const decision = detail.bank_decision; // 'accepted' | 'rejected' | null

    return (
        <div className="animate-in" style={{
            marginTop: '1.5rem', padding: '1.5rem', borderRadius: '16px',
            background: s.bg, border: `1px solid ${s.border}`,
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h3 style={{ margin: 0 }}>👤 {detail.user.full_name}</h3>
                    <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: s.color, fontWeight: 600 }}>{s.label}</p>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={onClose}>✕ Close</button>
            </div>

            {/* User Info Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                <InfoBlock label="Email" value={detail.user.email} />
                <InfoBlock label="Wallet Address" value={detail.user.wallet_address} mono />
                <InfoBlock label="Requested At" value={detail.requested_at ? new Date(detail.requested_at).toLocaleString() : 'N/A'} />
                {detail.granted_at && <InfoBlock label="Granted At" value={new Date(detail.granted_at).toLocaleString()} />}
            </div>

            {/* KYC Status */}
            <div style={{ padding: '1.25rem', borderRadius: '12px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)', marginBottom: '1.25rem' }}>
                <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    KYC Verification Status
                </p>
                {!kyc.has_kyc ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="badge" style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>No KYC Submitted</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>This user has not uploaded their KYC documents yet.</span>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
                        <KYCStat label="KYC Status" value={kyc.is_verified ? '✅ Verified' : '⏳ Pending'} color={kyc.is_verified ? '#10b981' : '#facc15'} />
                        <KYCStat label="Document Type" value={kyc.doc_type?.toUpperCase() || 'N/A'} />
                        <KYCStat label="Liveness Score" value={kyc.liveness_score !== null ? `${kyc.liveness_score}%` : 'Not Checked'} color={kyc.liveness_score >= 70 ? '#10b981' : '#facc15'} />
                        <KYCStat label="Liveness Check" value={kyc.liveness_verified ? '✅ Passed' : '⚠️ Pending'} color={kyc.liveness_verified ? '#10b981' : '#facc15'} />
                        <KYCStat label="Uploaded" value={kyc.uploaded_at ? new Date(kyc.uploaded_at).toLocaleDateString() : 'N/A'} />
                    </div>
                )}
            </div>

            {/* ── View Document ──────────────────────────────────────────────── */}
            {isGranted && kyc.has_kyc && (
                <div style={{ marginBottom: '1.25rem' }}>
                    <button
                        className="btn btn-secondary btn-full"
                        style={{ fontSize: '0.9rem', padding: '0.75rem' }}
                        onClick={handleViewDocument}
                        disabled={docLoading}
                    >
                        {docLoading ? '⏳ Loading Document...' : docData ? '🔼 Hide Document' : '📄 View KYC Document'}
                    </button>
                    {docData && (
                        <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: '12px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                                📎 {docData.doc_type?.toUpperCase()} — Uploaded {docData.uploaded_at ? new Date(docData.uploaded_at).toLocaleDateString() : 'N/A'}
                            </p>
                            <img
                                src={`data:image/jpeg;base64,${docData.doc_b64}`}
                                alt="KYC Document"
                                style={{ width: '100%', borderRadius: '8px', maxHeight: '400px', objectFit: 'contain', background: '#fff' }}
                                onError={(e) => {
                                    // Fallback for PDFs: render as PDF embed
                                    e.target.style.display = 'none';
                                    const embed = document.createElement('embed');
                                    embed.src = `data:application/pdf;base64,${docData.doc_b64}`;
                                    embed.style = 'width:100%;height:400px;border-radius:8px;';
                                    e.target.parentNode.appendChild(embed);
                                }}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* ── Bank Decision Area ──────────────────────────────────────────── */}
            {isGranted && !decision && kyc.has_kyc && (
                <div style={{ marginBottom: '1.25rem' }}>
                    <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem', letterSpacing: '0.08em' }}>Bank Decision</p>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                            className="btn btn-full"
                            style={{ flex: 1, background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', padding: '0.7rem', fontSize: '0.9rem' }}
                            onClick={handleAccept}
                            disabled={verifying || rejecting}
                        >
                            {verifying ? 'Accepting...' : '✅ Accept KYC'}
                        </button>
                        <button
                            className="btn btn-full"
                            style={{ flex: 1, background: 'linear-gradient(135deg,#ef4444,#b91c1c)', color: '#fff', padding: '0.7rem', fontSize: '0.9rem' }}
                            onClick={() => setShowRejectForm(v => !v)}
                            disabled={verifying || rejecting}
                        >
                            ❌ Reject KYC
                        </button>
                    </div>
                    {showRejectForm && (
                        <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px' }}>
                            <p style={{ fontSize: '0.78rem', color: '#ef4444', fontWeight: 600, marginBottom: '0.5rem' }}>Rejection Reason (sent to user)</p>
                            <textarea
                                value={rejectionReason}
                                onChange={e => setRejectionReason(e.target.value)}
                                placeholder="e.g. Document is blurry or expired. Please re-upload a valid Aadhaar card."
                                rows={3}
                                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(239,68,68,0.4)', color: 'var(--text-primary)', resize: 'vertical', fontSize: '0.83rem' }}
                            />
                            <button
                                className="btn btn-full"
                                style={{ marginTop: '0.5rem', background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)' }}
                                onClick={handleReject}
                                disabled={rejecting}
                            >
                                {rejecting ? 'Rejecting...' : 'Confirm Rejection'}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Decision result */}
            {decision === 'accepted' && (
                <div style={{ marginBottom: '1.25rem', padding: '0.85rem 1rem', borderRadius: '10px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', textAlign: 'center' }}>
                    <p style={{ color: '#10b981', fontWeight: 700 }}>✅ KYC Accepted & Verified by Your Institution</p>
                </div>
            )}
            {decision === 'rejected' && (
                <div style={{ marginBottom: '1.25rem', padding: '0.85rem 1rem', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                    <p style={{ color: '#ef4444', fontWeight: 700 }}>❌ KYC Rejected</p>
                    {detail.rejection_reason && <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>Reason: {detail.rejection_reason}</p>}
                </div>
            )}

            {/* ── Request Additional Docs ──────────────────────────────────────── */}
            {isGranted && (
                <div>
                    {detail.doc_request_message && (() => {
                        // Check if user submitted a new doc AFTER the bank's request
                        const requestedAt = detail.doc_request_at ? new Date(detail.doc_request_at) : null;
                        const uploadedAt = kyc.uploaded_at ? new Date(kyc.uploaded_at) : null;
                        const newDocSubmitted = requestedAt && uploadedAt && uploadedAt > requestedAt;

                        return (
                            <>
                                {/* Bank's request message */}
                                <div style={{ marginBottom: '0.75rem', padding: '0.75rem 1rem', borderRadius: '10px', background: 'rgba(79,70,229,0.1)', border: '1px solid rgba(79,70,229,0.3)' }}>
                                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                                        📨 Docs Requested {detail.doc_request_at ? `(${new Date(detail.doc_request_at).toLocaleDateString()})` : ''}
                                    </p>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{detail.doc_request_message}</p>
                                </div>

                                {/* ✅ User submitted new doc after request */}
                                {newDocSubmitted && (
                                    <div style={{
                                        marginBottom: '0.75rem', padding: '0.85rem 1rem', borderRadius: '10px',
                                        background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.4)',
                                        display: 'flex', alignItems: 'center', gap: '12px',
                                    }}>
                                        <span style={{ fontSize: '1.5rem' }}>📥</span>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontWeight: 700, color: '#10b981', fontSize: '0.9rem', marginBottom: '2px' }}>
                                                Additional Document Submitted!
                                            </p>
                                            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                                User uploaded a new document on {uploadedAt.toLocaleString()}
                                                {' '} — click <strong>View KYC Document</strong> above to review it.
                                            </p>
                                        </div>
                                        <span style={{
                                            padding: '4px 10px', borderRadius: '9999px', fontSize: '0.7rem',
                                            background: 'rgba(16,185,129,0.2)', color: '#10b981', fontWeight: 700,
                                        }}>NEW</span>
                                    </div>
                                )}

                                {/* ⏳ Waiting for user to submit */}
                                {!newDocSubmitted && (
                                    <div style={{
                                        marginBottom: '0.75rem', padding: '0.65rem 1rem', borderRadius: '10px',
                                        background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.25)',
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                    }}>
                                        <span>⏳</span>
                                        <p style={{ fontSize: '0.78rem', color: '#facc15' }}>Waiting for user to submit the requested document…</p>
                                    </div>
                                )}
                            </>
                        );
                    })()}
                    <button
                        className="btn btn-secondary btn-full"
                        style={{ fontSize: '0.88rem', padding: '0.7rem' }}
                        onClick={() => setShowDocRequestForm(v => !v)}
                    >
                        📨 {detail.doc_request_message ? 'Send Another Document Request' : 'Request Additional Documents'}
                    </button>
                    {showDocRequestForm && (
                        <div style={{ marginTop: '0.75rem', padding: '1rem', background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(79,70,229,0.25)', borderRadius: '10px' }}>
                            <p style={{ fontSize: '0.78rem', color: 'var(--accent-blue)', fontWeight: 600, marginBottom: '0.5rem' }}>Message to User</p>
                            <textarea
                                value={docRequestMsg}
                                onChange={e => setDocRequestMsg(e.target.value)}
                                rows={3}
                                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(79,70,229,0.35)', color: 'var(--text-primary)', resize: 'vertical', fontSize: '0.83rem' }}
                            />
                            <button
                                className="btn btn-primary btn-full"
                                style={{ marginTop: '0.5rem' }}
                                onClick={handleRequestMoreDocs}
                                disabled={sendingDocRequest}
                            >
                                {sendingDocRequest ? 'Sending...' : '📨 Send Request'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function InfoBlock({ label, value, mono }) {
    return (
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.85rem 1rem', borderRadius: '10px' }}>
            <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</p>
            <p style={{ fontWeight: 600, fontSize: mono ? '0.72rem' : '0.88rem', fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-all', color: 'var(--text-vibrant)' }}>{value}</p>
        </div>
    );
}

function KYCStat({ label, value, color }) {
    return (
        <div>
            <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '3px' }}>{label}</p>
            <p style={{ fontWeight: 700, fontSize: '0.85rem', color: color || 'var(--text-vibrant)' }}>{value}</p>
        </div>
    );
}

export default function BankPortal() {
    const [searchAddress, setSearchAddress] = useState('');
    const [requesting, setRequesting] = useState(false);
    const [grantedList, setGrantedList] = useState([]);
    const [sentRequests, setSentRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);
    const [viewingData, setViewingData] = useState(false);
    const [openConsentId, setOpenConsentId] = useState(null); // for detail panel

    useEffect(() => { fetchAll(); }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [grantedRes, sentRes] = await Promise.allSettled([
                consentService.getGrantedList(),
                consentService.getSentRequests(),
            ]);
            if (grantedRes.status === 'fulfilled') setGrantedList(grantedRes.value.data);
            if (sentRes.status === 'fulfilled') setSentRequests(sentRes.value.data);
        } finally {
            setLoading(false);
        }
    };

    const handleRequest = async (e) => {
        e.preventDefault();
        if (!searchAddress.startsWith('0x')) return toast.error('Enter a valid wallet address (0x...)');
        setRequesting(true);
        try {
            await consentService.requestAccess({ user_wallet_address: searchAddress });
            toast.success('Access request sent! 🔐');
            setSearchAddress('');
            const res = await consentService.getSentRequests();
            setSentRequests(res.data);
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Request failed');
        } finally {
            setRequesting(false);
        }
    };

    const viewUserKyc = async (address) => {
        setViewingData(true);
        try {
            const res = await consentService.viewKycData(address);
            setSelectedUser(res.data);
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Could not retrieve KYC data');
        } finally {
            setViewingData(false);
        }
    };

    const toggleDetail = (consentId) => {
        setOpenConsentId(prev => prev === consentId ? null : consentId);
    };

    const pendingCount = sentRequests.filter(r => r.status === 'pending').length;

    return (
        <div className="animate-in">
            <div className="page-header">
                <div>
                    <h2>Bank <span className="gradient-text">Verification Portal</span></h2>
                    <p className="page-subtitle">Securely request and manage customer KYC disclosures</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {pendingCount > 0 && (
                        <div className="badge" style={{ background: 'rgba(234,179,8,0.15)', color: '#facc15', border: '1px solid rgba(234,179,8,0.4)', fontSize: '0.8rem', padding: '0.3rem 0.8rem' }}>
                            {pendingCount} Awaiting Response
                        </div>
                    )}
                    <div className="badge badge-success">Institutional Access</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '2rem', marginBottom: '2rem' }}>
                {/* Request Access Form */}
                <div className="card" style={{ height: 'fit-content' }}>
                    <h3 style={{ marginBottom: '1.25rem' }}>🔍 Request KYC Access</h3>
                    <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        Enter a wallet address to request a verified identity disclosure.
                    </p>
                    <form onSubmit={handleRequest}>
                        <div className="form-group">
                            <label>Customer Wallet Address</label>
                            <input className="input" type="text" placeholder="0x..." value={searchAddress} onChange={(e) => setSearchAddress(e.target.value)} required />
                        </div>
                        <button type="submit" className="btn btn-primary btn-full" disabled={requesting}>
                            {requesting ? 'Processing...' : 'Request KYC Access'}
                        </button>
                    </form>
                </div>

                {/* Active Consents */}
                <div className="card">
                    <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        🛡️ Active Consents
                        <button className="btn btn-secondary btn-sm" onClick={fetchAll}>↻ Refresh</button>
                    </h3>
                    {loading ? (
                        <div className="pulse" style={{ height: '100px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }} />
                    ) : grantedList.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                            <p>No active consents yet.</p>
                            <span style={{ fontSize: '0.8rem' }}>Once users grant access, they will appear here.</span>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {grantedList.map(item => (
                                <div key={item.user_wallet_address} style={{ padding: '1.25rem', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <p style={{ fontWeight: 700, color: 'var(--text-vibrant)', fontSize: '0.95rem' }}>{item.user_full_name}</p>
                                        <p style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--accent-cyan)', marginTop: '4px' }}>
                                            {item.user_wallet_address?.slice(0, 12)}...{item.user_wallet_address?.slice(-10)}
                                        </p>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                                            Granted: {new Date(item.granted_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <button className="btn btn-primary btn-sm" onClick={() => viewUserKyc(item.user_wallet_address)} disabled={viewingData}>
                                        View KYC
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Sent Requests Panel */}
            <div className="card">
                <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    📤 Sent Access Requests
                    <button className="btn btn-secondary btn-sm" onClick={fetchAll}>↻ Refresh</button>
                </h3>
                {loading ? (
                    <div className="pulse" style={{ height: '80px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }} />
                ) : sentRequests.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        <p>No requests sent yet.</p>
                        <span style={{ fontSize: '0.8rem' }}>Your sent requests and their statuses will appear here.</span>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {sentRequests.map(req => {
                            const s = STATUS_STYLES[req.status] || STATUS_STYLES.pending;
                            const isOpen = openConsentId === req.consent_id;
                            return (
                                <div key={req.consent_id}>
                                    {/* Clickable Card */}
                                    <div
                                        onClick={() => toggleDetail(req.consent_id)}
                                        style={{
                                            padding: '1.1rem 1.25rem', borderRadius: '12px', cursor: 'pointer',
                                            background: isOpen ? s.bg : 'rgba(255,255,255,0.03)',
                                            border: `1px solid ${isOpen ? s.border : 'var(--border-glass)'}`,
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            transition: 'all 0.2s ease',
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.borderColor = s.border}
                                        onMouseLeave={e => { if (!isOpen) e.currentTarget.style.borderColor = 'var(--border-glass)'; }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: s.bg, border: `2px solid ${s.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
                                                👤
                                            </div>
                                            <div>
                                                <p style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-vibrant)' }}>{req.user_full_name}</p>
                                                <p style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                                    {req.user_wallet_address?.slice(0, 14)}...{req.user_wallet_address?.slice(-8)}
                                                </p>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{ textAlign: 'right' }}>
                                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.border}`, padding: '3px 10px', borderRadius: '999px' }}>
                                                    {s.label}
                                                </span>
                                                <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                                    {req.requested_at ? new Date(req.requested_at).toLocaleDateString() : 'N/A'}
                                                </p>
                                            </div>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
                                        </div>
                                    </div>

                                    {/* Expanded Detail Panel */}
                                    {isOpen && (
                                        <DetailPanel
                                            consentId={req.consent_id}
                                            onClose={() => setOpenConsentId(null)}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* KYC Full Report */}
            {selectedUser && (
                <div className="animate-in card" style={{ marginTop: '2.5rem', borderLeft: '4px solid var(--accent-green)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h3>📋 KYC Compliance Report</h3>
                        <button className="btn btn-secondary btn-sm" onClick={() => setSelectedUser(null)}>✕ Close</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                        <InfoBlock label="Full Identity" value={selectedUser.full_name} />
                        <InfoBlock label="Email" value={selectedUser.email} />
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.85rem 1rem', borderRadius: '10px' }}>
                            <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>KYC Status</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="badge badge-success">{selectedUser.kyc_status || 'VERIFIED'}</span>
                                <span style={{ fontSize: '0.8rem' }}>Score: {selectedUser.liveness_score}%</span>
                            </div>
                        </div>
                        <InfoBlock label="Document Type" value={selectedUser.id_type?.toUpperCase() || 'N/A'} />
                    </div>
                    <div style={{ marginTop: '1.5rem', padding: '1rem', borderRadius: '8px', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)' }}>
                        <p style={{ fontSize: '0.85rem', lineHeight: '1.6' }}>
                            🛡️ <strong>Compliance Audit:</strong> Document verified on {selectedUser.last_verified ? new Date(selectedUser.last_verified).toLocaleString() : 'N/A'} with a biometric confidence of <strong>{selectedUser.liveness_score}%</strong>. Document hash is anchored to the blockchain.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

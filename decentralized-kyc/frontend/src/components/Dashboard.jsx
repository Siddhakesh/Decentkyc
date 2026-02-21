/**
 * src/components/Dashboard.jsx
 * ────────────
 * Dynamic dashboard that fetches live KYC status, pending consents, and audit logs.
 */
import { useState, useEffect } from 'react';
import { kycService, consentService, auditService } from '../services/api';
import toast from 'react-hot-toast';

export default function Dashboard({ user }) {
    const [stats, setStats] = useState({
        kycStatus: 'Not Uploaded',
        onChain: 'None',
        accuracy: '0%',
        liveness: 'Pending',
        pendingConsents: 0,
        recentLogs: []
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const role = user?.role || 'user';

    useEffect(() => {
        console.log("[Dashboard] Initializing. User:", user);
        const fetchDashboardData = async () => {
            try {
                console.log("[Dashboard] Fetching stats...");
                setLoading(true);
                setError(null);

                const results = await Promise.allSettled([
                    kycService.getStatus(),
                    consentService.getPending(),
                    auditService.getLogs({ limit: 5 })
                ]);

                console.log("[Dashboard] Raw results:", results);
                const kycRes = results[0];
                const consentRes = results[1];
                const auditRes = results[2];

                const updatedStats = { ...stats };

                if (kycRes.status === 'fulfilled' && kycRes.value?.data) {
                    const data = kycRes.value.data;
                    console.log("[Dashboard] KYC Data found:", data);
                    updatedStats.kycStatus = data.is_verified ? 'Verified' : 'Pending';
                    updatedStats.onChain = data.kyc_hash ? 'Registered' : 'None';
                    updatedStats.accuracy = (data.fraud_score !== null && data.fraud_score !== undefined)
                        ? `${100 - data.fraud_score}%` : 'N/A';
                    updatedStats.liveness = data.liveness_verified ? 'Verified' : 'Required';
                }

                if (consentRes.status === 'fulfilled' && consentRes.value?.data) {
                    updatedStats.pendingConsents = consentRes.value.data.length || 0;
                }

                if (auditRes.status === 'fulfilled' && auditRes.value?.data?.logs) {
                    updatedStats.recentLogs = auditRes.value.data.logs;
                }

                setStats(updatedStats);
            } catch (err) {
                console.error("[Dashboard] CRITICAL FETCH ERROR:", err);
                setError(err.message || "Unknown error occurred");
                toast.error("Failed to fetch dashboard data");
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            fetchDashboardData();
        } else {
            console.warn("[Dashboard] No user provided to component.");
            setLoading(false);
        }
    }, [user]);

    if (error) {
        return (
            <div className="card" style={{ padding: '3rem', textAlign: 'center', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <h3 style={{ color: 'var(--accent-red)' }}>⚠️ Dashboard Load Failed</h3>
                <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>{error}</p>
                <button className="btn btn-primary" style={{ marginTop: '2rem' }} onClick={() => window.location.reload()}>
                    Retry Connection
                </button>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="animate-in">
                <div className="page-header">
                    <div>
                        <h2>Dashboard <span className="gradient-text">Initializing...</span></h2>
                        <p className="page-subtitle">Connecting to decentralized services</p>
                    </div>
                </div>
                <div className="stats-grid">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="card skeleton" style={{ height: '140px' }}></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="animate-in">
            <div className="page-header">
                <div>
                    <h2>Welcome back, <span className="gradient-text">{user?.full_name || user?.email?.split('@')?.[0] || 'User'}</span> 👋</h2>
                    <p className="page-subtitle">Decentralized Identity Overview</p>
                </div>
                <span className={`badge ${role === 'bank' ? 'badge-success' :
                    role === 'validator' ? 'badge-pending' : 'badge-info'
                    }`}>{role.toUpperCase()}</span>
            </div>

            <div className="stats-grid">
                {[
                    { icon: '🛡️', label: 'KYC Status', value: stats.kycStatus, color: 'var(--accent-green)' },
                    { icon: '📸', label: 'Biometrics', value: stats.liveness, color: 'var(--accent-purple)' },
                    { icon: '🔗', label: 'Blockchain', value: stats.onChain, color: 'var(--accent-blue)' },
                    { icon: '🔓', label: 'Consents', value: `${stats.pendingConsents} Pending`, color: 'var(--accent-amber)' },
                ].map(s => (
                    <div key={s.label} className="card stat-card">
                        <div className="icon-wrap" style={{ background: `${s.color}15`, color: s.color }}>
                            {s.icon}
                        </div>
                        <p className="card-title">{s.label}</p>
                        <p className="card-value" style={{ color: 'var(--text-vibrant)', fontSize: '1.75rem' }}>{s.value}</p>
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem' }}>
                <div className="card">
                    <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>📋</span> Latest Activity
                    </h3>
                    <div className="table-wrap" style={{ background: 'transparent', border: 'none' }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>Event</th>
                                    <th>Status</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.recentLogs.length > 0 ? stats.recentLogs.map(log => (
                                    <tr key={log.id}>
                                        <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{log.event_type.replace(/_/g, ' ')}</td>
                                        <td><span className="badge badge-info">Success</span></td>
                                        <td style={{ fontSize: '0.8rem' }}>{log.created_at ? new Date(log.created_at).toLocaleDateString() : 'N/A'}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="3" style={{ textAlign: 'center', padding: '2rem' }}>No recent activity found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="card" style={{ borderLeft: '4px solid var(--accent-purple)' }}>
                    <h3 style={{ marginBottom: '1.25rem' }}>🎯 Identity Goals</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {[
                            { step: 'Wallet Connected', done: !!stats.recentLogs.find(l => l.event_type === 'kyc_registered') || false, icon: '🦊' },
                            { step: 'KYC Document Uploaded', done: stats.kycStatus !== 'Not Uploaded', icon: '📄' },
                            { step: 'Biometric Verification', done: stats.liveness === 'Verified', icon: '📸' },
                            { step: 'On-Chain Registration', done: stats.onChain === 'Registered', icon: '🔗' },
                            { step: 'Bank Consent Ready', done: stats.pendingConsents > 0, icon: '🔓' }
                        ].map((goal, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: '32px', height: '32px', borderRadius: '10px',
                                    background: goal.done ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                    display: 'flex', alignItems: 'center', justifyCenter: 'center',
                                    fontSize: '1rem', color: goal.done ? 'var(--accent-green)' : 'var(--text-muted)',
                                    border: `1px solid ${goal.done ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-glass)'}`,
                                    justifyContent: 'center'
                                }}>
                                    {goal.done ? '✓' : goal.icon}
                                </div>
                                <span style={{
                                    fontSize: '0.9rem',
                                    fontWeight: goal.done ? 600 : 400,
                                    color: goal.done ? 'var(--text-primary)' : 'var(--text-secondary)'
                                }}>{goal.step}</span>
                            </div>
                        ))}
                    </div>

                    <div style={{ marginTop: '2rem', padding: '1rem', borderRadius: 'var(--radius-md)', background: 'rgba(79, 70, 229, 0.1)', border: '1px solid rgba(79, 70, 229, 0.2)' }}>
                        <p style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>💡 Tip</p>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-primary)', marginTop: '4px' }}>
                            Your identity is securely encrypted with AES-256 before reaching IPFS. Only you can authorize decryption.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * src/components/ConsentApproval.jsx
 * ────────────
 * Premium consent management interface for users.
 * Features:
 * - Digital signature verification flow
 * - Card-based request list
 * - Interactive status badges
 */
import { useState, useEffect } from 'react';
import { consentService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function ConsentApproval() {
    const { signConsent } = useAuth();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchRequests = async () => {
        try {
            setLoading(true);
            const res = await consentService.getPending();
            setRequests(res.data);
        } catch (err) {
            toast.error("Failed to fetch consent requests");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleGrant = async (req) => {
        try {
            toast.loading('Requesting Wallet Signature...', { id: 'consent-tx' });

            const message = `I authorize ${req.bank_name} (${req.bank_email}) to access my encrypted KYC data for verification purposes. Timestamp: ${new Date().toISOString()}`;
            const signature = await signConsent(message);

            if (!signature) throw new Error("Signature rejected by user");

            await consentService.grantAccess({
                bank_id: req.consent_id,
                bank_wallet_address: req.bank_wallet_address || "0x0000000000000000000000000000000000000000", // Fallback for POC
                consent_message: message,
                signature: signature
            });

            toast.success('Consent Granted & Signed! 🔓', { id: 'consent-tx' });
            fetchRequests();
        } catch (err) {
            toast.error(err.message || "Granting consent failed", { id: 'consent-tx' });
        }
    };

    if (loading) {
        return (
            <div className="animate-in">
                <div className="page-header">
                    <div className="skeleton" style={{ width: '250px', height: '32px' }}></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <div className="card skeleton" style={{ height: '200px' }}></div>
                    <div className="card skeleton" style={{ height: '200px' }}></div>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-in">
            <div className="page-header">
                <div>
                    <h2>Consent <span className="gradient-text">Requests</span></h2>
                    <p className="page-subtitle">Manage how banks access your identity data</p>
                </div>
                <span className="badge badge-pending">{requests.length} Pending</span>
            </div>

            {requests.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '4rem' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛡️</div>
                    <h3>No Pending Requests</h3>
                    <p style={{ marginTop: '0.5rem' }}>When a financial institution requests your KYC, it will appear here.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1.5rem' }}>
                    {requests.map(req => (
                        <div key={req.consent_id} className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                <div style={{
                                    width: '48px', height: '48px', borderRadius: '14px',
                                    background: 'rgba(79, 70, 229, 0.1)', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', fontSize: '1.5rem'
                                }}>
                                    🏦
                                </div>
                                <span className="badge badge-pending">Action Required</span>
                            </div>

                            <h3 style={{ fontSize: '1.25rem' }}>{req.bank_name}</h3>
                            <p style={{ fontSize: '0.85rem', marginBottom: '1.5rem' }}>{req.bank_email}</p>

                            <div style={{ marginBottom: '2rem', padding: '1rem', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)' }}>
                                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Scope of Access</p>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-primary)', marginTop: '4px' }}>
                                    Read access to Encrypted Identity Document (Passport/ID).
                                </p>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleGrant(req)}>
                                    ✍️ Sign & Grant
                                </button>
                                <button className="btn btn-secondary" style={{ flex: 1 }}>
                                    Deny
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="card" style={{ marginTop: '2.5rem', background: 'rgba(6, 182, 212, 0.05)', border: '1px solid rgba(6, 182, 212, 0.2)' }}>
                <p style={{ fontWeight: 700, color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>✅</span> Zero-Trust Architecture
                </p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginTop: '0.5rem' }}>
                    Granting consent requires a digital signature from your hardware or browser wallet.
                    This ensures even if the server is compromised, your data remains inaccessible without your private key.
                </p>
            </div>
        </div>
    );
}

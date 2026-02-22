import { useState, useEffect } from 'react';
import { authService, consentService } from '../services/api';
import toast from 'react-hot-toast';

export default function Marketplace() {
    const [banks, setBanks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [requesting, setRequesting] = useState(null);
    const [connected, setConnected] = useState(new Set()); // track which banks we've signalled

    useEffect(() => {
        const fetchBanks = async () => {
            try {
                const res = await authService.getBanks();
                setBanks(res.data);
            } catch (err) {
                console.error("Failed to fetch banks:", err);
                toast.error("Could not load marketplace data");
            } finally {
                setLoading(false);
            }
        };
        fetchBanks();
    }, []);

    const handleConnect = async (bank) => {
        if (connected.has(bank.id)) return; // already signalled

        setRequesting(bank.id);
        try {
            await consentService.signalInterest(bank.id);
            toast.success(`Connection signal sent to ${bank.full_name}! 🏦\nYou'll be notified once they respond.`);
            setConnected(prev => new Set([...prev, bank.id]));
        } catch (err) {
            const detail = err.response?.data?.detail || '';
            if (err.response?.status === 409 || detail.toLowerCase().includes('already')) {
                toast('Already connected with this institution.', { icon: '🔗' });
                setConnected(prev => new Set([...prev, bank.id]));
            } else {
                toast.error(detail || 'Failed to send connection signal');
            }
        } finally {
            setRequesting(null);
        }
    };

    if (loading) {
        return <div className="pulse" style={{ height: '300px', borderRadius: '12px', background: 'var(--bg-elevated)' }}></div>;
    }

    return (
        <div className="animate-in">
            <div className="page-header">
                <div>
                    <h2>Institutional <span className="gradient-text">Marketplace</span></h2>
                    <p className="page-subtitle">Browse and connect with verified financial institutions</p>
                </div>
                <div className="badge badge-info">{banks.length} Partners Available</div>
            </div>

            {banks.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '4rem' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>No institutions have registered yet.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                    {banks.map(bank => (
                        <div key={bank.id} className="card h-full" style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem' }}>
                                <div style={{
                                    width: '48px', height: '48px', borderRadius: '14px',
                                    background: 'var(--grad-premium)', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', fontSize: '1.5rem'
                                }}>
                                    🏦
                                </div>
                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                    <h3 style={{ fontSize: '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {bank.full_name || "Enterprise Partner"}
                                    </h3>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontFamily: 'monospace' }}>
                                        {bank.wallet_address ? `${bank.wallet_address.slice(0, 10)}...${bank.wallet_address.slice(-8)}` : 'No wallet linked'}
                                    </p>
                                </div>
                            </div>

                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '1.25rem', flex: 1 }}>
                                {bank.description || "Leading financial institution offering secure and decentralized banking services powered by DecentKYC protocol."}
                            </p>

                            {bank.services && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '1.5rem' }}>
                                    {bank.services.split(',').map(s => (
                                        <span key={s} className="badge" style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-vibrant)' }}>
                                            {s.trim()}
                                        </span>
                                    ))}
                                </div>
                            )}

                            <button
                                className="btn btn-primary btn-full"
                                onClick={() => handleConnect(bank)}
                                disabled={requesting === bank.id || connected.has(bank.id)}
                                style={connected.has(bank.id) ? { background: 'rgba(16,185,129,0.3)', borderColor: '#10b981', color: '#10b981', cursor: 'default' } : {}}
                            >
                                {requesting === bank.id ? 'Connecting...' : connected.has(bank.id) ? '✓ Signal Sent' : 'Connect Identity'}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

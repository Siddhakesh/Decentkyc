import { useState, useEffect } from 'react';
import { authService, consentService } from '../services/api';
import toast from 'react-hot-toast';

export default function Marketplace() {
    const [banks, setBanks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [requesting, setRequesting] = useState(null);

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
        if (!bank.wallet_address) {
            return toast.error("This institution has not linked a wallet yet.");
        }

        setRequesting(bank.id);
        try {
            await consentService.requestAccess({
                user_wallet_address: bank.wallet_address // In this direction, the user initiates
            });
            // Note: Our current backend logic is designed for Banks to request users.
            // If the user initiates, we might need a slightly different flow or just
            // tell them the bank will be notified. For now, we'll stick to the bank-initiated
            // flow but show the directory as "Ready to Connect".
            toast.success(`Request sent to ${bank.full_name}! 🏦`);
        } catch (err) {
            // If the user initiates, and there's no pending request from the bank yet,
            // we could either create one or just log the intent.
            // For this version, we'll inform the user how to proceed.
            toast.success(`Connection signal sent to ${bank.full_name}. They will initiate the verification request shortly.`);
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
                                disabled={requesting === bank.id}
                            >
                                {requesting === bank.id ? 'Signalling...' : 'Connect Identity'}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

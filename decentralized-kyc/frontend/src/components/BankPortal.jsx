import { useState, useEffect } from 'react';
import { consentService } from '../services/api';
import toast from 'react-hot-toast';

export default function BankPortal() {
    const [searchAddress, setSearchAddress] = useState('');
    const [requesting, setRequesting] = useState(false);
    const [grantedList, setGrantedList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);
    const [viewingData, setViewingData] = useState(false);

    useEffect(() => {
        fetchGrantedList();
    }, []);

    const fetchGrantedList = async () => {
        try {
            const res = await consentService.getGrantedList();
            setGrantedList(res.data);
        } catch (err) {
            console.error("Failed to fetch granted list:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleRequest = async (e) => {
        e.preventDefault();
        if (!searchAddress.startsWith('0x')) {
            return toast.error("Please enter a valid Ethereum wallet address");
        }

        setRequesting(true);
        try {
            await consentService.requestAccess({
                user_wallet_address: searchAddress
            });
            toast.success("Access request submitted to user! 🔐");
            setSearchAddress('');
        } catch (err) {
            toast.error(err.response?.data?.detail || "Request failed");
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
            toast.error(err.response?.data?.detail || "Could not retrieve KYC data");
        } finally {
            setViewingData(false);
        }
    };

    return (
        <div className="animate-in">
            <div className="page-header">
                <div>
                    <h2>Bank <span className="gradient-text">Verification Portal</span></h2>
                    <p className="page-subtitle">Securely request and manage customer KYC disclosures</p>
                </div>
                <div className="badge badge-success">Institutional Access</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '2rem' }}>
                {/* Left Col: Request Access */}
                <div className="card" style={{ height: 'fit-content' }}>
                    <h3 style={{ marginBottom: '1.25rem' }}>🔍 Search Customer</h3>
                    <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                        Enter a wallet address to request a verified identity disclosure.
                    </p>
                    <form onSubmit={handleRequest}>
                        <div className="form-group">
                            <label>Customer Wallet Address</label>
                            <input
                                className="input"
                                type="text"
                                placeholder="0x..."
                                value={searchAddress}
                                onChange={(e) => setSearchAddress(e.target.value)}
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            className="btn btn-primary btn-full"
                            disabled={requesting}
                        >
                            {requesting ? 'Processing...' : 'Request KYC Access'}
                        </button>
                    </form>
                </div>

                {/* Right Col: Active Consents */}
                <div className="card">
                    <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        🛡️ Active Consents
                        <button className="btn btn-secondary btn-sm" onClick={fetchGrantedList}>↻ Refresh</button>
                    </h3>

                    {loading ? (
                        <div className="pulse" style={{ height: '100px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}></div>
                    ) : grantedList.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                            <p>No active consents found.</p>
                            <span style={{ fontSize: '0.8rem' }}>Once users grant access, they will appear here.</span>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {grantedList.map(item => (
                                <div key={item.user_wallet_address} style={{
                                    padding: '1.25rem', borderRadius: '12px', background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                }}>
                                    <div>
                                        <p style={{ fontWeight: 700, color: 'var(--text-vibrant)', fontSize: '0.95rem' }}>{item.user_full_name}</p>
                                        <p style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--accent-cyan)', marginTop: '4px' }}>
                                            {item.user_wallet_address.slice(0, 12)}...{item.user_wallet_address.slice(-10)}
                                        </p>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                                            Granted: {new Date(item.granted_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <button
                                        className="btn btn-primary btn-sm"
                                        onClick={() => viewUserKyc(item.user_wallet_address)}
                                        disabled={viewingData && selectedUser?.wallet_address === item.user_wallet_address}
                                    >
                                        View Data
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* KYC Details Modal-like view */}
            {selectedUser && (
                <div className="animate-in card" style={{ marginTop: '2.5rem', borderLeft: '4px solid var(--accent-green)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h3>📋 KYC Compliance Report</h3>
                        <button className="btn btn-secondary btn-sm" onClick={() => setSelectedUser(null)}>✕ Close Report</button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                        <div className="card-inner" style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
                            <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Full Identity</p>
                            <p style={{ fontWeight: 600, marginTop: '4px' }}>{selectedUser.full_name}</p>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{selectedUser.email}</p>
                        </div>
                        <div className="card-inner" style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
                            <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Verification Status</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                                <span className="badge badge-success">VERIFIED</span>
                                <span style={{ fontSize: '0.8rem' }}>Score: {selectedUser.liveness_score}%</span>
                            </div>
                        </div>
                        <div className="card-inner" style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
                            <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Document Details</p>
                            <p style={{ fontWeight: 600, marginTop: '4px', textTransform: 'uppercase' }}>{selectedUser.id_type}</p>
                            <p style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{selectedUser.id_number}</p>
                        </div>
                    </div>

                    <div style={{ marginTop: '1.5rem', padding: '1rem', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                        <p style={{ fontSize: '0.85rem', lineHeight: '1.6' }}>
                            🛡️ <strong>Compliance Audit:</strong> This document was matched against a live biometric selfie on {new Date(selectedUser.last_verified).toLocaleString()} with a matching confidence of <strong>{selectedUser.liveness_score}%</strong>. The document hash is cryptographically anchored to the blockchain.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * src/components/BankPortal.jsx
 * ────────────
 * Premium portal for financial institutions to manage KYC requests.
 */
import { useState } from 'react';
import { consentService } from '../services/api';
import toast from 'react-hot-toast';

export default function BankPortal() {
    const [searchAddress, setSearchAddress] = useState('');
    const [requesting, setRequesting] = useState(false);

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

    return (
        <div className="animate-in">
            <div className="page-header">
                <div>
                    <h2>Bank <span className="gradient-text">Verification Portal</span></h2>
                    <p className="page-subtitle">Securely request and manage customer KYC disclosures</p>
                </div>
                <div className="badge badge-success">Bank Access Level</div>
            </div>

            <div className="card" style={{ maxWidth: '600px', margin: '0 0 2rem' }}>
                <h3 style={{ marginBottom: '1.25rem' }}>🔍 Search Customer</h3>
                <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                    Enter the public wallet address of the customer to request their verified KYC details.
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
                        {requesting ? 'Processing Request...' : 'Request KYC Access'}
                    </button>
                </form>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="card" style={{ borderLeft: '4px solid var(--accent-blue)' }}>
                    <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>🛡️ Compliance Standard</h3>
                    <p style={{ fontSize: '0.85rem' }}>
                        All requests are logged on-chain. Decryption is only possible if the user provides a cryptographic signature.
                        This eliminates centralized data breaches.
                    </p>
                </div>
                <div className="card" style={{ borderLeft: '4px solid var(--accent-amber)' }}>
                    <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>🏛️ Regulatory Alignment</h3>
                    <p style={{ fontSize: '0.85rem' }}>
                        Designed for GDPR (Right to Access) and RBI 2024 (Digital KYC Guidelines). Immutable logs provide a complete paper-trail for auditors.
                    </p>
                </div>
            </div>
        </div>
    );
}

/**
 * src/components/WalletLogin.jsx
 * ────────────
 * Unified login/registration screen with a premium glassmorphism design.
 * Features:
 * - Animated mode switching
 * - In-context guidance for passwords
 * - Visual wallet connection status
 */
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function WalletLogin({ onSuccess }) {
    const { login, register, walletAddress, connectWallet } = useAuth();
    const [mode, setMode] = useState('login'); // 'login' or 'register'
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        email: '',
        password: '',
        full_name: '',
        role: 'user', // Default role
        wallet_address: '',
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        console.log(`[WalletLogin] Attempting ${mode}...`, { email: form.email, role: form.role });
        try {
            if (mode === 'login') {
                const res = await login(form.email, form.password);
                console.log('[WalletLogin] Login successful!', res);
                toast.success('Welcome back!');
                setTimeout(() => {
                    console.log('[WalletLogin] Executing onSuccess callback...');
                    onSuccess?.();
                }, 100);
            } else {
                // Strip empty wallet_address — backend pattern validator rejects ""
                const payload = { ...form, wallet_address: walletAddress || undefined };
                if (!payload.wallet_address) delete payload.wallet_address;

                console.log('[WalletLogin] Registering as role:', form.role);
                await register(payload);
                console.log('[WalletLogin] Registration successful!');
                toast.success(`${form.role === 'bank' ? 'Bank' : 'User'} account created! 🎉`);
                setTimeout(() => {
                    console.log('[WalletLogin] Executing onSuccess callback after register...');
                    onSuccess?.();
                }, 100);
            }
        } catch (err) {
            console.error(`[WalletLogin] ${mode} failed:`, err);
            const detail = err.response?.data?.detail;
            const msg = Array.isArray(detail)
                ? detail.map(d => d.msg || d).join(', ')
                : (detail || err.message || 'Authentication failed');
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page" style={{
            height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem'
        }}>
            <div className="card animate-in" style={{ width: '100%', maxWidth: '440px', padding: '2.5rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div className="logo-icon" style={{ margin: '0 auto 1rem' }}>🔐</div>
                    <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>
                        {mode === 'login' ? 'Sign In' : 'Create Account'}
                    </h2>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        {mode === 'login'
                            ? 'Access your decentralized identity portal'
                            : 'Join the zero-trust KYC revolution'}
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    {mode === 'register' && (
                        <>
                            <div className="form-group">
                                <label>What best describes you?</label>
                                <select
                                    className="input"
                                    value={form.role}
                                    onChange={e => setForm({ ...form, role: e.target.value })}
                                    style={{ marginBottom: '1rem' }}
                                >
                                    <option value="user">I am an Individual (User)</option>
                                    <option value="bank">I am a Financial Institution (Bank)</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>{form.role === 'bank' ? 'Institution Name' : 'Full Name'}</label>
                                <input
                                    className="input"
                                    type="text"
                                    placeholder={form.role === 'bank' ? "Global Bank Corp" : "John Doe"}
                                    required
                                    value={form.full_name}
                                    onChange={e => setForm({ ...form, full_name: e.target.value })}
                                />
                            </div>
                        </>
                    )}

                    <div className="form-group">
                        <label>Email Address</label>
                        <input
                            className="input"
                            type="email"
                            placeholder="name@company.com"
                            required
                            value={form.email}
                            onChange={e => setForm({ ...form, email: e.target.value })}
                        />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <input
                            className="input"
                            type="password"
                            placeholder="••••••••"
                            required
                            value={form.password}
                            onChange={e => setForm({ ...form, password: e.target.value })}
                        />
                        {mode === 'register' && (
                            <p style={{ fontSize: '0.7rem', marginTop: '0.5rem', color: 'var(--accent-cyan)' }}>
                                Tip: 8+ chars, 1 uppercase, 1 digit
                            </p>
                        )}
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <div style={{
                            padding: '1rem', borderRadius: 'var(--radius-md)',
                            background: walletAddress ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${walletAddress ? 'rgba(16, 185, 129, 0.2)' : 'var(--border-glass)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                        }}>
                            <div>
                                <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                    MetaMask {walletAddress ? 'Connected' : 'Required'}
                                </p>
                                {walletAddress && (
                                    <p style={{ fontSize: '0.75rem', color: 'var(--accent-green)', fontFamily: 'monospace', marginTop: '2px' }}>
                                        {walletAddress.slice(0, 10)}...{walletAddress.slice(-8)}
                                    </p>
                                )}
                            </div>
                            {!walletAddress && (
                                <button type="button" className="btn btn-secondary btn-sm" onClick={connectWallet} style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>
                                    🦊 Connect
                                </button>
                            )}
                        </div>
                    </div>

                    <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
                        {loading ? 'Processing...' : (mode === 'login' ? 'Sign In To Portal' : 'Register Account')}
                    </button>
                </form>

                <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                    <p style={{ fontSize: '0.9rem' }}>
                        {mode === 'login' ? "Don't have an account?" : "Already have an account?"}
                        <button
                            className="gradient-text"
                            style={{
                                background: 'none', border: 'none', padding: '0 0.5rem',
                                fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit'
                            }}
                            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                        >
                            {mode === 'login' ? 'Create one' : 'Sign in'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
}

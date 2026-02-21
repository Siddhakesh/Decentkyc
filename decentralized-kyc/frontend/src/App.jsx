/**
 * src/App.jsx
 * ────────────
 * Main application with sidebar navigation and routing.
 * Integrates the new dynamic Dashboard and premium design system.
 */
import { useState, Component } from 'react';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './context/AuthContext';
import WalletLogin from './components/WalletLogin';
import KYCUpload from './components/KYCUpload';
import ConsentApproval from './components/ConsentApproval';
import AccessHistory from './components/AccessHistory';
import BankPortal from './components/BankPortal';
import Dashboard from './components/Dashboard';
import LivenessCheck from './components/LivenessCheck';

// ── ErrorBoundary ─────────────────────────────────────────────────────────────
class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }
    static getDerivedStateFromError(error) { return { error }; }
    render() {
        if (this.state.error) {
            return (
                <div style={{
                    padding: '3rem', margin: '2rem', borderRadius: 'var(--radius-lg)',
                    background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)',
                    color: 'var(--text-primary)', textAlign: 'center'
                }}>
                    <h3 style={{ color: 'var(--accent-red)', marginBottom: '1rem' }}>⚠️ System Encountered an Issue</h3>
                    <p style={{ fontFamily: 'monospace', fontSize: '0.9rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
                        {this.state.error?.message}
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="btn btn-primary"
                        style={{ marginTop: '2rem' }}
                    >
                        Reload Application
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

// ── Navigation config by role ─────────────────────────────────────────────────
const NAV = {
    user: [
        { id: 'dashboard', icon: '⬡', label: 'Dashboard' },
        { id: 'upload', icon: '📄', label: 'Upload KYC' },
        { id: 'liveness', icon: '📸', label: 'Liveness Check' },
        { id: 'consent', icon: '🔓', label: 'Consent Requests' },
        { id: 'history', icon: '📋', label: 'Access History' },
    ],
    bank: [
        { id: 'portal', icon: '🏦', label: 'KYC Requests' },
        { id: 'history', icon: '📋', label: 'Audit Log' },
    ],
    validator: [
        { id: 'history', icon: '📋', label: 'Audit Log' },
    ],
};

export default function App() {
    const { isAuthenticated, user, logout, walletAddress, connectWallet } = useAuth();
    const [page, setPage] = useState('dashboard');

    if (!isAuthenticated) {
        return (
            <>
                <Toaster position="top-right" toastOptions={{
                    style: { background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }
                }} />
                <WalletLogin onSuccess={() => setPage('dashboard')} />
            </>
        );
    }

    const role = user?.role || 'user';
    const navItems = NAV[role] || NAV.user;

    // Resolve which page to show as the "default" if user lands on dashboard
    // Banks go to portal, others go to dashboard.
    let effectivePage = page;
    if (page === 'dashboard' && role === 'bank') {
        effectivePage = 'portal';
    }

    const renderPage = () => {
        console.log(`[App] Rendering page: ${effectivePage} for role: ${role}`);
        try {
            switch (effectivePage) {
                case 'upload': return <ErrorBoundary><KYCUpload onSuccess={() => setPage('liveness')} /></ErrorBoundary>;
                case 'liveness': return <ErrorBoundary><LivenessCheck onComplete={() => setPage('dashboard')} /></ErrorBoundary>;
                case 'consent': return <ErrorBoundary><ConsentApproval /></ErrorBoundary>;
                case 'history': return <ErrorBoundary><AccessHistory /></ErrorBoundary>;
                case 'portal': return <ErrorBoundary><BankPortal /></ErrorBoundary>;
                case 'dashboard': return <ErrorBoundary><Dashboard user={user} /></ErrorBoundary>;
                default:
                    console.warn(`[App] Unknown page: ${effectivePage}, falling back to dashboard`);
                    return <ErrorBoundary><Dashboard user={user} /></ErrorBoundary>;
            }
        } catch (err) {
            console.error("[App] Render crash:", err);
            return (
                <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                    <h3 style={{ color: 'var(--accent-red)' }}>⚠️ Rendering Error</h3>
                    <p>{err.message}</p>
                    <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setPage('dashboard')}>
                        Return to Dashboard
                    </button>
                </div>
            );
        }
    };

    return (
        <>
            <Toaster position="top-right" toastOptions={{
                style: { background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }
            }} />
            <div className="app-layout">

                {/* ── Sidebar ─────────────────────────────────────────────────────── */}
                <aside className="sidebar">
                    <div className="sidebar-logo">
                        <div className="logo-icon">🔐</div>
                        <span>DecentKYC</span>
                    </div>

                    <nav style={{ flex: 1 }}>
                        <p className="nav-section-label">Main Menu</p>
                        {navItems.map(item => (
                            <a
                                key={item.id}
                                className={`nav-item ${effectivePage === item.id ? 'active' : ''}`}
                                onClick={() => setPage(item.id)}
                            >
                                <span className="nav-icon">{item.icon}</span>
                                {item.label}
                            </a>
                        ))}
                    </nav>

                    {/* Wallet Section */}
                    <div style={{
                        padding: '1.25rem', borderRadius: 'var(--radius-md)',
                        background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)',
                        marginBottom: '1.5rem',
                    }}>
                        {walletAddress ? (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-green)', boxShadow: '0 0 8px var(--accent-green)' }}></div>
                                    <p style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Secure Wallet
                                    </p>
                                </div>
                                <p style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-display)', fontWeight: 600 }}>
                                    {walletAddress.slice(0, 10)}...{walletAddress.slice(-8)}
                                </p>
                            </>
                        ) : (
                            <button className="btn btn-secondary btn-sm btn-full" onClick={connectWallet} style={{ fontSize: '0.8rem' }}>
                                🦊 Connect MetaMask
                            </button>
                        )}
                    </div>

                    {/* User info + logout */}
                    <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem' }}>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '12px',
                                background: 'var(--grad-premium)', display: 'flex', alignItems: 'center',
                                fontSize: '1.2rem', fontWeight: 800, color: 'white', justifyContent: 'center'
                            }}>
                                {user?.email?.[0]?.toUpperCase() || 'U'}
                            </div>
                            <div style={{ overflow: 'hidden' }}>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-vibrant)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {user?.full_name || user?.email?.split('@')?.[0]}
                                </p>
                                <span className={`badge ${role === 'bank' ? 'badge-success' :
                                    role === 'validator' ? 'badge-pending' : 'badge-info'
                                    }`} style={{ fontSize: '0.6rem', padding: '0.15rem 0.6rem', marginTop: '2px' }}>
                                    {role}
                                </span>
                            </div>
                        </div>
                        <button className="btn btn-secondary btn-sm btn-full" onClick={logout}>
                            ↩ Sign Out
                        </button>
                    </div>
                </aside>

                {/* ── Main Content ─────────────────────────────────────────────────── */}
                <main className="main-content">
                    {renderPage()}
                </main>
            </div>
        </>
    );
}

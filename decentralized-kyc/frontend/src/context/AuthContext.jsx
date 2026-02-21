/**
 * src/context/AuthContext.jsx
 * ────────────────────────────
 * Global auth state: JWT token, user info, wallet address.
 *
 * SECURITY:
 * - JWT stored in memory (not localStorage) to avoid XSS theft.
 * - Wallet private key NEVER stored here — only the public address.
 * - Ethereum private key stays in MetaMask / browser wallet.
 */
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [token, setToken] = useState(null);   // JWT in memory only
    const [user, setUser] = useState(null);
    const [walletAddress, setWalletAddress] = useState(null);

    // ── Wallet Listeners ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!window.ethereum) return;

        // Auto-check on mount
        window.ethereum.request({ method: 'eth_accounts' })
            .then(accounts => {
                if (accounts.length > 0) setWalletAddress(accounts[0]);
            })
            .catch(console.error);

        const handleAccounts = (accounts) => {
            if (accounts.length > 0) {
                setWalletAddress(accounts[0]);
                toast.success('Wallet switched');
            } else {
                setWalletAddress(null);
                toast('Wallet disconnected');
            }
        };

        const handleChain = () => window.location.reload();

        window.ethereum.on('accountsChanged', handleAccounts);
        window.ethereum.on('chainChanged', handleChain);

        return () => {
            window.ethereum.removeListener('accountsChanged', handleAccounts);
            window.ethereum.removeListener('chainChanged', handleChain);
        };
    }, []);

    const login = useCallback(async (email, password) => {
        console.log("[AuthContext] Initiating login for:", email);
        try {
            const res = await api.post('/auth/login', { email, password });
            console.log("[AuthContext] Login response received:", res.data);

            const { access_token, role } = res.data;

            // Decode role from JWT payload as fallback if not in response body
            let userRole = role;
            if (!userRole && access_token) {
                try {
                    const payload = JSON.parse(atob(access_token.split('.')[1]));
                    console.log("[AuthContext] Decoded JWT payload:", payload);
                    userRole = payload.role || 'user';
                } catch (e) {
                    console.error("[AuthContext] JWT decode failed:", e);
                    userRole = 'user';
                }
            }

            console.log("[AuthContext] Final User Role:", userRole);
            setToken(access_token);
            setUser({ email, role: userRole });

            // Set global auth header
            api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
            console.log("[AuthContext] Auth state updated successfully.");
            return res.data;
        } catch (err) {
            console.error("[AuthContext] Login call failed:", err);
            throw err;
        }
    }, []);

    /**
     * Register then auto-login — avoids the "please log in again" friction.
     */
    const register = useCallback(async (data) => {
        await api.post('/auth/register', data);
        // Auto-login so the user lands on the dashboard immediately
        return await login(data.email, data.password);
    }, [login]);

    const logout = useCallback(() => {
        setToken(null);
        setUser(null);
        setWalletAddress(null);
        delete api.defaults.headers.common['Authorization'];
    }, []);

    /**
     * Connect MetaMask wallet.
     * FALLBACK: If MetaMask is missing, use a deterministic "Demo Wallet".
     */
    const connectWallet = useCallback(async () => {
        try {
            if (!window.ethereum) {
                console.warn("[AuthContext] MetaMask missing. Enabling Demo Wallet mode.");
                // Use a deterministic mock address for the current user
                const mockAddr = `0xDEMO_${user?.email?.split('@')[0] || 'anonymous'}_7f2d`;
                setWalletAddress(mockAddr);
                toast.success('Connected to Demo Wallet 🎓');
                return mockAddr;
            }

            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            if (accounts.length === 0) {
                toast.error('No accounts found');
                return null;
            }
            setWalletAddress(accounts[0]);
            toast.success('Wallet connected!');
            return accounts[0];
        } catch (err) {
            console.error('Wallet connection error:', err);
            toast.error(err.code === 4001 ? 'Connection rejected' : 'Failed to connect wallet');
            throw err;
        }
    }, [user]);

    /**
     * Sign a consent message.
     * FALLBACK: Returns a mock signature if in Demo Wallet mode.
     */
    const signConsent = useCallback(async (message) => {
        try {
            if (!walletAddress) throw new Error('Wallet not connected');

            if (walletAddress.startsWith('0xDEMO_')) {
                console.log("[AuthContext] Demo Mode: Signing with mock signature.");
                // Return a valid-looking but mock signature
                return "0x_mock_signature_" + Math.random().toString(16).slice(2, 10);
            }

            const signature = await window.ethereum.request({
                method: 'personal_sign',
                params: [message, walletAddress],
            });
            return signature;
        } catch (err) {
            console.error('Signing error:', err);
            toast.error(err.code === 4001 ? 'Signing rejected' : 'Failed to sign message');
            throw err;
        }
    }, [walletAddress]);

    return (
        <AuthContext.Provider value={{
            token, user, walletAddress,
            login, register, logout, connectWallet, signConsent,
            isAuthenticated: !!token,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};

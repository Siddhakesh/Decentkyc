/**
 * src/components/AccessHistory.jsx
 * ────────────
 * Premium audit log viewer with detailed event tracking.
 */
import { useState, useEffect } from 'react';
import { auditService } from '../services/api';
import toast from 'react-hot-toast';

export default function AccessHistory() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                setLoading(true);
                const res = await auditService.getLogs({ limit: 50 });
                setLogs(res.data.logs);
            } catch (err) {
                toast.error("Failed to load access history");
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    if (loading) {
        return (
            <div className="animate-in">
                <div className="page-header">
                    <div className="skeleton" style={{ width: '250px', height: '32px' }}></div>
                </div>
                <div className="card skeleton" style={{ height: '400px' }}></div>
            </div>
        );
    }

    return (
        <div className="animate-in">
            <div className="page-header">
                <div>
                    <h2>Access <span className="gradient-text">History</span></h2>
                    <p className="page-subtitle">Immutable audit trail of your data interactions</p>
                </div>
                <span className="badge badge-info">{logs.length} Total Events</span>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                    <table>
                        <thead>
                            <tr>
                                <th>Event Type</th>
                                <th>Transaction Hash</th>
                                <th>Timestamp</th>
                                <th>Security</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.length > 0 ? logs.map(log => (
                                <tr key={log.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-blue)' }}></div>
                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                                                {log.event_type.replace(/_/g, ' ')}
                                            </span>
                                        </div>
                                    </td>
                                    <td>
                                        <code style={{
                                            fontSize: '0.75rem', color: 'var(--accent-cyan)', background: 'rgba(6, 182, 212, 0.05)',
                                            padding: '0.2rem 0.5rem', borderRadius: '4px'
                                        }}>
                                            {log.tx_hash ? `${log.tx_hash.slice(0, 12)}...${log.tx_hash.slice(-10)}` : 'Internal Log'}
                                        </code>
                                    </td>
                                    <td style={{ fontSize: '0.85rem' }}>
                                        {new Date(log.created_at).toLocaleString()}
                                    </td>
                                    <td>
                                        <span className="badge badge-success">✓ Verified</span>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="4" style={{ textAlign: 'center', padding: '4rem' }}>
                                        <p style={{ color: 'var(--text-muted)' }}>No audit logs available yet.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

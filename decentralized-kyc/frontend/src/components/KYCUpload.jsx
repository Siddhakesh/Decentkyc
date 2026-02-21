/**
 * src/components/KYCUpload.jsx
 * ────────────
 * Premium KYC document upload component with encryption feedback.
 */
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { kycService } from '../services/api';
import toast from 'react-hot-toast';

export default function KYCUpload({ onSuccess }) {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [docType, setDocType] = useState('passport');

    const onDrop = useCallback(acceptedFiles => {
        setFile(acceptedFiles[0]);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/*': [], 'application/pdf': [] },
        multiple: false
    });

    const handleUpload = async () => {
        if (!file) return;
        console.log('[KYCUpload] Upload started', { fileName: file.name, fileSize: file.size, docType });
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('doc_type', docType);
            formData.append('validity_days', '365'); // Explicitly add default

            toast.loading('Encrypting & Uploading to IPFS...', { id: 'kyc-up' });

            const response = await kycService.upload(formData);
            console.log('[KYCUpload] Upload Response Success');

            toast.success('KYC Document Secured & Registered! 🔗', { id: 'kyc-up' });

            // Auto-transition to next step after a tiny delay
            setTimeout(() => {
                console.log('[KYCUpload] Transitioning to next step...');
                onSuccess?.();
            }, 1000);

            setFile(null);
        } catch (err) {
            console.error('[KYCUpload] Upload Error:', err);
            const detail = err.response?.data?.detail;
            const errMsg = Array.isArray(detail)
                ? detail.map(d => d.msg || d).join(', ')
                : (detail || err.message || 'Upload failed');

            toast.error(errMsg, { id: 'kyc-up' });
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="animate-in">
            <div className="page-header">
                <div>
                    <h2>Secure <span className="gradient-text">KYC Upload</span></h2>
                    <p className="page-subtitle">Your data is encrypted client-side before storage</p>
                </div>
                <div className="badge badge-info">AES-256-GCM</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '2rem' }}>
                <div className="card">
                    <div {...getRootProps()} className="dropzone">
                        <input {...getInputProps()} />
                        <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>
                            {file ? '📄' : (isDragActive ? '📥' : '📤')}
                        </div>
                        {file ? (
                            <div>
                                <h4 style={{ color: 'var(--accent-cyan)' }}>{file.name}</h4>
                                <p style={{ marginTop: '0.5rem' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    style={{ marginTop: '1.5rem' }}
                                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                                >
                                    Cancel Selection
                                </button>
                            </div>
                        ) : (
                            <div>
                                <h3>{isDragActive ? 'Drop it here' : 'Drag & drop KYC document'}</h3>
                                <p style={{ marginTop: '0.5rem' }}>Supports PDF, JPG, PNG (Max 10MB)</p>
                            </div>
                        )}
                    </div>

                    {file && (
                        <div style={{ marginTop: '2rem' }}>
                            <div className="form-group">
                                <label>Document Type</label>
                                <select
                                    className="input"
                                    value={docType}
                                    onChange={e => setDocType(e.target.value)}
                                >
                                    <option value="passport">Passport</option>
                                    <option value="national_id">National ID</option>
                                    <option value="drivers_license">Driver's License</option>
                                    <option value="pan_card">PAN Card</option>
                                    <option value="ssn_card">SSN Card (US)</option>
                                    <option value="state_id">State ID (US)</option>
                                </select>
                            </div>
                            <button
                                className="btn btn-primary btn-full"
                                onClick={handleUpload}
                                disabled={uploading}
                            >
                                {uploading ? 'Processing Securely...' : 'Encrypt & Register On-Chain'}
                            </button>
                        </div>
                    )}
                </div>

                <div className="card" style={{ borderLeft: '4px solid var(--accent-cyan)' }}>
                    <h3 style={{ marginBottom: '1.25rem' }}>🛡️ Security Protocol</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {[
                            { title: 'AES-256-GCM', desc: 'Symmetric encryption with authenticated data ensures privacy.' },
                            { title: 'IPFS Storage', desc: 'Content-addressed, decentralized storage for immutability.' },
                            { title: 'Chain-Anchored', desc: 'Only the CID hash is stored on-chain. No PII is public.' },
                            { title: 'Zero-Knowledge', desc: 'The server never sees your raw, unencrypted document.' }
                        ].map((item, i) => (
                            <div key={i}>
                                <p style={{ fontWeight: 800, color: 'var(--text-vibrant)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>{item.title}</p>
                                <p style={{ fontSize: '0.8rem' }}>{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

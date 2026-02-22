/**
 * src/components/KYCUpload.jsx
 * ────────────
 * KYC document upload with inline Photo ID Identifier.
 * After upload, automatically runs /kyc/identify and displays
 * OpenCV-powered analysis: sharpness, brightness, ID region,
 * confidence score, and a document thumbnail.
 */
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { kycService } from '../services/api';
import toast from 'react-hot-toast';

// ── Progress bar helper ────────────────────────────────────────────────────────
function Bar({ value, color = '#6366f1', label }) {
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</span>
                <span style={{ fontSize: '0.75rem', color, fontWeight: 700 }}>{value}/100</span>
            </div>
            <div style={{ height: '6px', borderRadius: '9999px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                <div style={{
                    height: '100%', width: `${value}%`, borderRadius: '9999px',
                    background: color, transition: 'width 1s ease',
                }} />
            </div>
        </div>
    );
}

// ── Check row ──────────────────────────────────────────────────────────────────
function CheckRow({ label, ok }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ fontSize: '0.9rem' }}>{ok ? '✅' : '❌'}</span>
            <span style={{ fontSize: '0.82rem', color: ok ? 'var(--text-primary)' : 'var(--text-muted)' }}>{label}</span>
        </div>
    );
}

// ── ID Analysis Panel ──────────────────────────────────────────────────────────
function IDAnalysisPanel({ result, onDone }) {
    const a = result.analysis;
    const isPDF = result.format === 'pdf';

    const statusColor = a.status === 'pass' ? '#10b981' : a.status === 'warn' ? '#facc15' : '#ef4444';
    const statusLabel = a.status === 'pass' ? '✅ Document Accepted' : a.status === 'warn' ? '⚠️ Needs Improvement' : '❌ Low Quality — Re-upload';

    return (
        <div className="animate-in" style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                <div style={{
                    width: '48px', height: '48px', borderRadius: '14px',
                    background: `${statusColor}22`, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '1.5rem',
                }}>🪪</div>
                <div>
                    <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Photo ID Analysis</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {result.doc_type?.replace('_', ' ')?.toUpperCase()}
                    </p>
                </div>
                <span style={{
                    marginLeft: 'auto', padding: '6px 14px', borderRadius: '9999px',
                    background: `${statusColor}22`, color: statusColor,
                    fontSize: '0.8rem', fontWeight: 700, border: `1px solid ${statusColor}44`,
                }}>
                    {statusLabel}
                </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isPDF ? '1fr' : '200px 1fr', gap: '1.5rem' }}>

                {/* Thumbnail */}
                {!isPDF && a.thumbnail_b64 && (
                    <div>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Document Preview</p>
                        <img
                            src={`data:image/jpeg;base64,${a.thumbnail_b64}`}
                            alt="ID thumbnail"
                            style={{
                                width: '100%', borderRadius: '10px',
                                border: `2px solid ${statusColor}55`,
                                filter: 'brightness(0.9) contrast(1.05)',
                            }}
                        />
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '6px', textAlign: 'center' }}>
                            {a.width} × {a.height}px · {(a.size_bytes / 1024).toFixed(1)} KB
                        </p>
                    </div>
                )}

                <div>
                    {/* Confidence */}
                    <div style={{ marginBottom: '1.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>Overall Confidence</span>
                            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: statusColor }}>{a.confidence}%</span>
                        </div>
                        <div style={{ height: '10px', borderRadius: '9999px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                            <div style={{
                                height: '100%', width: `${a.confidence}%`, borderRadius: '9999px',
                                background: `linear-gradient(90deg, ${statusColor}, ${statusColor}aa)`,
                                transition: 'width 1.2s ease',
                            }} />
                        </div>
                    </div>

                    {/* Metric bars */}
                    {!isPDF && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
                            <Bar label="Sharpness" value={a.sharpness ?? 0} color="#6366f1" />
                            <Bar label="Brightness" value={Math.min(100, Math.round((a.brightness / 255) * 100))} color="#06b6d4" />
                            <Bar label="Contrast" value={Math.min(100, a.contrast ?? 0)} color="#f59e0b" />
                        </div>
                    )}

                    {/* Check list */}
                    <div style={{ marginBottom: '1rem' }}>
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Quality Checks</p>
                        {a.checks && Object.entries({
                            'Sharp / In Focus': a.checks.sharp_enough,
                            'Proper Resolution': a.checks.proper_size,
                            'Good Lighting': a.checks.not_too_dark && a.checks.not_too_bright,
                            'ID Region Detected': a.checks.id_region_detected,
                            'Colour Scan': a.checks.colour_scan,
                        }).map(([label, ok]) => (
                            <CheckRow key={label} label={label} ok={ok} />
                        ))}
                        {isPDF && <CheckRow label="Readable PDF" ok={a.checks?.readable} />}
                    </div>

                    {/* Action hints */}
                    {a.status !== 'pass' && (
                        <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)', marginBottom: '1rem' }}>
                            <p style={{ fontSize: '0.78rem', color: '#facc15' }}>
                                💡 For best results: use a well-lit, flat scan/photo with the document filling most of the frame. Avoid shadows and blur.
                            </p>
                        </div>
                    )}

                    <button className="btn btn-primary btn-full" onClick={onDone}>
                        {a.status === 'pass' ? '🎉 Continue to Dashboard' : '↺ Upload Another Document'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Main Upload Component ──────────────────────────────────────────────────────
export default function KYCUpload({ onSuccess }) {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [identifying, setIdentifying] = useState(false);
    const [docType, setDocType] = useState('passport');
    const [idResult, setIdResult] = useState(null);   // analysis result

    const onDrop = useCallback(acceptedFiles => {
        setFile(acceptedFiles[0]);
        setIdResult(null);  // reset previous result
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/*': [], 'application/pdf': [] },
        multiple: false
    });

    const handleUpload = async () => {
        if (!file) return;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('doc_type', docType);
            formData.append('validity_days', '365');

            toast.loading('Encrypting & Uploading to IPFS...', { id: 'kyc-up' });
            await kycService.upload(formData);
            toast.success('Document secured & registered! 🔗', { id: 'kyc-up' });
            setFile(null);

            // Auto-run photo ID identifier
            setIdentifying(true);
            toast.loading('Running Photo ID Analysis...', { id: 'kyc-id' });
            try {
                const res = await kycService.identifyDocument();
                setIdResult(res.data);
                toast.success('ID Analysis complete!', { id: 'kyc-id' });
            } catch (err) {
                toast.error('Analysis failed — document is still saved.', { id: 'kyc-id' });
                onSuccess?.();
            } finally {
                setIdentifying(false);
            }

        } catch (err) {
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
                    <p className="page-subtitle">Your data is AES-256 encrypted before storage. Photo ID analysis runs automatically.</p>
                </div>
                <div className="badge badge-info">AES-256-GCM</div>
            </div>

            {/* ── Upload zone (hide after analysed) ── */}
            {!idResult && (
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
                                    <select className="input" value={docType} onChange={e => setDocType(e.target.value)}>
                                        <option value="passport">🛂 Passport</option>
                                        <option value="national_id">🪪 National ID</option>
                                        <option value="drivers_license">🚗 Driver's License</option>
                                        <option value="pan_card">💳 PAN Card</option>
                                        <option value="aadhaar">🪪 Aadhaar Card</option>
                                        <option value="voter_id">🗳️ Voter ID</option>
                                        <option value="ssn_card">🔢 SSN Card (US)</option>
                                    </select>
                                </div>
                                <button
                                    className="btn btn-primary btn-full"
                                    onClick={handleUpload}
                                    disabled={uploading || identifying}
                                >
                                    {uploading ? 'Processing Securely...' : identifying ? 'Analysing...' : 'Encrypt & Register On-Chain'}
                                </button>
                            </div>
                        )}

                        {/* Identifying spinner */}
                        {identifying && (
                            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                                <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</p>
                                <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Running Photo ID Analysis…</p>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>OpenCV sharpness, brightness & region detection</p>
                            </div>
                        )}
                    </div>

                    <div className="card" style={{ borderLeft: '4px solid var(--accent-cyan)' }}>
                        <h3 style={{ marginBottom: '1.25rem' }}>🛡️ Security Protocol</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {[
                                { title: 'AES-256-GCM', desc: 'Symmetric encryption with authenticated data ensures privacy.' },
                                { title: 'IPFS Storage', desc: 'Content-addressed, decentralised storage for immutability.' },
                                { title: 'Chain-Anchored', desc: 'Only the CID hash is stored on-chain. No PII is public.' },
                                { title: 'Photo ID Check', desc: 'OpenCV analysis verifies sharpness, lighting & ID structure.' },
                            ].map((item, i) => (
                                <div key={i}>
                                    <p style={{ fontWeight: 800, color: 'var(--text-vibrant)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>{item.title}</p>
                                    <p style={{ fontSize: '0.8rem' }}>{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── ID Analysis result ── */}
            {idResult && (
                <div className="card">
                    <IDAnalysisPanel
                        result={idResult}
                        onDone={() => {
                            setIdResult(null);
                            onSuccess?.();
                        }}
                    />
                </div>
            )}
        </div>
    );
}

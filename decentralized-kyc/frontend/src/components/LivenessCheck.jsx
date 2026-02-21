/**
 * src/components/LivenessCheck.jsx
 * ────────────
 * Capture a live selfie and verify liveness via the backend CV service.
 */
import { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { kycService } from '../services/api';
import toast from 'react-hot-toast';

export default function LivenessCheck({ onComplete }) {
    const webcamRef = useRef(null);
    const [capturing, setCapturing] = useState(false);
    const [result, setResult] = useState(null);

    const capture = useCallback(async () => {
        console.log("[LivenessCheck] Attempting to capture screenshot...");
        try {
            if (!webcamRef.current) {
                console.error("[LivenessCheck] Webcam reference is null!");
                return toast.error("Camera not initialized. Please wait.");
            }

            const imageSrc = webcamRef.current.getScreenshot();
            if (!imageSrc) {
                console.error("[LivenessCheck] getScreenshot() returned null");
                return toast.error("Could not capture image from webcam. Is it active?");
            }

            console.log("[LivenessCheck] Image captured, sending to backend...");
            setCapturing(true);
            toast.loading('Analyzing liveness...', { id: 'liveness-check' });

            const res = await kycService.checkLiveness(imageSrc);
            console.log("[LivenessCheck] Analysis result:", res.data);

            setResult(res.data);
            if (res.data.is_live) {
                toast.success('Liveness Verified! ✅', { id: 'liveness-check' });
                setTimeout(() => {
                    console.log("[LivenessCheck] Verification successful, triggering onComplete...");
                    onComplete?.(res.data);
                }, 1500);
            } else {
                toast.error(res.data.message || 'Liveness check failed', { id: 'liveness-check' });
            }
        } catch (err) {
            console.error('[LivenessCheck] Capture/Analysis Error:', err);
            toast.error(err.response?.data?.detail || 'Liveness check failed', { id: 'liveness-check' });
        } finally {
            setCapturing(false);
        }
    }, [webcamRef, onComplete]);

    return (
        <div className="animate-in">
            <div className="page-header">
                <div>
                    <h2>Liveness <span className="gradient-text">Verification</span></h2>
                    <p className="page-subtitle">Verify your identity with a live photo</p>
                </div>
                <div className="badge badge-pending">Step 2: Biometrics</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '2rem' }}>
                <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                        width: '100%',
                        maxWidth: '480px',
                        aspectRatio: '4/3',
                        borderRadius: 'var(--radius-lg)',
                        overflow: 'hidden',
                        background: '#000',
                        position: 'relative',
                        border: '2px solid var(--border-glass)',
                        boxShadow: '0 0 40px rgba(0,0,0,0.5)'
                    }}>
                        {!result?.is_live && (
                            <Webcam
                                audio={false}
                                ref={webcamRef}
                                screenshotFormat="image/jpeg"
                                videoConstraints={{ width: 1280, height: 720, facingMode: "user" }}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        )}
                        {result?.is_live && (
                            <div style={{
                                width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center', background: 'rgba(16, 185, 129, 0.1)'
                            }}>
                                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
                                <h3 style={{ color: 'var(--accent-green)' }}>Verification Successful</h3>
                                <p style={{ color: 'var(--text-secondary)' }}>Score: {result.score}%</p>
                            </div>
                        )}

                        {/* Overlay scan line effect binary-style */}
                        {!result?.is_live && (
                            <div className="scan-line" style={{
                                position: 'absolute', top: 0, left: 0, width: '100%', height: '2px',
                                background: 'var(--accent-cyan)', boxShadow: '0 0 15px var(--accent-cyan)',
                                animation: 'scan 3s ease-in-out infinite'
                            }}></div>
                        )}
                    </div>

                    {!result?.is_live && (
                        <div style={{ marginTop: '2rem', width: '100%', maxWidth: '400px' }}>
                            <button
                                className="btn btn-primary btn-full"
                                onClick={capture}
                                disabled={capturing}
                            >
                                {capturing ? 'Analyzing...' : 'Capture Photo'}
                            </button>
                            <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                Position your face within the frame and ensure good lighting.
                            </p>
                        </div>
                    )}
                </div>

                <div className="card" style={{ borderLeft: '4px solid var(--accent-purple)' }}>
                    <h3 style={{ marginBottom: '1.25rem' }}>🤖 AI Verification</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {[
                            { title: 'Face Detection', desc: 'Analyzes spatial markers to confirm structural facial presence.' },
                            { title: 'Feature Matching', desc: 'Validates symmetry and key landmarks (eyes, nose, mouth).' },
                            { title: 'Liveness Score', desc: 'Ensures the capture is from a 3D subject, not a screen/print.' },
                            { title: 'Direct Submission', desc: 'Securely hashed and submitted directly to private validators.' }
                        ].map((item, i) => (
                            <div key={i}>
                                <p style={{ fontWeight: 800, color: 'var(--text-vibrant)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>{item.title}</p>
                                <p style={{ fontSize: '0.8rem' }}>{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes scan {
                    0% { top: 0%; }
                    50% { top: 100%; }
                    100% { top: 0%; }
                }
            `}</style>
        </div>
    );
}

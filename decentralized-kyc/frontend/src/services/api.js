/**
 * src/services/api.js
 * ─────────────────────
 * Axios instance pre-configured for the FastAPI backend.
 * All API calls go through this singleton.
 */
import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '',   // empty = relative, goes through Vite proxy
    timeout: 30000,
    // Removed default Content-Type to let Axios handle it dynamically (JSON vs FormData)
});

// ── Request interceptor ─────────────────────────────────────
api.interceptors.request.use(config => {
    console.log(`[API] Request: ${config.method.toUpperCase()} ${config.url}`, {
        headers: config.headers,
        data: config.data instanceof FormData ? 'FormData Object' : config.data
    });
    return config;
}, error => {
    console.error('[API] Request Error:', error);
    return Promise.reject(error);
});

// ── Response interceptor ────────────────────────────────────
api.interceptors.response.use(
    (response) => {
        console.log(`[API] Response: ${response.status} ${response.config.url}`);
        return response;
    },
    (error) => {
        console.error(`[API] Response Error: ${error.response?.status || 'Network'} ${error.config?.url}`, error);
        if (error.response?.status === 401) {
            // Token expired — clear auth state
            delete api.defaults.headers.common['Authorization'];
            window.dispatchEvent(new Event('auth:logout'));
        }
        return Promise.reject(error);
    }
);

export default api;

// ── Typed service helpers ────────────────────────────────────
export const authService = {
    register: (data) => api.post('/auth/register', data),
    login: (data) => api.post('/auth/login', data),
    getBanks: () => api.get('/auth/banks'),
};

export const kycService = {
    upload: (formData) => api.post('/kyc/upload', formData), // Let Axios set the boundary
    getStatus: () => api.get('/kyc/status'),
    checkLiveness: (imageB64) => api.post('/kyc/liveness', { image_b64: imageB64 }),
};

export const consentService = {
    requestAccess: (data) => api.post('/consent/request-access', data),
    grantAccess: (data) => api.post('/consent/grant-access', data),
    revokeAccess: (data) => api.post('/consent/revoke-access', data),
    getPending: () => api.get('/consent/pending'),
    getGrantedList: () => api.get('/consent/granted-list'),
    viewKycData: (address) => api.get(`/consent/view/${address}`),
};

export const auditService = {
    getLogs: (params) => api.get('/audit/logs', { params }),
};

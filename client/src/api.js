import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:3001/api',
});

// ===== Papers =====
export const getPapers = () => api.get('/papers').then(r => r.data);
export const getPaper = (id) => api.get(`/papers/${id}`).then(r => r.data);
export const uploadPapers = (files, onProgress) => {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    return api.post('/papers/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: onProgress,
    }).then(r => r.data);
};
export const scanFolder = (folderPath) =>
    api.post('/papers/scan-folder', { folderPath }).then(r => r.data);
export const updatePaper = (id, data) =>
    api.put(`/papers/${id}`, data).then(r => r.data);
export const deletePaper = (id) =>
    api.delete(`/papers/${id}`).then(r => r.data);
export const batchDeletePapers = (ids) =>
    api.post('/papers/batch-delete', { ids }).then(r => r.data);

// ===== Annotations =====
export const getAnnotations = (paperId) =>
    api.get(`/papers/${paperId}/annotations`).then(r => r.data);
export const createAnnotation = (paperId, data) =>
    api.post(`/papers/${paperId}/annotations`, data).then(r => r.data);
export const updateAnnotation = (id, data) =>
    api.put(`/papers/annotations/${id}`, data).then(r => r.data);
export const deleteAnnotation = (id) =>
    api.delete(`/papers/annotations/${id}`).then(r => r.data);

// ===== Links =====
export const getLinks = (paperId) =>
    api.get(`/papers/${paperId}/links`).then(r => r.data);
export const createLink = (paperId, data) =>
    api.post(`/papers/${paperId}/links`, data).then(r => r.data);
export const deleteLink = (id) =>
    api.delete(`/papers/links/${id}`).then(r => r.data);

export default api;

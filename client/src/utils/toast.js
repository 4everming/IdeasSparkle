// Simple toast utility
let toastId = 0;

export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const id = ++toastId;
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    el.id = `toast-${id}`;
    container.appendChild(el);

    setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateX(40px)';
        el.style.transition = 'all 300ms ease';
        setTimeout(() => el.remove(), 300);
    }, 3000);
}

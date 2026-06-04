// Modo nocturno controlado por SuperAdmin
(function() {
    let darkModeEnabled = false;
    
    // Función para aplicar el tema
    function applyTheme(isDark) {
        if (isDark) {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.body.classList.add('dark-mode');
        } else {
            document.documentElement.removeAttribute('data-theme');
            document.body.classList.remove('dark-mode');
        }
        darkModeEnabled = isDark;
    }
    
    // Cargar configuración desde el servidor
    async function loadDarkModeConfig() {
        try {
            const response = await fetch('/superadmin/config/dark-mode');
            const data = await response.json();
            applyTheme(data.darkMode);
        } catch (error) {
            console.error('Error al cargar configuración:', error);
            // Si hay error, usar localStorage como fallback
            const saved = localStorage.getItem('darkModeFallback');
            if (saved !== null) {
                applyTheme(saved === 'true');
            }
        }
    }
    
    // Función para cambiar modo (solo disponible para SuperAdmin)
    window.toggleDarkModeGlobal = async function() {
        // Verificar si el usuario es SuperAdmin (se puede detectar por elementos en la página)
        const isSuperAdmin = document.body.classList.contains('superadmin-view') || 
                            window.location.pathname.includes('/superadmin/');
        
        if (!isSuperAdmin) {
            console.log('Modo nocturno solo disponible para SuperAdmin');
            return;
        }
        
        const newState = !darkModeEnabled;
        
        try {
            const response = await fetch('/superadmin/config/dark-mode', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ darkMode: newState })
            });
            
            const data = await response.json();
            if (data.success) {
                applyTheme(newState);
                showNotification(newState ? '🌙 Modo nocturno activado para todos' : '☀️ Modo claro activado para todos');
                // Guardar fallback
                localStorage.setItem('darkModeFallback', newState);
            }
        } catch (error) {
            console.error('Error:', error);
            showNotification('Error al cambiar el modo', 'error');
        }
    };
    
    // Notificación
    function showNotification(message, type = 'success') {
        let toast = document.getElementById('darkModeToast');
        if (toast) toast.remove();
        
        toast = document.createElement('div');
        toast.id = 'darkModeToast';
        toast.className = 'position-fixed bottom-0 end-0 m-3 p-3 rounded-3 shadow-lg';
        toast.style.cssText = `
            background: var(--card-bg, #ffffff);
            color: var(--text-color, #1a1a2e);
            border-left: 4px solid ${type === 'success' ? '#10b981' : '#ef4444'};
            z-index: 9999;
            font-size: 0.9rem;
            font-weight: 500;
            box-shadow: var(--shadow-lg, 0 8px 24px rgba(0,0,0,0.12));
            animation: slideInRight 0.3s ease;
        `;
        toast.innerHTML = `<div class="d-flex align-items-center gap-2"><i class="bi ${type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'}"></i><span>${message}</span></div>`;
        
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
    
    // Agregar estilos de animación
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);
    
    // Inicializar
    loadDarkModeConfig();
})();
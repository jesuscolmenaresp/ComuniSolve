// Modo nocturno / diurno
(function() {
    // Verificar preferencia guardada
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Aplicar tema inicial
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.documentElement.setAttribute('data-theme', 'dark');
        updateToggleIcon('dark');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        updateToggleIcon('light');
    }
    
    // Función para actualizar el ícono del toggle
    function updateToggleIcon(theme) {
        const toggleBtn = document.getElementById('themeToggle');
        if (toggleBtn) {
            if (theme === 'dark') {
                toggleBtn.innerHTML = '<i class="bi bi-moon-stars-fill"></i>';
                toggleBtn.title = 'Modo claro';
            } else {
                toggleBtn.innerHTML = '<i class="bi bi-sun-fill"></i>';
                toggleBtn.title = 'Modo nocturno';
            }
        }
    }
    
    // Función para cambiar tema
    window.toggleTheme = function() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateToggleIcon(newTheme);
        
        // Opcional: Mostrar notificación
        showToastNotification(newTheme === 'dark' ? '🌙 Modo nocturno activado' : '☀️ Modo claro activado');
    };
    
    // Notificación elegante (opcional)
    function showToastNotification(message) {
        // Verificar si ya existe un toast
        let toast = document.getElementById('themeToast');
        if (toast) {
            toast.remove();
        }
        
        // Crear toast
        toast = document.createElement('div');
        toast.id = 'themeToast';
        toast.className = 'position-fixed bottom-0 end-0 m-3 p-3 rounded-3 shadow-lg animate__animated animate__fadeInUp';
        toast.style.cssText = `
            background: var(--card-bg);
            color: var(--text-color);
            border-left: 4px solid var(--primary-color);
            z-index: 9999;
            font-size: 0.9rem;
            font-weight: 500;
            box-shadow: var(--shadow-lg);
        `;
        toast.innerHTML = `
            <div class="d-flex align-items-center gap-2">
                <i class="bi ${message.includes('nocturno') ? 'bi-moon-stars-fill' : 'bi-sun-fill'}" style="color: var(--primary-color);"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // Eliminar después de 2 segundos
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s ease';
            setTimeout(() => {
                if (toast && toast.remove) toast.remove();
            }, 300);
        }, 2000);
    }
    
    // Escuchar cambios en preferencia del sistema
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            const newTheme = e.matches ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            updateToggleIcon(newTheme);
        }
    });
})();
// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('chatBoxTheme') || 'light';
    setTheme(savedTheme);
    
    const themeToggle = document.getElementById('themeToggle');
    const themeToggle2 = document.getElementById('themeToggle2');
    
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
        updateThemeIcon(savedTheme, themeToggle);
    }
    
    if (themeToggle2) {
        themeToggle2.addEventListener('click', toggleTheme);
        updateThemeIcon(savedTheme, themeToggle2);
    }
}

function setTheme(theme) {
    document.body.className = `${theme}-theme`;
    localStorage.setItem('chatBoxTheme', theme);
    
    const themeToggle = document.getElementById('themeToggle');
    const themeToggle2 = document.getElementById('themeToggle2');
    
    if (themeToggle) updateThemeIcon(theme, themeToggle);
    if (themeToggle2) updateThemeIcon(theme, themeToggle2);
}

function toggleTheme() {
    const currentTheme = localStorage.getItem('chatBoxTheme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
}

function updateThemeIcon(theme, element) {
    if (element) {
        const icon = element.querySelector('i');
        if (icon) {
            icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        }
    }
}

window.initTheme = initTheme;
window.setTheme = setTheme;
window.toggleTheme = toggleTheme;
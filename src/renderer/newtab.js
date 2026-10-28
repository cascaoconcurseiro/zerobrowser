// Live Clock & Dynamic Greeting
    function updateGreeting() {
      const now = new Date();
      const hour = now.getHours();
      let greeting = 'Olá, bom dia';
      if (hour >= 12 && hour < 18) greeting = 'Olá, boa tarde';
      else if (hour >= 18 || hour < 5) greeting = 'Olá, boa noite';

      const titleEl = document.getElementById('greeting-title');
      if (titleEl) titleEl.textContent = greeting;

      const clockEl = document.getElementById('live-clock');
      if (clockEl) {
        const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const dateStr = now.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
        clockEl.textContent = `${dateStr} · ${timeStr}`;
      }
    }
    updateGreeting();
    setInterval(updateGreeting, 10000);

    // Search Box Form Handler
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');

    searchForm.addEventListener('submit', (e) => {
      const query = (searchInput.value || '').trim();
      if (!query) {
        e.preventDefault();
        return;
      }
      // If it looks like a URL, navigate directly
      if (/^(https?:\/\/|[a-z0-9-]+\.[a-z]{2,})/i.test(query)) {
        e.preventDefault();
        const target = /^https?:\/\//i.test(query) ? query : 'https://' + query;
        window.location.href = target;
      }
    });

    // Action cards
    document.getElementById('action-focus-search')?.addEventListener('click', () => {
      searchInput?.focus();
    });

    document.getElementById('action-copilot')?.addEventListener('click', () => {
      // Signal to browser to open Copilot panel
      window.location.hash = 'open-copilot';
    });

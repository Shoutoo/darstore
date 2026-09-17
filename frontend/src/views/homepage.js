import { GAMES, FAQS } from '../data/index.js';

export function renderHomepage() {
  const popularContainer = document.getElementById('popular-grid-container');
  if (popularContainer && popularContainer.children.length === 0) {
    popularContainer.innerHTML = GAMES.map(game => `
      <a href="${game.route || '/'}" class="popular-card" data-route="${game.route || '/'}" data-game-id="${game.id}">
        <img src="${game.image}" alt="${game.name}" class="popular-avatar" />
        <div class="popular-info">
          <div class="popular-name">${game.shortName}</div>
          <div class="popular-pub">${game.publisher}</div>
        </div>
      </a>
    `).join('');
  }

  const gamesGrid = document.getElementById('games-grid-container');
  if (gamesGrid && gamesGrid.querySelectorAll('.game-card').length === 0) {
    renderGamesGrid();
  }
}

export function renderGamesGrid() {
  const gamesGrid = document.getElementById('games-grid-container');
  if (!gamesGrid) return;

  gamesGrid.innerHTML = GAMES.map(game => `
    <a href="${game.route || '/'}" class="game-card" data-route="${game.route || '/'}" data-game-id="${game.id}">
      <div class="game-poster-wrap">
        <img src="${game.image}" alt="${game.name}" class="game-poster" loading="lazy" />
      </div>
      <div class="game-card-content">
        <div class="game-title">${game.name}</div>
        <div class="game-pub">${game.publisher}</div>
      </div>
    </a>
  `).join('') + `
    <div class="search-empty-state" id="games-search-empty" style="display: none; grid-column: 1 / -1; text-align: center; padding: 32px; color: var(--text-secondary); background: var(--bg-card); border-radius: var(--radius-md); border: 1px dashed var(--border-subtle);">
      Tidak ada game yang cocok dengan pencarian
    </div>
  `;
}

export function setupCarousel() {
  const slides = [
    '/assets/banners/hanzo_starlight.png',
    '/assets/banners/ml_banner.png',
    '/assets/banners/valo_banner.png'
  ];
  let currentSlide = 0;
  const imgEl = document.getElementById('carousel-img');
  const dots = document.querySelectorAll('.carousel-dot');

  function showSlide(idx) {
    currentSlide = (idx + slides.length) % slides.length;
    if (imgEl) {
      imgEl.src = slides[currentSlide];
    }
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === currentSlide);
    });
  }

  document.getElementById('carousel-prev-btn')?.addEventListener('click', () => {
    showSlide(currentSlide - 1);
  });
  document.getElementById('carousel-next-btn')?.addEventListener('click', () => {
    showSlide(currentSlide + 1);
  });

  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      const idx = parseInt(dot.dataset.index, 10);
      showSlide(idx);
    });
  });

  // Auto rotate every 6 seconds
  setInterval(() => {
    showSlide(currentSlide + 1);
  }, 6000);
}

export function renderFAQs(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = FAQS.map(faq => `
    <div class="faq-item">
      <div class="faq-question">
        <span>${faq.q}</span>
        <svg class="chevron-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </div>
      <div class="faq-answer">
        <p>${faq.a}</p>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.faq-question').forEach(q => {
    q.addEventListener('click', () => {
      const item = q.closest('.faq-item');
      item.classList.toggle('open');
    });
  });
}

const STORAGE_KEY = 'snotes.cards.v2';
const SETTINGS_KEY = 'snotes.settings.v1';
const PAGE_SIZE = 15;

const state = {
  cards: [],
  filter: 'all',
  search: '',
  tagFilter: '',
  editingId: null,
  visibleCount: PAGE_SIZE,
  settings: {
    theme: 'system',
    layout: 'wide',
    density: 'comfortable',
    livePreview: true,
  },
};

const els = {
  cardsGrid: document.getElementById('cardsGrid'),
  cardTemplate: document.getElementById('cardTemplate'),
  newCardBtn: document.getElementById('newCardBtn'),
  searchInput: document.getElementById('searchInput'),
  tagFilters: document.getElementById('tagFilters'),
  viewTitle: document.getElementById('viewTitle'),
  feedStatus: document.getElementById('feedStatus'),
  feedSentinel: document.getElementById('feedSentinel'),

  themeSelect: document.getElementById('themeSelect'),
  layoutSelect: document.getElementById('layoutSelect'),
  densitySelect: document.getElementById('densitySelect'),
  previewToggle: document.getElementById('previewToggle'),

  editorDialog: document.getElementById('editorDialog'),
  editorTitle: document.getElementById('editorTitle'),
  editorForm: document.getElementById('editorForm'),
  titleInput: document.getElementById('titleInput'),
  tagsInput: document.getElementById('tagsInput'),
  contentInput: document.getElementById('contentInput'),
  previewSection: document.getElementById('previewSection'),
  previewPane: document.getElementById('previewPane'),
  pinBtn: document.getElementById('pinBtn'),
  archiveBtn: document.getElementById('archiveBtn'),
  trashBtn: document.getElementById('trashBtn'),
  deleteBtn: document.getElementById('deleteBtn'),
  cancelBtn: document.getElementById('cancelBtn'),

  commandBtn: document.getElementById('commandBtn'),
  commandDialog: document.getElementById('commandDialog'),
  commandSearch: document.getElementById('commandSearch'),
  commandList: document.getElementById('commandList'),
};

let feedObserver;

const COMMANDS = [
  { name: 'New card', run: () => openEditor() },
  { name: 'Show all cards', run: () => setFilter('all') },
  { name: 'Show pinned cards', run: () => setFilter('pinned') },
  { name: 'Show archived cards', run: () => setFilter('archived') },
  { name: 'Show trash', run: () => setFilter('trash') },
  { name: 'Switch to wide feed', run: () => setLayout('wide') },
  { name: 'Switch to grid feed', run: () => setLayout('grid') },
  { name: 'Theme: dark', run: () => setTheme('dark') },
  { name: 'Theme: light', run: () => setTheme('light') },
  { name: 'Theme: system', run: () => setTheme('system') },
];

init();

function init() {
  loadCards();
  loadSettings();
  bindEvents();
  applySettings();
  setupInfiniteFeed();
  render();
}

function bindEvents() {
  els.newCardBtn.addEventListener('click', () => openEditor());

  els.searchInput.addEventListener('input', (e) => {
    state.search = e.target.value.toLowerCase();
    resetFeed();
    render();
  });

  document.querySelectorAll('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => setFilter(btn.dataset.filter));
  });

  els.themeSelect.addEventListener('change', (e) => setTheme(e.target.value));
  els.layoutSelect.addEventListener('change', (e) => setLayout(e.target.value));
  els.densitySelect.addEventListener('change', (e) => setDensity(e.target.value));
  els.previewToggle.addEventListener('change', (e) => {
    state.settings.livePreview = e.target.checked;
    persistSettings();
    applySettings();
    updatePreview();
  });

  els.editorForm.addEventListener('submit', (e) => {
    e.preventDefault();
    saveCard();
  });

  els.contentInput.addEventListener('input', updatePreview);
  els.cancelBtn.addEventListener('click', () => els.editorDialog.close());
  els.deleteBtn.addEventListener('click', permanentlyDeleteEditingCard);

  els.pinBtn.addEventListener('click', () => mutateEditingCard((card) => (card.pinned = !card.pinned)));
  els.archiveBtn.addEventListener('click', () => mutateEditingCard((card) => (card.archived = !card.archived)));
  els.trashBtn.addEventListener('click', () => mutateEditingCard((card) => (card.trashed = !card.trashed)));

  els.commandBtn.addEventListener('click', openCommandPalette);
  els.commandSearch.addEventListener('input', renderCommands);

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && els.editorDialog.open) {
      e.preventDefault();
      saveCard();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openCommandPalette();
    }
    if (e.key === 'n' && !isTyping(e.target)) openEditor();
    if (e.key === '/' && !isTyping(e.target)) {
      e.preventDefault();
      els.searchInput.focus();
    }
  });
}

function setupInfiniteFeed() {
  feedObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const total = getVisibleCards().length;
      if (state.visibleCount < total) {
        state.visibleCount += PAGE_SIZE;
        renderCards();
      }
    });
  }, { rootMargin: '500px' });
  feedObserver.observe(els.feedSentinel);
}

function isTyping(target) {
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

function openEditor(id = null) {
  state.editingId = id;
  const card = state.cards.find((c) => c.id === id);
  els.editorTitle.textContent = card ? 'Edit Card' : 'New Card';
  els.titleInput.value = card?.title ?? '';
  els.tagsInput.value = card?.tags?.join(', ') ?? '';
  els.contentInput.value = card?.content ?? '';
  setEditorButtonStates(card);
  updatePreview();
  els.editorDialog.showModal();
  els.titleInput.focus();
}

function setEditorButtonStates(card) {
  els.pinBtn.textContent = card?.pinned ? 'Unpin' : 'Pin';
  els.archiveBtn.textContent = card?.archived ? 'Unarchive' : 'Archive';
  els.trashBtn.textContent = card?.trashed ? 'Restore' : 'Trash';
  els.deleteBtn.style.display = card ? 'inline-block' : 'none';
}

function mutateEditingCard(mutator) {
  const card = state.cards.find((c) => c.id === state.editingId);
  if (!card) return;
  mutator(card);
  card.updatedAt = new Date().toISOString();
  persistAndRender();
  setEditorButtonStates(card);
}

function saveCard() {
  const now = new Date().toISOString();
  const payload = {
    title: els.titleInput.value.trim() || 'Untitled',
    tags: parseTags(els.tagsInput.value),
    content: els.contentInput.value.trim(),
    updatedAt: now,
  };

  if (state.editingId) {
    const card = state.cards.find((c) => c.id === state.editingId);
    Object.assign(card, payload);
  } else {
    state.cards.unshift({
      id: crypto.randomUUID(),
      createdAt: now,
      pinned: false,
      archived: false,
      trashed: false,
      ...payload,
    });
  }

  persistAndRender();
  resetFeed();
  els.editorDialog.close();
}

function permanentlyDeleteEditingCard() {
  if (!state.editingId) return;
  state.cards = state.cards.filter((c) => c.id !== state.editingId);
  persistAndRender();
  resetFeed();
  els.editorDialog.close();
}

function parseTags(raw) {
  return [...new Set(raw.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))];
}

function getVisibleCards() {
  return state.cards
    .filter((card) => {
      if (state.filter === 'pinned') return card.pinned && !card.trashed;
      if (state.filter === 'archived') return card.archived && !card.trashed;
      if (state.filter === 'trash') return card.trashed;
      return !card.trashed;
    })
    .filter((card) => {
      if (!state.search) return true;
      const haystack = `${card.title} ${card.content} ${card.tags.join(' ')}`.toLowerCase();
      return haystack.includes(state.search);
    })
    .filter((card) => (!state.tagFilter ? true : card.tags.includes(state.tagFilter)))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
}

function render() {
  renderTagFilters();
  renderCards();
  updateFilterButtons();
}

function renderCards() {
  const visible = getVisibleCards();
  const items = visible.slice(0, state.visibleCount);
  els.cardsGrid.innerHTML = '';

  if (!visible.length) {
    els.cardsGrid.innerHTML = `<p>No cards found. Create one with <b>New Card</b>.</p>`;
    els.feedStatus.textContent = '';
    return;
  }

  items.forEach((card) => {
    const node = els.cardTemplate.content.cloneNode(true);
    const article = node.querySelector('.card');
    node.querySelector('h3').textContent = card.title;
    node.querySelector('.excerpt').textContent = card.content.slice(0, 360);

    const statusIcons = node.querySelector('.status-icons');
    statusIcons.textContent = `${card.pinned ? '📌' : ''}${card.archived ? '🗄️' : ''}${card.trashed ? '🗑️' : ''}`;

    const tagsContainer = node.querySelector('.tags');
    card.tags.forEach((tag) => {
      const tagEl = document.createElement('span');
      tagEl.className = 'tag';
      tagEl.textContent = `#${tag}`;
      tagsContainer.appendChild(tagEl);
    });

    const backlinks = getBacklinks(card.title);
    if (backlinks.length) {
      const b = document.createElement('span');
      b.className = 'tag';
      b.textContent = `↩ ${backlinks.length}`;
      tagsContainer.appendChild(b);
    }

    node.querySelector('.updated').textContent = new Date(card.updatedAt).toLocaleString();
    article.addEventListener('click', () => openEditor(card.id));
    els.cardsGrid.appendChild(node);
  });

  const remaining = Math.max(visible.length - items.length, 0);
  els.feedStatus.textContent = remaining ? `Scroll for ${remaining} more cards...` : `Showing all ${visible.length} cards.`;
}

function getBacklinks(title) {
  const needle = `[[${title.toLowerCase()}]]`;
  return state.cards.filter((c) => c.title !== title && c.content.toLowerCase().includes(needle));
}

function renderTagFilters() {
  const tags = [...new Set(state.cards.flatMap((c) => c.tags))].sort();
  els.tagFilters.innerHTML = '';

  const clear = document.createElement('button');
  clear.className = `chip ${state.tagFilter ? '' : 'active'}`;
  clear.textContent = 'Any';
  clear.onclick = () => {
    state.tagFilter = '';
    resetFeed();
    render();
  };
  els.tagFilters.appendChild(clear);

  tags.forEach((tag) => {
    const button = document.createElement('button');
    button.className = `chip ${state.tagFilter === tag ? 'active' : ''}`;
    button.textContent = `#${tag}`;
    button.onclick = () => {
      state.tagFilter = state.tagFilter === tag ? '' : tag;
      resetFeed();
      render();
    };
    els.tagFilters.appendChild(button);
  });
}

function updateFilterButtons() {
  document.querySelectorAll('[data-filter]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.filter === state.filter);
  });
  els.viewTitle.textContent = `${state.filter[0].toUpperCase()}${state.filter.slice(1)} Cards`;
}

function setFilter(filter) {
  state.filter = filter;
  resetFeed();
  render();
}

function resetFeed() {
  state.visibleCount = PAGE_SIZE;
}

function markdown(input) {
  let out = escapeHtml(input);

  out = out.replace(/^```([\s\S]*?)```$/gm, '<pre><code>$1</code></pre>');
  out = out.replace(/^### (.*)$/gm, '<h3>$1</h3>');
  out = out.replace(/^## (.*)$/gm, '<h2>$1</h2>');
  out = out.replace(/^# (.*)$/gm, '<h1>$1</h1>');
  out = out.replace(/^> (.*)$/gm, '<blockquote>$1</blockquote>');
  out = out.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*(.*?)\*/g, '<em>$1</em>');
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  out = out.replace(/(^|\n)- (.*?)(?=\n|$)/g, '$1<li>$2</li>');
  out = out.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
  out = out.replace(/\n\n+/g, '</p><p>');
  out = `<p>${out}</p>`;
  out = out.replace(/<p><h([1-3])>/g, '<h$1>').replace(/<\/h([1-3])><\/p>/g, '</h$1>');
  out = out.replace(/<p><blockquote>/g, '<blockquote>').replace(/<\/blockquote><\/p>/g, '</blockquote>');
  out = out.replace(/<p><pre>/g, '<pre>').replace(/<\/pre><\/p>/g, '</pre>');
  out = out.replace(/<p><ul>/g, '<ul>').replace(/<\/ul><\/p>/g, '</ul>');
  out = out.replace(/\n/g, '<br>');

  return out;
}

function escapeHtml(str) {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function updatePreview() {
  els.previewSection.style.display = state.settings.livePreview ? 'block' : 'none';
  if (!state.settings.livePreview) return;
  const content = els.contentInput.value;
  const linked = content.replace(/\[\[(.*?)\]\]/g, (_, title) => `**↗ ${title}**`);
  els.previewPane.innerHTML = markdown(linked);
}

function persistAndRender() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cards));
  render();
}

function persistSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

function loadCards() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    state.cards = JSON.parse(raw);
    return;
  }

  const now = Date.now();
  state.cards = Array.from({ length: 70 }).map((_, i) => {
    const date = new Date(now - i * 1000 * 60 * 60).toISOString();
    return {
      id: crypto.randomUUID(),
      title: i === 0 ? 'Welcome to SNotes' : `Card ${i + 1}`,
      content:
        i === 0
          ? 'This is your wide-card infinite feed.\n\nUse **markdown**, #tags, and [[Welcome to SNotes]] backlinks.'
          : `## Note ${i + 1}\n- item one\n- item two\n\nReference [[Welcome to SNotes]]`,
      tags: i % 2 ? ['notes', 'daily'] : ['ideas', 'work'],
      pinned: i === 0,
      archived: false,
      trashed: false,
      createdAt: date,
      updatedAt: date,
    };
  });
}

function loadSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return;
  const parsed = JSON.parse(raw);
  state.settings = { ...state.settings, ...parsed };
}

function applySettings() {
  els.themeSelect.value = state.settings.theme;
  els.layoutSelect.value = state.settings.layout;
  els.densitySelect.value = state.settings.density;
  els.previewToggle.checked = state.settings.livePreview;

  document.body.classList.toggle('compact', state.settings.density === 'compact');
  els.cardsGrid.classList.toggle('wide', state.settings.layout === 'wide');
  els.cardsGrid.classList.toggle('grid', state.settings.layout === 'grid');

  applyTheme();
}

function applyTheme() {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = state.settings.theme === 'dark' || (state.settings.theme === 'system' && prefersDark);
  document.body.classList.toggle('dark', dark);
}

function setTheme(value) {
  state.settings.theme = value;
  persistSettings();
  applySettings();
}

function setLayout(value) {
  state.settings.layout = value;
  persistSettings();
  applySettings();
}

function setDensity(value) {
  state.settings.density = value;
  persistSettings();
  applySettings();
}

function openCommandPalette() {
  els.commandSearch.value = '';
  renderCommands();
  els.commandDialog.showModal();
  els.commandSearch.focus();
}

function renderCommands() {
  const q = els.commandSearch.value.toLowerCase();
  els.commandList.innerHTML = '';
  COMMANDS.filter((c) => c.name.toLowerCase().includes(q)).forEach((cmd) => {
    const li = document.createElement('li');
    li.textContent = cmd.name;
    li.onclick = () => {
      cmd.run();
      els.commandDialog.close();
    };
    els.commandList.appendChild(li);
  });
}

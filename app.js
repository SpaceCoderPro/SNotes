const STORAGE_KEY = 'snotes.cards.v1';
const THEME_KEY = 'snotes.theme';

const state = {
  cards: [],
  filter: 'all',
  search: '',
  tagFilter: '',
  editingId: null,
};

const els = {
  cardsGrid: document.getElementById('cardsGrid'),
  cardTemplate: document.getElementById('cardTemplate'),
  newCardBtn: document.getElementById('newCardBtn'),
  searchInput: document.getElementById('searchInput'),
  tagFilters: document.getElementById('tagFilters'),
  viewTitle: document.getElementById('viewTitle'),
  themeBtn: document.getElementById('themeBtn'),

  editorDialog: document.getElementById('editorDialog'),
  editorTitle: document.getElementById('editorTitle'),
  editorForm: document.getElementById('editorForm'),
  titleInput: document.getElementById('titleInput'),
  tagsInput: document.getElementById('tagsInput'),
  contentInput: document.getElementById('contentInput'),
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

const COMMANDS = [
  { name: 'New card', run: () => openEditor() },
  { name: 'Show all cards', run: () => setFilter('all') },
  { name: 'Show pinned', run: () => setFilter('pinned') },
  { name: 'Show archived', run: () => setFilter('archived') },
  { name: 'Show trash', run: () => setFilter('trash') },
  { name: 'Toggle theme', run: () => toggleTheme() },
];

init();

function init() {
  loadCards();
  loadTheme();
  bindEvents();
  render();
}

function bindEvents() {
  els.newCardBtn.addEventListener('click', () => openEditor());
  els.searchInput.addEventListener('input', (e) => {
    state.search = e.target.value.toLowerCase();
    render();
  });

  document.querySelectorAll('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => setFilter(btn.dataset.filter));
  });

  els.themeBtn.addEventListener('click', toggleTheme);

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

function isTyping(target) {
  return ['INPUT', 'TEXTAREA'].includes(target.tagName);
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
  setEditorButtonStates(card);
  persistAndRender();
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
  els.editorDialog.close();
}

function permanentlyDeleteEditingCard() {
  if (!state.editingId) return;
  state.cards = state.cards.filter((c) => c.id !== state.editingId);
  persistAndRender();
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
  els.cardsGrid.innerHTML = '';
  if (!visible.length) {
    els.cardsGrid.innerHTML = `<p>No cards found. Create one with <b>New Card</b>.</p>`;
    return;
  }

  for (const card of visible) {
    const node = els.cardTemplate.content.cloneNode(true);
    const article = node.querySelector('.card');
    node.querySelector('h3').textContent = card.title;
    node.querySelector('.excerpt').textContent = card.content.slice(0, 180);

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
      b.textContent = `↩ ${backlinks.length} backlink${backlinks.length > 1 ? 's' : ''}`;
      tagsContainer.appendChild(b);
    }

    node.querySelector('.updated').textContent = new Date(card.updatedAt).toLocaleString();
    article.addEventListener('click', () => openEditor(card.id));
    els.cardsGrid.appendChild(node);
  }
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
    render();
  };
  els.tagFilters.appendChild(clear);

  tags.forEach((tag) => {
    const button = document.createElement('button');
    button.className = `chip ${state.tagFilter === tag ? 'active' : ''}`;
    button.textContent = `#${tag}`;
    button.onclick = () => {
      state.tagFilter = state.tagFilter === tag ? '' : tag;
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
  render();
}

function markdown(input) {
  return input
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/gim, '<b>$1</b>')
    .replace(/\*(.*?)\*/gim, '<i>$1</i>')
    .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" target="_blank">$1</a>')
    .replace(/\n/g, '<br />');
}

function updatePreview() {
  const content = els.contentInput.value;
  const linked = content.replace(/\[\[(.*?)\]\]/g, (_, title) => `<span class="tag">↗ ${title}</span>`);
  els.previewPane.innerHTML = markdown(linked);
}

function persistAndRender() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cards));
  render();
}

function loadCards() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    state.cards = JSON.parse(raw);
    return;
  }
  const demoNow = new Date().toISOString();
  state.cards = [
    {
      id: crypto.randomUUID(),
      title: 'Welcome to SNotes',
      content: 'Use #tags, markdown, and [[Welcome to SNotes]] style backlinks.\n\nTry Command Palette for quick actions.',
      tags: ['welcome', 'guide'],
      pinned: true,
      archived: false,
      trashed: false,
      createdAt: demoNow,
      updatedAt: demoNow,
    },
  ];
}

function toggleTheme() {
  document.body.classList.toggle('dark');
  localStorage.setItem(THEME_KEY, document.body.classList.contains('dark') ? 'dark' : 'light');
}

function loadTheme() {
  if (localStorage.getItem(THEME_KEY) === 'dark') {
    document.body.classList.add('dark');
  }
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

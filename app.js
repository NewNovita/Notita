// Firebase Configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, getDoc, query, orderBy, updateDoc, deleteDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAVOMNM0dvyBBG22jFMbZgOxuEAQAE11kY",
    authDomain: "lucinotes1.firebaseapp.com",
    projectId: "lucinotes1",
    storageBucket: "lucinotes1.firebasestorage.app",
    messagingSenderId: "737729862916",
    appId: "1:737729862916:web:c054d633edc4ebab2ac451",
    measurementId: "G-VWP2DDLF2N"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// Default users
const DEFAULT_USERS = {
    admin: { username: 'admin', password: 'admin123', role: 'admin', displayName: '👑 Admin' },
    lucianita: { username: 'lucianita', password: 'chispitas', role: 'normal', displayName: '👤 Lucianita' }
};

// --- GESTOR DE TEMA (NUEVO) ---
class ThemeManager {
    constructor() {
        this.btn = document.getElementById('themeToggle');
        this.sun = this.btn.querySelector('.icon-sun');
        this.moon = this.btn.querySelector('.icon-moon');

        // Cargar tema guardado
        this.current = localStorage.getItem('theme') || 'light';
        this.apply();

        this.btn.onclick = () => {
            this.current = this.current === 'light' ? 'dark' : 'light';
            localStorage.setItem('theme', this.current);
            this.apply();
        };
    }

    apply() {
        document.body.setAttribute('data-theme', this.current);
        if (this.current === 'dark') {
            this.sun.style.display = 'none';
            this.moon.style.display = 'block';
        } else {
            this.sun.style.display = 'block';
            this.moon.style.display = 'none';
        }
    }
}

class AuthManager {
    constructor() { this.currentUser = null; }

    async login(username, password) {
        try {
            const userDoc = await getDoc(doc(db, 'users', username));
            if (!userDoc.exists()) throw new Error('Usuario no encontrado');
            const userData = userDoc.data();
            if (userData.password === password) {
                this.currentUser = { username: userData.username, role: userData.role, displayName: userData.displayName };
                return this.currentUser;
            } else { throw new Error('Contraseña incorrecta'); }
        } catch (error) { console.error('Login error:', error); throw error; }
    }

    async updateProfile(newDisplayName, newPassword) {
        if (!this.currentUser) return;
        try {
            const updates = {};
            if (newDisplayName) updates.displayName = newDisplayName;
            if (newPassword) updates.password = newPassword;
            await updateDoc(doc(db, 'users', this.currentUser.username), updates);
            if (newDisplayName) this.currentUser.displayName = newDisplayName;
            return true;
        } catch (error) { console.error('Error updating profile:', error); throw error; }
    }
    logout() { this.currentUser = null; }
    isAdmin() { return this.currentUser && this.currentUser.role === 'admin'; }
}

class MemoryManager {
    constructor() {
        this.memories = [];
        this.readMemories = [];
        this.availableEmojis = ['💝', '🌸', '🌙', '✨', '💐', '🌺', '🦋', '💕', '🎵', '📷', '🎁', '☁️', '🧸', '🍫', '💌', '🌹', '🐧', '🦄', '🍩', '🚀'];
    }

    async loadMemories() {
        try {
            const q = query(collection(db, 'memories'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            this.memories = [];
            querySnapshot.forEach((document) => {
                this.memories.push({ id: document.id, ...document.data() });
            });
            return this.memories;
        } catch (error) { console.error('Error loading memories:', error); return []; }
    }

    async loadReadMemories(username) {
        try {
            const userDoc = await getDoc(doc(db, 'users', username));
            if (userDoc.exists()) {
                this.readMemories = userDoc.data().readMemories || [];
            }
            return this.readMemories;
        } catch (error) { console.error('Error loading read memories:', error); return []; }
    }

    async markAsRead(memoryId, username) {
        if (!this.readMemories.includes(memoryId)) {
            try {
                this.readMemories.push(memoryId);
                await updateDoc(doc(db, 'users', username), {
                    readMemories: arrayUnion(memoryId)
                });
                return true;
            } catch (error) { console.error('Error marking memory as read:', error); }
        }
        return false;
    }

    isRead(memoryId) { return this.readMemories.includes(memoryId); }
    getUnreadMemories() { return this.memories.filter(m => !this.readMemories.includes(m.id)); }
    getRandomEmoji() { return this.availableEmojis[Math.floor(Math.random() * this.availableEmojis.length)]; }

    async addMemory(title, content, icon) {
        const selectedIcon = icon === 'random' ? this.getRandomEmoji() : icon;
        const memory = { title, content, icon: selectedIcon, createdAt: Date.now() };
        try {
            const docRef = await addDoc(collection(db, 'memories'), memory);
            memory.id = docRef.id;
            this.memories.unshift(memory);
            return memory;
        } catch (error) { console.error('Error adding memory:', error); throw error; }
    }

    async updateMemory(id, title, content, icon) {
        try {
            const updateData = { title, content };
            if (icon !== 'random') updateData.icon = icon;
            await updateDoc(doc(db, 'memories', id), updateData);
            const index = this.memories.findIndex(m => m.id === id);
            if (index !== -1) this.memories[index] = { ...this.memories[index], ...updateData };
        } catch (error) { console.error('Error updating memory:', error); throw error; }
    }

    async deleteMemory(id) {
        try {
            await deleteDoc(doc(db, 'memories', id));
            this.memories = this.memories.filter(m => m.id !== id);
        } catch (error) { console.error('Error deleting memory:', error); throw error; }
    }

    async addBulkMemories(notesText, onProgress) {
        const notes = this.parseBulkNotes(notesText);
        const addedMemories = [];
        if (notes.length === 0) throw new Error('Formato incorrecto.');
        let count = 0;
        for (const note of notes) {
            try {
                const icon = this.getRandomEmoji();
                const memory = await this.addMemory(note.title, note.content, icon);
                addedMemories.push(memory);
                count++;
                if (onProgress) onProgress(count, notes.length);
            } catch (error) { console.error('Error adding memory:', error); }
        }
        return addedMemories;
    }

    parseBulkNotes(text) {
        const notes = [];
        const lines = text.split('\n');
        let currentNote = { title: '', content: '' };
        const titleRegex = /^[\d\.\-\s]*t[íi]tulo\s*:\s*(.*)/i;
        const contentRegex = /^[\d\.\-\s]*contenido\s*:\s*(.*)/i;

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            const titleMatch = trimmedLine.match(titleRegex);
            const contentMatch = trimmedLine.match(contentRegex);

            if (titleMatch) {
                if (currentNote.title && currentNote.content) {
                    notes.push({ ...currentNote });
                    currentNote = { title: '', content: '' };
                }
                currentNote.title = titleMatch[1].trim();
            } else if (contentMatch) {
                currentNote.content = contentMatch[1].trim();
            } else {
                if (currentNote.content) currentNote.content += '\n' + trimmedLine;
            }
        }
        if (currentNote.title && currentNote.content) notes.push({ ...currentNote });
        return notes;
    }

    getMemories() { return [...this.memories]; }
    getMemoryById(id) { return this.memories.find(m => m.id === id); }
}

class MemoriesCanvas {
    constructor(memoryManager) {
        this.memoryManager = memoryManager;
        this.canvas = document.getElementById('memoriesCanvas');
    }

    render(onMemoryClick) {
        this.canvas.innerHTML = '';
        const unreadMemories = this.memoryManager.getUnreadMemories();
        const memoriesToShow = unreadMemories.slice(0, 30);

        memoriesToShow.forEach((memory, index) => {
            const icon = document.createElement('span');
            icon.className = 'memory-icon';
            icon.textContent = memory.icon;
            icon.dataset.memoryId = memory.id;

            const randomTop = Math.random() * 80 + 10;
            const randomLeft = Math.random() * 80 + 10;

            icon.style.top = `${randomTop}%`;
            icon.style.left = `${randomLeft}%`;
            icon.style.setProperty('--delay', `${index * 0.2}s`);
            icon.style.setProperty('--duration', `${8 + (Math.random() * 4)}s`);

            icon.addEventListener('click', () => onMemoryClick(memory.id));
            this.canvas.appendChild(icon);
        });
    }
}

class LucinitaApp {
    constructor() {
        this.authManager = new AuthManager();
        this.memoryManager = new MemoryManager();
        this.canvas = new MemoriesCanvas(this.memoryManager);
        this.themeManager = new ThemeManager(); // Inicializamos el tema
        this.currentMode = 'single';
        this.editingId = null;

        this.screens = {
            login: document.getElementById('loginScreen'),
            main: document.getElementById('mainScreen')
        };
        this.modals = {
            memories: document.getElementById('memoriesModal'),
            addMemory: document.getElementById('addMemoryModal'),
            detail: document.getElementById('memoryDetailModal'),
            profile: document.getElementById('profileModal')
        };
        this.init();
    }

    async init() {
        await this.initializeDefaultUsers();
        this.setupEventListeners();
    }

    async initializeDefaultUsers() {
        try {
            for (const [username, userData] of Object.entries(DEFAULT_USERS)) {
                const userDoc = await getDoc(doc(db, 'users', username));
                if (!userDoc.exists()) {
                    await setDoc(doc(db, 'users', username), { ...userData, readMemories: [] });
                }
            }
        } catch (error) { console.error('Error initializing users:', error); }
    }

    setupEventListeners() {
        document.getElementById('loginBtn').addEventListener('click', () => this.login());
        document.getElementById('password').addEventListener('keypress', (e) => { if (e.key === 'Enter') this.login(); });
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        document.getElementById('myMemoriesBtn').addEventListener('click', () => this.showMemoriesList());
        document.getElementById('addMemoryBtn').addEventListener('click', () => this.showAddMemoryModal());

        const userBadge = document.getElementById('userBadge');
        if (userBadge) userBadge.addEventListener('click', () => this.showProfileModal());

        const profileForm = document.getElementById('profileForm');
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => { e.preventDefault(); this.handleProfileUpdate(); });
        }

        const memoriesList = document.getElementById('memoriesList');
        memoriesList.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.action-btn.delete');
            if (deleteBtn) { e.stopPropagation(); this.deleteMemory(deleteBtn.dataset.id); return; }
            const editBtn = e.target.closest('.action-btn.edit');
            if (editBtn) { e.stopPropagation(); this.editMemory(editBtn.dataset.id); return; }
            const cardContent = e.target.closest('.memory-card-content');
            if (cardContent) {
                const id = cardContent.closest('.memory-card').dataset.id;
                this.handleCardClick(id);
            }
        });

        document.getElementById('closeMemoriesModal').addEventListener('click', () => this.closeModal('memories'));
        document.getElementById('closeAddModal').addEventListener('click', () => this.closeModal('addMemory'));
        document.getElementById('closeDetailModal').addEventListener('click', () => this.closeModal('detail'));
        const closeProfile = document.getElementById('closeProfileModal');
        if (closeProfile) closeProfile.addEventListener('click', () => this.closeModal('profile'));

        Object.values(this.modals).forEach(modal => {
            if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });
        });

        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchMode(e.target.closest('.mode-btn').dataset.mode));
        });

        document.getElementById('addMemoryForm').addEventListener('submit', (e) => { e.preventDefault(); this.handleMemorySubmit(); });
    }

    switchMode(mode) {
        this.currentMode = mode;
        document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
        document.getElementById('singleMode').classList.toggle('active', mode === 'single');
        document.getElementById('bulkMode').classList.toggle('active', mode === 'bulk');
        this.updateSubmitButtonText();
    }

    updateSubmitButtonText() {
        const submitBtn = document.getElementById('submitBtnText');
        if (this.currentMode === 'bulk') submitBtn.textContent = 'Guardar Notas Masivas';
        else submitBtn.textContent = this.editingId ? 'Actualizar nota' : 'Guardar Nota';
    }

    async login() {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        try {
            await this.authManager.login(username, password);
            await this.showMainScreen();
        } catch (error) { alert('❌ Usuario o contraseña incorrectos'); }
    }

    logout() {
        this.authManager.logout();
        this.screens.main.classList.remove('active');
        this.screens.login.classList.add('active');
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
    }

    async showMainScreen() {
        this.screens.login.classList.remove('active');
        this.screens.main.classList.add('active');
        document.getElementById('userBadge').textContent = this.authManager.currentUser.displayName;

        const addBtn = document.getElementById('addMemoryBtn');
        if (this.authManager.isAdmin()) addBtn.classList.remove('hidden');
        else addBtn.classList.add('hidden');

        await this.memoryManager.loadMemories();
        await this.memoryManager.loadReadMemories(this.authManager.currentUser.username);
        this.updateMemoriesCount();
        this.canvas.render((memoryId) => this.showMemoryDetail(memoryId));
    }

    updateMemoriesCount() {
        const unreadCount = this.memoryManager.getUnreadMemories().length;
        document.getElementById('memoriesCount').textContent = unreadCount;
        const countLabel = document.querySelector('.counter-text');
        if (unreadCount === 0) countLabel.textContent = "¡TODO LEÍDO! 💝";
        else countLabel.textContent = "MENSAJES EN EL AIRE:";
    }

    showMemoriesList() {
        const memoriesList = document.getElementById('memoriesList');
        let memories = this.memoryManager.getMemories();
        const isAdmin = this.authManager.isAdmin();

        if (!isAdmin) {
            memories = memories.filter(m => this.memoryManager.isRead(m.id));
        }

        if (memories.length === 0) {
            const emptyMsg = isAdmin
                ? 'Aún no has escrito ninguna nota.'
                : 'Aún no has atrapado ninguna nota 🦋.<br><br>Toca las burbujas en la pantalla principal para coleccionarlas.';

            memoriesList.innerHTML = `<div class="empty-state"><div style="font-size:3rem;margin-bottom:1rem">💌</div><p class="empty-state-text" style="color:var(--color-text-secondary);text-align:center">${emptyMsg}</p></div>`;
        } else {
            memoriesList.innerHTML = memories.map(memory => {
                return `
                    <div class="memory-card read" data-id="${memory.id}">
                        <div class="memory-card-content">
                            <div class="memory-card-header">
                                <span class="memory-card-icon" style="font-size:1.5rem">${memory.icon}</span>
                                <h3 class="memory-card-title">${this.escapeHtml(memory.title)}</h3>
                            </div>
                            <p class="memory-card-preview">${this.escapeHtml(memory.content)}</p>
                        </div>
                        ${isAdmin ? `<div class="memory-actions"><button type="button" class="action-btn edit" data-id="${memory.id}">✏️</button><button type="button" class="action-btn delete" data-id="${memory.id}">🗑️</button></div>` : ''}
                    </div>`;
            }).join('');
        }
        this.modals.memories.classList.add('active');
    }

    handleCardClick(memoryId) {
        this.closeModal('memories');
        setTimeout(() => this.showMemoryDetail(memoryId), 300);
    }

    async showMemoryDetail(memoryId) {
        const memory = this.memoryManager.getMemoryById(memoryId);
        if (!memory) return;

        const isNewRead = await this.memoryManager.markAsRead(memoryId, this.authManager.currentUser.username);

        document.getElementById('detailTitle').textContent = memory.title;
        document.getElementById('detailIcon').textContent = memory.icon;
        document.getElementById('detailContent').textContent = memory.content;
        this.modals.detail.classList.add('active');

        if (isNewRead) {
            this.updateMemoriesCount();
            this.canvas.render((id) => this.showMemoryDetail(id));
        }
    }

    showAddMemoryModal() {
        if (!this.authManager.isAdmin()) return;
        this.editingId = null;
        document.getElementById('addMemoryForm').reset();
        document.getElementById('memoryIcon').value = 'random';
        this.switchMode('single');
        this.modals.addMemory.classList.add('active');
    }

    showProfileModal() {
        const user = this.authManager.currentUser;
        document.getElementById('newDisplayName').value = user.displayName;
        document.getElementById('newPassword').value = '';
        this.modals.profile.classList.add('active');
    }

    async handleProfileUpdate() {
        const name = document.getElementById('newDisplayName').value.trim();
        const pass = document.getElementById('newPassword').value.trim();
        if (!name || !pass) return alert('❌ Completa los campos');
        const btnText = document.getElementById('saveProfileBtnText');
        const original = btnText.textContent;
        btnText.parentElement.disabled = true;
        btnText.textContent = 'Guardando...';
        try {
            await this.authManager.updateProfile(name, pass);
            document.getElementById('userBadge').textContent = name;
            this.showSuccessMessage('✨ Perfil actualizado');
            this.closeModal('profile');
        } catch (e) { alert('Error: ' + e.message); }
        finally { btnText.parentElement.disabled = false; btnText.textContent = original; }
    }

    editMemory(id) {
        const memory = this.memoryManager.getMemoryById(id);
        if (!memory) return;
        this.editingId = id;
        document.getElementById('memoryTitle').value = memory.title;
        document.getElementById('memoryContent').value = memory.content;
        const sel = document.getElementById('memoryIcon');
        sel.value = [...sel.options].some(o => o.value === memory.icon) ? memory.icon : 'random';
        this.switchMode('single');
        this.closeModal('memories');
        this.modals.addMemory.classList.add('active');
    }

    async deleteMemory(id) {
        if (!confirm('¿Eliminar nota?')) return;
        try {
            await this.memoryManager.deleteMemory(id);
            this.showMemoriesList();
            this.updateMemoriesCount();
            this.canvas.render(id => this.showMemoryDetail(id));
            this.showSuccessMessage('🗑️ Eliminado');
        } catch (e) { alert('Error: ' + e.message); }
    }

    async handleMemorySubmit() {
        try {
            if (this.currentMode === 'single') await this.saveSingleMemory();
            else await this.saveBulkMemories();
        } catch (e) { alert('❌ Error: ' + e.message); }
    }

    async saveSingleMemory() {
        const title = document.getElementById('memoryTitle').value.trim();
        const content = document.getElementById('memoryContent').value.trim();
        const icon = document.getElementById('memoryIcon').value;
        if (!title || !content) return alert('❌ Faltan datos');
        const btnText = document.getElementById('submitBtnText');
        const original = btnText.textContent;
        btnText.parentElement.disabled = true;
        btnText.textContent = 'Guardando...';
        try {
            if (this.editingId) {
                await this.memoryManager.updateMemory(this.editingId, title, content, icon);
                this.showSuccessMessage('✨ Actualizado');
            } else {
                await this.memoryManager.addMemory(title, content, icon);
                this.showSuccessMessage('✨ Agregado');
            }
            this.updateMemoriesCount();
            this.canvas.render(id => this.showMemoryDetail(id));
            this.closeModal('addMemory');
        } finally { btnText.parentElement.disabled = false; btnText.textContent = original; }
    }

    async saveBulkMemories() {
        const text = document.getElementById('bulkText').value.trim();
        if (!text) return alert('❌ Escribe notas');
        const btnText = document.getElementById('submitBtnText');
        const original = btnText.textContent;
        btnText.parentElement.disabled = true;
        try {
            const added = await this.memoryManager.addBulkMemories(text, (c, t) => btnText.textContent = `Subiendo ${c}/${t}...`);
            this.updateMemoriesCount();
            this.canvas.render(id => this.showMemoryDetail(id));
            this.closeModal('addMemory');
            document.getElementById('bulkText').value = '';
            alert(`✅ ${added.length} notas subidas.`);
        } catch (e) { alert('❌ Error: ' + e.message); }
        finally { btnText.parentElement.disabled = false; btnText.textContent = original; }
    }

    showSuccessMessage(msg) {
        const t = document.createElement('div');
        t.style.cssText = `position:fixed;top:100px;left:50%;transform:translateX(-50%);background:var(--gradient-primary);color:var(--color-text-primary);padding:1rem 2rem;border-radius:32px;box-shadow:0 8px 32px rgba(0,0,0,0.15);font-weight:600;z-index:10000;animation:fadeInUp 0.3s ease;`;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
    }
    closeModal(n) { if (this.modals[n]) this.modals[n].classList.remove('active'); }
    escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
}

window.app = null;
document.addEventListener('DOMContentLoaded', () => window.app = new LucinitaApp());
// Importamos Auth además de Firestore
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, getDoc, query, orderBy, updateDoc, deleteDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAVOMNM0dvyBBG22jFMbZgOxuEAQAE11kY",
    authDomain: "lucinotes1.firebaseapp.com",
    projectId: "lucinotes1",
    storageBucket: "lucinotes1.firebasestorage.app",
    messagingSenderId: "737729862916",
    appId: "1:737729862916:web:c054d633edc4ebab2ac451",
    measurementId: "G-VWP2DDLF2N"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app); // Inicializamos Auth

// --- GESTOR DE TEMA ---
class ThemeManager {
    constructor() {
        this.btn = document.getElementById('themeToggle');
        this.sun = this.btn.querySelector('.icon-sun');
        this.moon = this.btn.querySelector('.icon-moon');
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

// --- GESTOR DE MEMORIAS ---
class MemoryManager {
    constructor() {
        this.memories = [];
        this.readMemories = [];
        this.emojis = ['💝', '🌸', '🌙', '✨', '💐', '🌺', '🦋', '💕', '🎵', '📷', '🎁', '☁️', '🧸', '🍫', '💌', '🌹', '🐧', '🦄', '🍩', '🚀'];
    }

    async loadAll() {
        try {
            const q = query(collection(db, 'memories'), orderBy('createdAt', 'desc'));
            const snap = await getDocs(q);
            this.memories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) { console.error(e); }
    }

    async loadUser(username) {
        try {
            // Si es admin, cargamos el doc 'admin', si es lucianita, el doc 'lucianita'
            const d = await getDoc(doc(db, 'users', username));
            if (d.exists()) this.readMemories = d.data().readMemories || [];
        } catch (e) { console.error(e); }
    }

    getUnread() {
        return this.memories.filter(m => !this.readMemories.includes(m.id));
    }

    async markRead(id, username) {
        if (!this.readMemories.includes(id)) {
            this.readMemories.push(id);
            // Intentamos guardar la lectura en la BD
            try {
                await updateDoc(doc(db, 'users', username), { readMemories: arrayUnion(id) });
            } catch (e) { console.log("Lectura local (sin permisos de escritura)"); }
            return true;
        }
        return false;
    }

    async add(title, content, icon) {
        if (icon === 'random') icon = this.emojis[Math.floor(Math.random() * this.emojis.length)];
        // Esto ahora solo funcionará si estás logueado con Auth real
        await addDoc(collection(db, 'memories'), { title, content, icon, createdAt: Date.now() });
    }

    async addBulk(text) {
        const lines = text.split('\n');
        let current = { title: '', content: '' };
        const tReg = /^[\d\.\-\s]*t[íi]tulo\s*:\s*(.*)/i;
        const cReg = /^[\d\.\-\s]*contenido\s*:\s*(.*)/i;

        for (const line of lines) {
            const t = line.trim();
            if (!t) continue;
            const tM = t.match(tReg);
            const cM = t.match(cReg);

            if (tM) {
                if (current.title && current.content) {
                    await this.add(current.title, current.content, 'random');
                    current = { title: '', content: '' };
                }
                current.title = tM[1].trim();
            } else if (cM) {
                current.content = cM[1].trim();
            } else {
                if (current.content) current.content += '\n' + t;
            }
        }
        if (current.title && current.content) await this.add(current.title, current.content, 'random');
    }

    async delete(id) {
        await deleteDoc(doc(db, 'memories', id));
    }

    async updateProfile(username, displayName, password) {
        const updates = {};
        if (displayName) updates.displayName = displayName;
        if (password) updates.password = password;
        await updateDoc(doc(db, 'users', username), updates);
    }
}

// --- CANVAS ---
class MemoriesCanvas {
    constructor(manager) {
        this.manager = manager;
        this.container = document.getElementById('memoriesCanvas');
    }
    render(onClick) {
        const unread = this.manager.getUnread().slice(0, 30);
        const ids = unread.map(m => m.id);
        Array.from(this.container.children).forEach(b => {
            if (!ids.includes(b.dataset.id)) { b.classList.add('popping'); setTimeout(() => b.remove(), 600); }
        });
        unread.forEach(m => {
            if (!this.container.querySelector(`[data-id="${m.id}"]`)) {
                const b = document.createElement('div');
                b.className = 'memory-bubble forming';
                b.dataset.id = m.id; b.textContent = m.icon;
                b.style.left = Math.random() * 80 + 10 + '%';
                b.style.top = Math.random() * 80 + 10 + '%';
                b.style.setProperty('--duration', (6 + Math.random() * 6) + 's');
                b.style.setProperty('--delay', (Math.random() * -5) + 's');
                b.onclick = (e) => { e.stopPropagation(); onClick(m.id); };
                this.container.appendChild(b);
            }
        });
    }
}

// --- APP PRINCIPAL (CON AUTH REAL) ---
class App {
    constructor() {
        this.theme = new ThemeManager();
        this.memories = new MemoryManager();
        this.canvas = new MemoriesCanvas(this.memories);
        this.currentUser = null;
        this.init();
    }

    init() {
        document.getElementById('loginBtn').onclick = () => this.handleLogin();
        document.getElementById('logoutBtn').onclick = () => {
            signOut(auth); // Cerrar sesión real de Firebase
            window.location.reload();
        };

        document.getElementById('myMemoriesBtn').onclick = () => this.openModal('memoriesModal');
        document.getElementById('addMemoryBtn').onclick = () => this.openModal('addMemoryModal');
        document.getElementById('userBadge').onclick = () => this.openModal('profileModal');

        document.querySelectorAll('.btn-close').forEach(b => b.onclick = (e) => e.target.closest('.modal').classList.remove('active'));

        document.querySelectorAll('.mode-btn').forEach(btn => btn.onclick = (e) => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const mode = e.target.dataset.mode;
            document.getElementById('singleMode').classList.toggle('active', mode === 'single');
            document.getElementById('bulkMode').classList.toggle('active', mode === 'bulk');
        });

        document.getElementById('addMemoryForm').onsubmit = (e) => this.handleSave(e);
        document.getElementById('profileForm').onsubmit = (e) => this.handleProfile(e);
    }

    // LOGIN HÍBRIDO (Visual + Auth Real)
    async handleLogin() {
        const u = document.getElementById('username').value.trim();
        const p = document.getElementById('password').value;

        try {
            // 1. Verificar visualmente con Firestore (Para obtener el nombre 'Lucianita' o 'Admin')
            const userDoc = await getDoc(doc(db, 'users', u));

            if (!userDoc.exists()) {
                alert("Usuario no encontrado 👻");
                return;
            }

            const userData = userDoc.data();

            // 2. Si es Admin, hacemos LOGIN REAL en Firebase Auth
            if (userData.role === 'admin') {
                // Usamos el email que creaste en el paso 1 y la contraseña que escribiste en el input
                try {
                    await signInWithEmailAndPassword(auth, "admin@lucinotes.com", p);
                    // Si pasa aquí, la contraseña es correcta
                } catch (authError) {
                    alert("Contraseña incorrecta 🔒");
                    return;
                }
            } else {
                // Si es Lucianita, usamos la validación simple antigua
                if (userData.password !== p) {
                    alert("Contraseña incorrecta 🔒");
                    return;
                }
            }

            // Login exitoso
            this.currentUser = { username: u, ...userData };
            this.startApp();

        } catch (e) {
            console.error(e);
            alert("Error de conexión");
        }
    }

    async startApp() {
        document.getElementById('loginScreen').classList.remove('active');
        document.getElementById('mainScreen').classList.add('active');
        document.getElementById('userBadge').textContent = this.currentUser.displayName;

        if (this.currentUser.role === 'admin') {
            document.getElementById('addMemoryBtn').classList.remove('hidden');
        }

        await this.refreshData();
    }

    async refreshData() {
        await this.memories.loadAll();
        await this.memories.loadUser(this.currentUser.username);
        document.getElementById('memoriesCount').textContent = this.memories.getUnread().length;
        this.canvas.render((id) => this.readMemory(id));
        this.renderList();
    }

    async readMemory(id) {
        const m = this.memories.memories.find(x => x.id === id);
        if (!m) return;
        document.getElementById('detailTitle').textContent = m.title;
        document.getElementById('detailContent').textContent = m.content;
        document.getElementById('detailIcon').textContent = m.icon;
        this.openModal('memoryDetailModal');
        if (await this.memories.markRead(id, this.currentUser.username)) await this.refreshData();
    }

    renderList() {
        const list = document.getElementById('memoriesList');
        const isAdmin = this.currentUser.role === 'admin';
        const items = isAdmin ? this.memories.memories : this.memories.memories.filter(m => this.memories.readMemories.includes(m.id));

        if (items.length === 0) { list.innerHTML = `<div style="text-align:center;padding:2rem;opacity:0.6">Vacío...</div>`; return; }

        list.innerHTML = items.map(m => `
            <div class="memory-card read">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <h3 class="memory-card-title">${m.icon} ${m.title}</h3>
                    ${isAdmin ? `<button onclick="window.deleteItem('${m.id}')" style="background:none;border:none;cursor:pointer">🗑️</button>` : ''}
                </div>
                <p class="memory-card-preview">${m.content}</p>
            </div>`).join('');
    }

    async handleSave(e) {
        e.preventDefault();
        const mode = document.querySelector('.mode-btn.active').dataset.mode;
        const btn = document.getElementById('submitMemoryBtn');
        const originalText = btn.textContent;
        btn.textContent = "Guardando..."; btn.disabled = true;

        try {
            if (mode === 'single') {
                const t = document.getElementById('memoryTitle').value;
                const c = document.getElementById('memoryContent').value;
                const i = document.getElementById('memoryIcon').value;
                if (t && c) await this.memories.add(t, c, i);
            } else {
                const text = document.getElementById('bulkText').value;
                if (text) await this.memories.addBulk(text);
            }
            e.target.reset(); this.closeAllModals(); await this.refreshData();
        } catch (err) {
            alert("Error: No tienes permiso o falló la conexión.");
            console.error(err);
        } finally {
            btn.textContent = originalText; btn.disabled = false;
        }
    }

    async handleProfile(e) {
        e.preventDefault();
        const name = document.getElementById('newDisplayName').value;
        const pass = document.getElementById('newPassword').value;
        if (name || pass) {
            await this.memories.updateProfile(this.currentUser.username, name, pass);
            if (name) { this.currentUser.displayName = name; document.getElementById('userBadge').textContent = name; }
            alert("Perfil actualizado"); this.closeAllModals();
        }
    }

    openModal(id) { document.getElementById(id).classList.add('active'); }
    closeAllModals() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')); }
}

window.deleteItem = async (id) => { if (confirm("¿Borrar?")) { await window.app.memories.delete(id); await window.app.refreshData(); } };
window.app = new App();
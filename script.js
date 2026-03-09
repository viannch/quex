// ======================== FIREBASE CONFIGURATION ========================
const firebaseConfig = {
    apiKey: "AIzaSyChN_2F3Snvv05FV2KoE_IFxrsDwR518Xs",
    authDomain: "custom-ai-da10d.firebaseapp.com",
    projectId: "custom-ai-da10d",
    storageBucket: "custom-ai-da10d.firebasestorage.app",
    messagingSenderId: "453013829753",
    appId: "1:453013829753:web:df39714a1f6e1bb9e0fca8",
    // PASTIKAN INI ADA DAN BENAR:
    databaseURL: "https://custom-ai-da10d-default-rtdb.firebaseio.com"
};


// Initialize Firebase only if not already initialized
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// ======================== STATE MANAGEMENT ========================
let currentUser = null;
let chatHistory = [];
let currentChatId = Date.now().toString();
let conversationContext = [];
let isProcessing = false;
let currentModel = null;
let isRegisterMode = false;
let isLoading = true;
let customAvatarData = null;
let API_CONFIG = null;

// PERBAIKAN: State admin
let isAdmin = false;
let adminToolsVisible = false;
let unsubscribeAnnouncements = null;

// ======================== USER LEVEL SYSTEM ========================

const LEVEL_CONFIG = {
    maxLevel: 999,
    baseXP: 300,
    xpMultiplier: 1,
    xpPerMessage: { min: 2, max: 5 }
};

const LEVEL_TITLES = [
    { min: 1, max: 5, title: 'Qi Condensation', icon: 'QC' },
    { min: 6, max: 10, title: 'Foundation Establishment', icon: 'FE' },
    { min: 11, max: 20, title: 'Core Formation', icon: 'CF' },
    { min: 21, max: 30, title: 'Nascent Soul', icon: 'NS' },
    { min: 31, max: 40, title: 'Soul Transformation', icon: 'ST' },
    { min: 41, max: 50, title: 'Ascendant', icon: 'AS' },
    { min: 51, max: 60, title: 'Spirit Severing', icon: 'SS' },
    { min: 61, max: 70, title: 'Void Refinement', icon: 'VR' },
    { min: 71, max: 80, title: 'Tribulation Transcendence', icon: 'TT' },
    { min: 81, max: 90, title: 'Yin-Yang', icon: 'YY' },
    { min: 91, max: 99, title: 'Ancient Gods', icon: 'AG' },
    { min: 100, max: 900, title: 'Grand Empyrean', icon: 'GE' },
    { min: 999, max: 999, title: 'kRazy K', icon: 'KK' }
];

let userLevelData = {
    level: 1,
    currentXP: 0,
    totalXP: 0,
    totalMessages: 0
};

function getXPForLevel(level) {
    if (level <= 1) return 0;
    return Math.floor(LEVEL_CONFIG.baseXP * Math.pow(LEVEL_CONFIG.xpMultiplier, level - 1));
}

function getLevelInfo(level) {
    const titleData = LEVEL_TITLES.find(t => level >= t.min && level <= t.max);
    return {
        title: titleData ? titleData.title : 'Unknown',
        icon: titleData ? titleData.icon : '❓'
    };
}

function getLevelProgress() {
    const nextLevelXP = getXPForLevel(userLevelData.level + 1);
    if (userLevelData.level >= LEVEL_CONFIG.maxLevel) return 100;
    return Math.min(100, Math.floor((userLevelData.currentXP / nextLevelXP) * 100));
}

function getRandomXP() {
    const { min, max } = LEVEL_CONFIG.xpPerMessage;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function addXP(amount) {
    if (!currentUser) return;
    
    const oldLevel = userLevelData.level;
    userLevelData.currentXP += amount;
    userLevelData.totalXP += amount;
    userLevelData.totalMessages++;
    
    // Check level up
    let leveledUp = false;
    while (userLevelData.level < LEVEL_CONFIG.maxLevel) {
        const xpNeeded = getXPForLevel(userLevelData.level + 1);
        if (userLevelData.currentXP >= xpNeeded) {
            userLevelData.currentXP -= xpNeeded;
            userLevelData.level++;
            leveledUp = true;
        } else {
            break;
        }
    }
    
    await saveUserLevelData();
    updateLevelUI();
    
    if (leveledUp) {
        const levelInfo = getLevelInfo(userLevelData.level);
        showLevelUpNotification(userLevelData.level, levelInfo);
    }
}

async function saveUserLevelData() {
    if (!currentUser) return;
    try {
        await db.collection('users').doc(currentUser.uid).collection('stats').doc('level').set({
            ...userLevelData,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error('Error saving level data:', error);
    }
}

async function loadUserLevelData() {
    if (!currentUser) return;
    
    try {
        const doc = await db.collection('users').doc(currentUser.uid).collection('stats').doc('level').get();
        if (doc.exists) {
            const data = doc.data();
            userLevelData = {
                level: data.level || 1,
                currentXP: data.currentXP || 0,
                totalXP: data.totalXP || 0,
                totalMessages: data.totalMessages || 0,
                lastMessageTime: data.lastMessageTime?.toDate() || null
            };
        } else {
            // Initialize new user
            userLevelData = {
                level: 1,
                currentXP: 0,
                totalXP: 0,
                totalMessages: 0,
                lastMessageTime: null
            };
            await saveUserLevelData();
        }
        
        // Update UI dan tampilkan container
        updateLevelUI();
        
    } catch (error) {
        console.error('Error loading level data:', error);
    }
}


function updateLevelUI() {
    const container = document.getElementById('user-level-container');
    if (!container) return;
    
    const levelInfo = getLevelInfo(userLevelData.level);
    const progress = getLevelProgress();
    const nextLevelXP = getXPForLevel(userLevelData.level + 1);
    
    container.innerHTML = `
        <div class="flex items-center gap-2 px-2 py-2 bg-gradient-to-r from-black to-gray-500 rounded-lg">
            <div class="relative flex-shrink-0">
                <div class="w-9 h-9 rounded-full bg-gradient-to-br from-white to-black flex items-center justify-center text-black font-bold text-xs shadow-lg">
                    ${levelInfo.icon}
                </div>
                <div class="absolute -bottom-1 -right-1 w-4 h-4 bg-black rounded-full flex items-center justify-center text-[7px] font-bold text-white border border-white">
                    ${userLevelData.level}
                </div>
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between mb-0.5">
                    <span class="text-xs font-medium text-white truncate">${levelInfo.title}</span>
                    <span class="text-[10px] text-gray-400 ml-1">${userLevelData.currentXP}/${nextLevelXP} XP</span>
                </div>
                <div class="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
                    <div class="bg-gradient-to-r from-gray-300 to-gray-400 h-full rounded-full transition-all duration-500" 
                         style="width: ${progress}%"></div>
                </div>
            </div>
        </div>
    `;
    
    // Pastikan container terlihat
    container.classList.remove('hidden');
}


function showLevelUpNotification(newLevel, levelInfo) {
    const notif = document.createElement('div');
    notif.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 z-[200] animate-bounce';
    notif.innerHTML = `
        <div class="bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500 text-white px-6 py-4 rounded-2xl shadow-2xl border border-white/20 hidden">
            <div class="flex items-center gap-3">
                <div class="text-4xl animate-pulse">${levelInfo.icon}</div>
                <div>
                    <div class="text-xs uppercase tracking-wider text-white/80">Level Up!</div>
                    <div class="text-xl font-bold">Level ${newLevel} - ${levelInfo.title}</div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 4000);
}


// ======================== ADMIN FUNCTIONS (REALTIME DATABASE) ========================

// Inisialisasi Realtime Database reference
let rtdb = null;
let announcementsRef = null;

function initRealtimeDB() {
    if (!firebase.apps.length) return;
    rtdb = firebase.database();
    announcementsRef = rtdb.ref('announcements/global');
}

async function checkAdminStatus(email) {
    if (!email) return false;
    
    try {
        // Coba Realtime Database dulu
        if (rtdb) {
            const emailKey = email.replace(/\./g, ',');
            const snapshot = await rtdb.ref(`admins/${emailKey}`).once('value');
            if (snapshot.exists()) return snapshot.val() === true;
        }
        
        // Fallback ke Firestore
        const snapshot = await db.collection('admins')
            .where('email', '==', email)
            .limit(1)
            .get();
        
        return !snapshot.empty;
    } catch (error) {
        console.error('Error checking admin status:', error);
        // Fallback ke Firestore
        const snapshot = await db.collection('admins')
            .where('email', '==', email)
            .limit(1)
            .get();
        return !snapshot.empty;
    }
}


function showAdminTools() {
    const footer = getElement('chat-footer');
    if (!footer) return;
    
    // Cek apakah admin tools sudah ada
    if (getElement('admin-tools-panel')) return;
    
    // Tambahkan admin button di sebelah emoji
    const emojiBtn = getElement('emoji-btn');
    if (emojiBtn) {
        const adminBtn = document.createElement('button');
        adminBtn.id = 'admin-btn';
        adminBtn.className = 'group p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all duration-300 ml-1';
        adminBtn.title = 'Admin Tools';
        adminBtn.innerHTML = `
            <svg class="w-5 h-5 transition-transform group-hover:scale-110 group-hover:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
        `;
        adminBtn.onclick = toggleAdminPanel;
        emojiBtn.parentNode.insertBefore(adminBtn, emojiBtn.nextSibling);
    }
    
    // Buat panel admin
    const panel = document.createElement('div');
    panel.id = 'admin-tools-panel';
    panel.className = 'hidden fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-gray-900/95 backdrop-blur-xl border border-red-500/30 rounded-2xl p-4 shadow-2xl z-50 w-80 md:w-96';
    panel.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <h3 class="text-red-400 font-semibold flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
                Admin Alert System (Realtime)
            </h3>
            <button onclick="toggleAdminPanel()" class="text-gray-400 hover:text-white">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        </div>
        
        <div class="mb-3 p-2 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p class="text-xs text-green-400 flex items-center gap-2">
                <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Realtime Database Connected
            </p>
        </div>
        
        <textarea 
            id="admin-alert-message" 
            rows="3"
            class="w-full px-3 py-2 bg-black/30 border border-red-500/30 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50 resize-none mb-3"
            placeholder="Ketik pesan peringatan global..."></textarea>
        
        <div class="flex gap-2">
            <button onclick="sendGlobalAlert()" 
                    class="flex-1 px-4 py-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white rounded-xl text-sm font-medium transition-all transform active:scale-95 flex items-center justify-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
                </svg>
                Kirim Alert Global
            </button>
            <button onclick="clearGlobalAlert()" 
                    class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-sm font-medium transition-all">
                Clear
            </button>
        </div>
        
        <div class="mt-3 pt-3 border-t border-white/10">
            <p class="text-xs text-gray-500">Status: <span id="admin-status" class="text-green-400">Realtime Active</span></p>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Subscribe ke announcements menggunakan Realtime Database
    subscribeToAnnouncementsRealtime();
}

function toggleAdminPanel() {
    const panel = getElement('admin-tools-panel');
    if (panel) {
        panel.classList.toggle('hidden');
        adminToolsVisible = !panel.classList.contains('hidden');
    }
}

function hideAdminTools() {
    const adminBtn = getElement('admin-btn');
    const panel = getElement('admin-tools-panel');
    if (adminBtn) adminBtn.remove();
    if (panel) panel.remove();
    
    // Unsubscribe dari Realtime Database
    if (announcementsRef) {
        announcementsRef.off('value');
    }
}

// ======================== GLOBAL ALERT SYSTEM (REALTIME DATABASE) ========================

async function sendGlobalAlert() {
    const messageInput = getElement('admin-alert-message');
    if (!messageInput || !messageInput.value.trim()) {
        showNotification('Pesan tidak boleh kosong', 'error');
        return;
    }
    
    try {
        // Simpan ke Realtime Database dengan timestamp server
        await announcementsRef.set({
            message: messageInput.value.trim(),
            sender: currentUser.email,
            senderName: currentUser.displayName || 'Admin',
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            active: true,
            type: 'warning'
        });
        
        messageInput.value = '';
        showNotification('Alert global berhasil dikirim (Realtime)', 'success');
        
        // Tutup panel setelah kirim
        setTimeout(() => toggleAdminPanel(), 500);
        
    } catch (error) {
        console.error('Error sending alert:', error);
        showNotification('Gagal mengirim alert: ' + error.message, 'error');
    }
}

async function clearGlobalAlert() {
    try {
        // Update status active menjadi false
        await announcementsRef.update({
            active: false,
            clearedAt: firebase.database.ServerValue.TIMESTAMP,
            clearedBy: currentUser.email
        });
        
        // Hapus tampilan alert
        removeGlobalAlert();
        showNotification('Alert global dihapus dari Realtime DB', 'success');
        
    } catch (error) {
        console.error('Error clearing alert:', error);
        showNotification('Gagal menghapus alert: ' + error.message, 'error');
    }
}

// ======================== GLOBAL ALERT SYSTEM (REALTIME DATABASE) ========================

function subscribeToAnnouncementsRealtime() {
    if (!announcementsRef) {
        console.error('Announcements reference not initialized');
        return;
    }
    
    // Unsubscribe yang lama jika ada
    announcementsRef.off('value');
    
    // Subscribe ke Realtime Database dengan .on('value')
    announcementsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        
        if (data && data.active === true) {
            showGlobalAlert(data);
        } else {
            removeGlobalAlert();
        }
    }, (error) => {
        console.error('Error subscribing to announcements:', error);
    });
}

// Di bagian STATE MANAGEMENT, tambahkan:
let currentAlertId = null; // Untuk tracking alert yang sedang ditampilkan

// Update fungsi showGlobalAlert:
function showGlobalAlert(data) {
    // Generate unique ID untuk alert ini
    currentAlertId = data.timestamp + '_' + data.sender;
    

    

    // Hapus alert yang lama jika ada
    removeGlobalAlert();
    
    // Format timestamp
    let timeString = 'Baru saja';
    if (data.timestamp) {
        const date = new Date(data.timestamp);
        timeString = date.toLocaleTimeString('id-ID');
    }
    
    // Buat container utama dengan backdrop blur
    const alertContainer = document.createElement('div');
    alertContainer.id = 'global-alert-container';
    alertContainer.className = 'fixed inset-0 z-[300] flex items-center justify-center p-4 pointer-events-auto';
    alertContainer.innerHTML = `
        <!-- Backdrop dengan gradient mesh -->
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onclick="dismissGlobalAlert()"></div>
        
        <!-- Animated background elements -->
        <div class="absolute inset-0 overflow-hidden pointer-events-none">
            <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/20 rounded-full blur-3xl animate-pulse-slow"></div>
            <div class="absolute bottom-1/4 right-1/4 w-80 h-80 bg-orange-500/20 rounded-full blur-3xl animate-pulse-slow" style="animation-delay: 1s;"></div>
            <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-600/10 rounded-full blur-3xl animate-spin-slow"></div>
        </div>
        
        <!-- Main Alert Card -->
        <div class="relative w-full max-w-lg transform scale-0 opacity-0 animate-alert-entrance">
            <!-- Glow effect behind card -->
            <div class="absolute -inset-1 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 rounded-2xl blur opacity-75 animate-glow-pulse"></div>
            
            <!-- Card content -->
            <div class="relative bg-gray-900/95 backdrop-blur-xl border border-red-500/50 rounded-2xl p-6 shadow-2xl overflow-hidden">
                
                <!-- Decorative top line -->
                <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent"></div>
                
                <!-- Scanline effect -->
                <div class="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.4)_50%)] bg-[length:100%_4px] pointer-events-none opacity-30"></div>
                
                <!-- Close button -->
                <button onclick="dismissGlobalAlert()" class="absolute top-4 right-4 p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-300 group">
                    <svg class="w-5 h-5 transform group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
                
                <!-- Icon section dengan animasi -->
                <div class="flex flex-col items-center mb-6">
                    <div class="relative">
                        <!-- Ripple rings -->
                        <div class="absolute inset-0 bg-red-500/30 rounded-full animate-ping"></div>
                        <div class="absolute inset-0 bg-red-500/20 rounded-full animate-ping" style="animation-delay: 0.2s;"></div>
                        
                        <!-- Main icon container -->
                        <div class="relative w-20 h-20 bg-gradient-to-br from-red-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg animate-icon-bounce">
                            <svg class="w-10 h-10 text-white animate-icon-shake" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                            </svg>
                        </div>
                        
                        <!-- Live badge -->
                        <div class="absolute -bottom-1 -right-1 px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-full border-2 border-gray-900 animate-pulse">
                            LIVE
                        </div>
                    </div>
                </div>
                
                <!-- Content -->
                <div class="text-center space-y-3">
                    <h3 class="text-xl font-bold text-white animate-text-slide-up">
                        Peringatan Admin
                    </h3>
                    
                    <div class="relative overflow-hidden">
                        <p class="text-gray-300 text-lg leading-relaxed animate-text-fade-in font-medium">
                            ${escapeHtml(data.message)}
                        </p>
                    </div>
                    
                    <div class="flex items-center justify-center gap-2 text-sm text-gray-500 animate-text-fade-in" style="animation-delay: 0.3s;">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                        </svg>
                        <span>${escapeHtml(data.senderName || 'Admin')}</span>
                        <span class="w-1 h-1 bg-gray-500 rounded-full"></span>
                        <span>${timeString}</span>
                    </div>
                </div>
                
                <!-- Action buttons -->
                <div class="mt-6 flex gap-3 animate-buttons-slide-up">
                    <button onclick="dismissGlobalAlert()" class="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-medium transition-all duration-300 hover:scale-[1.02] active:scale-95">
                        Mengerti
                    </button>
                    ${isAdmin ? `
                    <button onclick="clearGlobalAlert()" class="py-3 px-4 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400 rounded-xl font-medium transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                        Hapus
                    </button>
                    ` : ''}
                </div>
                
                <!-- Bottom decorative element -->
                <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-red-500/50 to-transparent"></div>
            </div>
        </div>
    `;
    
    document.body.appendChild(alertContainer);
    
    // Trigger reflow untuk memastikan animasi berjalan
    void alertContainer.offsetHeight;
    
    // Simpan ke localStorage bahwa alert ini sedang ditampilkan
    localStorage.setItem('currentAlertId', currentAlertId);
    
    // Auto remove setelah 30 detik jika bukan admin
    if (!isAdmin) {
        setTimeout(() => {
            removeGlobalAlert();
        }, 30000);
    }
}

function removeGlobalAlert() {
    const container = document.getElementById('global-alert-container');
    if (container) {
        // Add exit animation
        const card = container.querySelector('.relative.w-full');
        const backdrop = container.querySelector('.absolute.inset-0');
        
        if (card) {
            card.style.animation = 'alert-exit 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards';
        }
        if (backdrop) {
            backdrop.style.animation = 'fade-out 0.3s ease-out forwards';
        }
        
        // Remove after animation
        setTimeout(() => container.remove(), 400);
    }
}

function dismissGlobalAlert() {
    removeGlobalAlert();
    // Simpan timestamp dismiss ke localStorage
    localStorage.setItem('alertDismissedAt', Date.now().toString());
    localStorage.setItem('lastAlertId', currentAlertId || '');
}

async function checkActiveAlert() {
    if (!announcementsRef) return;
    
    try {
        const snapshot = await announcementsRef.once('value');
        const data = snapshot.val();
        
        if (data && data.active === true) {
            // Cek apakah user sudah dismiss alert ini sebelumnya
            const dismissedAt = localStorage.getItem('alertDismissedAt');
            const lastAlertId = localStorage.getItem('lastAlertId');
            const currentAlertTime = data.timestamp;
            
            // Tampilkan jika alert baru atau belum di-dismiss
            if (!dismissedAt || currentAlertTime > parseInt(dismissedAt)) {
                showGlobalAlert(data);
            }
        }
    } catch (error) {
        console.error('Error checking active alert:', error);
    }
}



// ======================== LOAD API CONFIG DARI FIRESTORE ========================
async function loadAPIConfig() {
    try {
        const doc = await db.collection('config').doc('api').get();
        if (doc.exists) {
            API_CONFIG = doc.data();
            currentModel = API_CONFIG.model;
            console.log('API config loaded from Firestore');
            return true;
        } else {
            console.error('API config not found in Firestore');
            showNotification('Konfigurasi API tidak ditemukan', 'error');
            return false;
        }
    } catch (error) {
        console.error('Error loading API config:', error);
        showNotification('Gagal memuat konfigurasi API', 'error');
        return false;
    }
}

// ======================== UTILITY FUNCTIONS ========================
function getElement(id) {
    const el = document.getElementById(id);
    return el;
}

function safeAddClass(id, className) {
    const el = getElement(id);
    if (el) el.classList.add(className);
}

function safeRemoveClass(id, className) {
    const el = getElement(id);
    if (el) el.classList.remove(className);
}

function safeSetText(id, text) {
    const el = getElement(id);
    if (el) el.textContent = text;
}

// ======================== LOADING SCREEN ========================
function updateLoadingStatus(status) {
    safeSetText('loading-status', status);
}

function hideLoadingScreen() {
    const loader = getElement('loading-screen');
    if (!loader) return;
    loader.style.opacity = '0';
    loader.style.transition = 'opacity 0.5s ease-out';
    setTimeout(() => {
        safeAddClass('loading-screen', 'hidden');
        isLoading = false;
    }, 500);
}

function showLoadingScreen() {
    const loader = getElement('loading-screen');
    if (!loader) return;
    safeRemoveClass('loading-screen', 'hidden');
    loader.style.opacity = '1';
    isLoading = true;
}




// Override global functions dengan implementasi yang sebenarnya
window.openAISettings = function() {
    console.log('openAISettings executing...');
    
    if (!currentUser) {
        showNotification('Silakan login terlebih dahulu', 'error');
        return;
    }
    
    // Populate current values
    const nameInput = getElement('ai-name-input');
    if (nameInput) {
        nameInput.value = window.aiSettings.name;
        window.updateCharCount();
    }
    
    const avatarPreview = getElement('ai-settings-avatar-preview');
    if (avatarPreview) {
        avatarPreview.src = window.aiSettings.avatar;
    }
    
    const colorPicker = getElement('ai-primary-color');
    if (colorPicker) {
        colorPicker.value = window.aiSettings.primaryColor;
    }
    
    // Update gradient selection
    document.querySelectorAll('.gradient-option').forEach(el => {
        el.classList.remove('active');
    });
    const activeGradient = document.querySelector(`[onclick="selectGradient('${window.aiSettings.theme}')"]`);
    if (activeGradient) {
        activeGradient.classList.add('active');
    }
    
    // Update personality radio
    const personalityRadio = document.querySelector(`input[name="personality"][value="${window.aiSettings.personality}"]`);
    if (personalityRadio) {
        personalityRadio.checked = true;
    }
    
    // Update toggles
    const animationToggle = getElement('animation-toggle');
    if (animationToggle) animationToggle.checked = window.aiSettings.animationEnabled;
    
    const soundToggle = getElement('sound-toggle');
    if (soundToggle) soundToggle.checked = window.aiSettings.soundEnabled;
    
    const statusToggle = getElement('status-toggle');
    if (statusToggle) statusToggle.checked = window.aiSettings.statusIndicator;
    
    // Show modal
    const modal = getElement('ai-settings-modal');
    if (modal) {
        modal.classList.remove('hidden');
    }
    
    // Close sidebar if open
    const sidebar = getElement('sidebar');
    const overlay = getElement('sidebar-overlay');
    if (sidebar) sidebar.classList.add('-translate-x-full');
    if (overlay) {
        overlay.classList.add('opacity-0');
        setTimeout(() => overlay.classList.add('hidden'), 300);
    }
    
    window.switchTab('appearance');
};

window.closeAISettings = function() {
    safeAddClass('ai-settings-modal', 'hidden');
};

window.switchTab = function(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeTab = getElement(`tab-${tabName}`);
    if (activeTab) activeTab.classList.add('active');
    
    ['appearance', 'personality', 'advanced'].forEach(tab => {
        const content = getElement(`content-${tab}`);
        if (content) content.classList.add('hidden');
    });
    const activeContent = getElement(`content-${tabName}`);
    if (activeContent) activeContent.classList.remove('hidden');
};

window.handleAIAvatarUpload = async function(input) {
    const file = input.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showNotification('File harus berupa gambar (JPG, PNG, WEBP)', 'error');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        showNotification('Ukuran gambar maksimal 5MB', 'error');
        return;
    }
    
    try {
        const base64String = await convertToBase64(file);
        const compressedBase64 = await compressImage(base64String, 800, 800, 0.8);
        
        window.aiSettings.avatar = compressedBase64;
        
        const preview = getElement('ai-settings-avatar-preview');
        if (preview) preview.src = compressedBase64;
        
        // PERBAIKAN: Update semua avatar secara realtime termasuk welcome message
        updateAllAIAvatars();
        
        showNotification('Foto AI berhasil diupdate', 'success');
    } catch (error) {
        console.error('Error uploading AI avatar:', error);
        showNotification('Gagal mengupload foto: ' + error.message, 'error');
    } finally {
        input.value = '';
    }
};


window.resetAIAvatar = function() {
    window.aiSettings.avatar = window.aiSettings.defaultAvatar;
    
    const preview = getElement('ai-settings-avatar-preview');
    if (preview) preview.src = window.aiSettings.defaultAvatar;
    
    // PERBAIKAN: Update semua avatar secara realtime
    updateAllAIAvatars();
    
    showNotification('Foto AI direset ke default', 'success');
};


window.updateCharCount = function() {
    const input = getElement('ai-name-input');
    const counter = getElement('ai-name-char-count');
    if (input && counter) {
        const length = input.value.length;
        counter.textContent = `${length}/50`;
        window.aiSettings.name = input.value.trim() || 'QuEX';
        updateAINameElements();
    }
};

window.selectGradient = function(themeName) {
    window.aiSettings.theme = themeName;
    window.aiSettings.primaryColor = window.gradientThemes[themeName];
    
    document.querySelectorAll('.gradient-option').forEach(el => {
        el.classList.remove('active');
    });
    const selected = document.querySelector(`[onclick="selectGradient('${themeName}')"]`);
    if (selected) selected.classList.add('active');
    
    const colorPreview = getElement('color-preview');
    if (colorPreview) colorPreview.style.background = window.gradientThemes[themeName];
    
    const colorPicker = getElement('ai-primary-color');
    if (colorPicker) {
        const match = window.gradientThemes[themeName].match(/#[a-fA-F0-9]{6}/);
        if (match) colorPicker.value = match[0];
    }
    
    updateAITheme();
};

window.updateAIColor = function(color) {
    window.aiSettings.primaryColor = color;
    window.aiSettings.theme = 'custom';
    
    document.querySelectorAll('.gradient-option').forEach(el => {
        el.classList.remove('active');
    });
    
    const colorPreview = getElement('color-preview');
    if (colorPreview) colorPreview.style.background = color;
    
    updateAITheme();
};

window.updateResponseSpeed = function(value) {
    window.aiSettings.responseSpeed = parseInt(value);
    const labels = ['Lambat', 'Normal', 'Cepat'];
    const display = getElement('response-speed-value');
    if (display) display.textContent = labels[value - 1];
};

window.toggleAnimation = function(enabled) {
    window.aiSettings.animationEnabled = enabled;
    updateAIAnimations();
};

window.toggleStatusIndicator = function(enabled) {
    window.aiSettings.statusIndicator = enabled;
    updateStatusIndicator();
};

window.resetAllAISettings = function() {
    if (confirm('Yakin ingin mereset semua pengaturan AI ke default?')) {
        // ======================== AI CUSTOMIZATION STATE ========================
window.aiSettings = {
    name: 'QuEX',
    avatar: 'https://raw.githubusercontent.com/viannch/Profile-users/refs/heads/main/Proyek%20Baru%20200%20%5B5790EE0%5D.png',
    defaultAvatar: 'https://raw.githubusercontent.com/viannch/Profile-users/refs/heads/main/Proyek%20Baru%20200%20%5B5790EE0%5D.png',
    theme: 'default',
    primaryColor: '#667eea',
    personality: 'friendly',
    responseSpeed: 2,
    animationEnabled: true,
    soundEnabled: false,
    statusIndicator: true
};

window.gradientThemes = {
    default: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    sunset: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    ocean: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    forest: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    gold: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    midnight: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)'
};
        
        window.openAISettings();
        applyAISettings();
        showNotification('Semua pengaturan direset ke default', 'success');
    }
};

window.saveAISettings = async function() {
    const nameInput = getElement('ai-name-input');
    if (nameInput) {
        window.aiSettings.name = nameInput.value.trim() || 'QuEX';
    }
    
    const personalityRadio = document.querySelector('input[name="personality"]:checked');
    if (personalityRadio) window.aiSettings.personality = personalityRadio.value;
    
    const animationToggle = getElement('animation-toggle');
    if (animationToggle) window.aiSettings.animationEnabled = animationToggle.checked;
    
    const soundToggle = getElement('sound-toggle');
    if (soundToggle) window.aiSettings.soundEnabled = soundToggle.checked;
    
    const statusToggle = getElement('status-toggle');
    if (statusToggle) window.aiSettings.statusIndicator = statusToggle.checked;
    
    // PERBAIKAN: Update semua avatar secara realtime
    updateAllAIAvatars();
    
    const saved = await saveAISettingsToFirestore();
    if (saved) window.closeAISettings();
};


// Helper functions untuk AI customization
function updateAIAvatarElements() {
    const avatarElements = [
        'navbar-ai-avatar',
        'welcome-ai-avatar',
        'floating-ai-avatar',
        'ai-settings-avatar-preview',
        'login-ai-avatar',
        'typing-ai-avatar'
    ];
    
    avatarElements.forEach(id => {
        const el = getElement(id);
        if (el) {
            el.style.opacity = '0';
            el.src = window.aiSettings.avatar;
            setTimeout(() => {
                el.style.transition = 'opacity 0.3s ease';
                el.style.opacity = '1';
            }, 50);
        }
    });
}

function updateAINameElements() {
    const nameElements = [
        'navbar-ai-name',
        'welcome-ai-name',
        'login-ai-name'
    ];
    
    nameElements.forEach(id => {
        const el = getElement(id);
        if (el) {
            if (id === 'login-ai-name') {
                el.innerHTML = `${escapeHtml(window.aiSettings.name)} <span class="font-bold">AI</span>`;
            } else if (id === 'welcome-ai-name') {
                el.textContent = `${window.aiSettings.name} AI`;
            } else {
                el.textContent = window.aiSettings.name;
            }
        }
    });
    
    const userInput = getElement('user-input');
    if (userInput) {
        userInput.placeholder = `Tanyakan apa saja kepada ${window.aiSettings.name}...`;
    }
}

function updateAITheme() {
    const colorPreview = getElement('color-preview');
    if (colorPreview) {
        colorPreview.style.background = window.gradientThemes[window.aiSettings.theme] || window.aiSettings.primaryColor;
    }
    document.documentElement.style.setProperty('--ai-primary-color', window.aiSettings.primaryColor);
}

function updateAIAnimations() {
    const floatingContainer = getElement('floating-avatar-container');
    if (floatingContainer) {
        if (window.aiSettings.animationEnabled) {
            floatingContainer.classList.add('animate-float');
            floatingContainer.style.display = 'block';
        } else {
            floatingContainer.classList.remove('animate-float');
            floatingContainer.style.display = 'none';
        }
    }
}

function updateStatusIndicator() {
    const indicator = getElement('navbar-status-indicator');
    if (indicator) {
        indicator.style.display = window.aiSettings.statusIndicator ? 'block' : 'none';
    }
}

function applyAISettings() {
    updateAIAvatarElements();
    updateAINameElements();
    updateAITheme();
    updateAIAnimations();
    updateStatusIndicator();
    
    // PERBAIKAN: Update welcome message jika sedang ditampilkan
    const welcomeAvatar = getElement('welcome-ai-avatar');
    if (welcomeAvatar) {
        welcomeAvatar.src = window.aiSettings.avatar;
    }
    
    const welcomeName = getElement('welcome-ai-name');
    if (welcomeName && currentUser) {
        welcomeName.textContent = `Selamat Datang, ${currentUser.displayName || 'User'}!`;
    }
}


async function loadAISettings() {
    if (!currentUser) return;
    
    try {
        const doc = await db.collection('users').doc(currentUser.uid).collection('settings').doc('ai').get();
        if (doc.exists) {
            const data = doc.data();
            window.aiSettings = { ...window.aiSettings, ...data };
            if (!window.aiSettings.avatar) {
                window.aiSettings.avatar = window.aiSettings.defaultAvatar;
            }
        }
        applyAISettings();
    } catch (error) {
        console.error('Error loading AI settings:', error);
        applyAISettings();
    }
}

async function saveAISettingsToFirestore() {
    if (!currentUser) {
        showNotification('Silakan login terlebih dahulu', 'error');
        return false;
    }
    
    try {
        await db.collection('users').doc(currentUser.uid).collection('settings').doc('ai').set({
            ...window.aiSettings,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        showNotification('Pengaturan AI berhasil disimpan', 'success');
        return true;
    } catch (error) {
        console.error('Error saving AI settings:', error);
        showNotification('Gagal menyimpan pengaturan: ' + error.message, 'error');
        return false;
    }
}

// ======================== AUTHENTICATION ========================
auth.onAuthStateChanged(async (user) => {
    updateLoadingStatus('Memeriksa autentikasi...');
    
    if (user) {
        // Inisialisasi Realtime Database
        initRealtimeDB();
        
        
        // PERBAIKAN: Subscribe semua user ke announcements (bukan hanya admin)
        subscribeToAnnouncementsRealtime();

        if (isAdmin) {
            showAdminTools();
        }


        
        // Load API config
        const apiLoaded = await loadAPIConfig();
        if (!apiLoaded) {
            showNotification('Gagal memuat konfigurasi sistem', 'error');
            hideLoadingScreen();
            return;
        }
        
        // PERBAIKAN: Cek status admin
        isAdmin = await checkAdminStatus(user.email);
        if (isAdmin) {
            console.log('Admin logged in:', user.email);
        }
        
        currentChatId = Date.now().toString();
        conversationContext = [];
        chatHistory = [];
        
        currentUser = user;
        
        const isNewUser = user.metadata.creationTime === user.metadata.lastSignInTime;
        
        await loadUserProfile();
        
        if (isNewUser && user.photoURL) {
            await saveGoogleAvatar(user.photoURL);
        }
        
        if (isNewUser) {
            await initializeNewUser(user);
        }
        
        await loadUserLevelData();
        // Show level container
        const levelContainer = document.getElementById('user-level-container');
        if (levelContainer) levelContainer.classList.remove('hidden');

        
        await loadAISettings();
        
        if (isNewUser) {
            conversationContext = [];
            chatHistory = [];
            currentChatId = Date.now().toString();
        }
        
        updateAllAIAvatars();
        updateUserInfo(user);
        
        // PERBAIKAN: Tampilkan tools admin jika user adalah admin
        if (isAdmin) {
            showAdminTools();
        }
        
        safeAddClass('login-modal', 'hidden');
        await loadUserData();
        
        if (isNewUser || chatHistory.length === 0) {
            showEmptyWelcome();
        }
        
        hideLoadingScreen();
        showMainApp();
    } else {
        currentUser = null;
        isAdmin = false;
        hideAdminTools();
        hideLoadingScreen();
        showLoginModal();
    }
});



function showEmptyWelcome() {
    const container = getElement('chat-container');
    if (!container) return;
    
    const avatarUrl = window.aiSettings && window.aiSettings.avatar 
        ? window.aiSettings.avatar 
        : 'https://raw.githubusercontent.com/viannch/Profile-users/refs/heads/main/Proyek%20Baru%20200%20%5B5790EE0%5D.png';
    
    const aiName = window.aiSettings && window.aiSettings.name 
        ? window.aiSettings.name 
        : 'AI';
    
    container.innerHTML = `
        <div id="welcome-message" class="flex flex-col items-center justify-center h-full text-center space-y-3 animate-fade-in">
            <div class="relative">
                <div class="absolute -inset-4 bg-white/10 blur-xl rounded-full animate-pulse-slow"></div>
                <img id="welcome-ai-avatar" src="${avatarUrl}" 
                     alt="${escapeHtml(aiName)}" 
                     class="relative w-16 h-16 rounded-full border-2 border-gray-700 object-cover">
            </div>
            <h2 id="welcome-ai-name" class="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Selamat Datang${currentUser ? ', ' + (currentUser.displayName || 'User') : ''}!</h2>
            <p class="text-gray-400 max-w-md text-sm">Istrimu yang siap membantumu sepanjang waktu. Tanyakan apa saja, saya siap membantu 24/7. Klik profil AI untuk Kustomisasi.</p>
        </div>
    `;
    
    // Reset input
    const userInput = getElement('user-input');
    if (userInput) {
        userInput.value = '';
        userInput.style.height = 'auto';
        userInput.placeholder = `Tanyakan apa saja kepada ${aiName}...`;
    }
}


function showLoginModal() {
    safeRemoveClass('login-modal', 'hidden');
    safeAddClass('sidebar', '-translate-x-full');
    document.body.style.overflow = 'hidden';
}

function showMainApp() {
    document.body.style.overflow = '';
    const input = getElement('user-input');
    if (input) input.focus();
}

async function loadUserProfile() {
    if (!currentUser) return;
    try {
        const doc = await db.collection('users').doc(currentUser.uid).get();
        if (doc.exists) {
            const data = doc.data();
            // PERBAIKAN: Prioritaskan avatarBase64, kemudian photoURL
            if (data.avatarBase64) {
                customAvatarData = data.avatarBase64;
            } else if (data.photoURL) {
                customAvatarData = data.photoURL;
            }
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}


function updateUserInfo(user) {
    const userInfo = document.getElementById('user-info');
    const userAvatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-name');
    const userEmail = document.getElementById('user-email');
    const levelContainer = document.getElementById('user-level-container');

    if (userInfo) userInfo.classList.remove('hidden');
    
    const avatarSrc = customAvatarData || user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email)}&background=random&color=fff`;
    
    if (userAvatar) userAvatar.src = avatarSrc;
    if (userName) userName.textContent = user.displayName || 'User';
    if (userEmail) userEmail.textContent = user.email;
    
    // Tampilkan level container
    if (levelContainer) levelContainer.classList.remove('hidden');
}



function toggleAuthMode() {
    isRegisterMode = !isRegisterMode;
    const submitBtn = getElement('auth-submit-btn');
    const toggleText = getElement('auth-toggle-text');
    const toggleBtn = getElement('auth-toggle-btn');
    const btnText = getElement('auth-btn-text');

    if (submitBtn) {
        submitBtn.disabled = false;
        if (isRegisterMode) {
            if (btnText) btnText.textContent = 'Daftar';
        } else {
            if (btnText) btnText.textContent = 'Masuk';
        }
    }
    
    if (toggleText) toggleText.textContent = isRegisterMode ? 'Sudah punya akun?' : 'Belum memiliki akun?';
    if (toggleBtn) toggleBtn.textContent = isRegisterMode ? 'Masuk' : 'Daftar sekarang';
    
    const errorDiv = getElement('auth-error');
    if (errorDiv) errorDiv.classList.add('hidden');
}

function handleEmailAuth(e) {
    e.preventDefault();
    const emailInput = getElement('email-input');
    const passwordInput = getElement('password-input');
    
    if (!emailInput || !passwordInput) return;
    
    const email = emailInput.value;
    const password = passwordInput.value;
    const errorDiv = getElement('auth-error');
    const submitBtn = getElement('auth-submit-btn');
    const btnText = getElement('auth-btn-text');

    if (errorDiv) errorDiv.classList.add('hidden');
    if (submitBtn) submitBtn.disabled = true;
    if (btnText) btnText.textContent = isRegisterMode ? 'Mendaftar...' : 'Login...';

    if (isRegisterMode) {
        auth.createUserWithEmailAndPassword(email, password)
            .then(() => {
                showLoadingScreen();
                updateLoadingStatus('Membuat akun baru...');
            })
            .catch((error) => {
                showAuthError(error.message);
                if (submitBtn) submitBtn.disabled = false;
                if (btnText) btnText.textContent = 'Daftar';
            });
    } else {
        auth.signInWithEmailAndPassword(email, password)
            .then(() => {
                showLoadingScreen();
                updateLoadingStatus('Masuk ke akun...');
            })
            .catch((error) => {
                showAuthError(error.message);
                if (submitBtn) submitBtn.disabled = false;
                if (btnText) btnText.textContent = 'Masuk';
            });
    }
}

function signInWithGoogle() {
    showLoadingScreen();
    updateLoadingStatus('Menghubungkan ke Google...');
    
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .then(() => {
            updateLoadingStatus('Berhasil login dengan Google...');
        })
        .catch((error) => {
            hideLoadingScreen();
            showAuthError(error.message);
        });
}

function logout() {
    closeSettingsModal();
    if (confirm('Yakin ingin logout? Semua data chat tersimpan di cloud.')) {
        showLoadingScreen();
        updateLoadingStatus('Keluar dari akun...');
        
        // PERBAIKAN: Hide admin tools
        hideAdminTools();
        removeGlobalAlert();
        
        resetAllState();
        
        auth.signOut().then(() => {
            hideLoadingScreen();
        }).catch((error) => {
            console.error('Logout error:', error);
            hideLoadingScreen();
        });
    }
}


// Fungsi baru untuk reset semua state
function resetAllState() {
    chatHistory = [];
    conversationContext = [];
    currentChatId = Date.now().toString();
    customAvatarData = null;
    window.aiSettings = {
        name: 'QuEX',
        avatar: 'https://raw.githubusercontent.com/viannch/Profile-users/refs/heads/main/Proyek%20Baru%20200%20%5B5790EE0%5D.png',
        defaultAvatar: 'https://raw.githubusercontent.com/viannch/Profile-users/refs/heads/main/Proyek%20Baru%20200%20%5B5790EE0%5D.png',
        theme: 'default',
        primaryColor: '#667eea',
        personality: 'friendly',
        responseSpeed: 2,
        animationEnabled: true,
        soundEnabled: false,
        statusIndicator: true
    };
    
    // Hide level container on logout
    const levelContainer = document.getElementById('user-level-container');
    if (levelContainer) {
        levelContainer.classList.add('hidden');
        levelContainer.innerHTML = '';
    }
    
    // Reset level data
    userLevelData = {
        level: 1,
        currentXP: 0,
        totalXP: 0,
        totalMessages: 0,
        lastMessageTime: null
    };
    
    
    // Reset UI
    const chatHistoryEl = getElement('chat-history');
    if (chatHistoryEl) chatHistoryEl.innerHTML = '<div class="text-gray-600 text-sm text-center py-4">Belum ada riwayat chat</div>';
    
    const chatContainer = getElement('chat-container');
    if (chatContainer) {
        chatContainer.innerHTML = `
            <div id="welcome-message" class="flex flex-col items-center justify-center h-full text-center space-y-3 animate-fade-in">
                <div class="relative">
                    <div class="absolute -inset-4 bg-white/10 blur-xl rounded-full animate-pulse-slow"></div>
                    <img id="welcome-ai-avatar" src="${window.aiSettings.avatar}" 
                         alt="${window.aiSettings.name}" 
                         class="relative w-16 h-16 rounded-full border-2 border-gray-700 object-cover">
                </div>
                <h2 id="welcome-ai-name" class="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Selamat Datang!</h2>
                <p class="text-gray-400 max-w-md text-sm">Istrimu yang siap membantumu sepanjang waktu. Tanyakan apa saja, saya siap membantu 24/7.</p>
            </div>
        `;
    }
    
    const userInput = getElement('user-input');
    if (userInput) {
        userInput.value = '';
        userInput.style.height = 'auto';
        userInput.placeholder = `Tanyakan apa saja kepada ${window.aiSettings.name}...`;
    }
}

function showAuthError(message) {
    const errorDiv = getElement('auth-error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
    }
}

// ======================== AVATAR UPLOAD ========================
async function handleAvatarUpload(input) {
    const file = input.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showNotification('File harus berupa gambar', 'error');
        return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
        showNotification('Ukuran gambar maksimal 2MB', 'error');
        return;
    }

    const avatarLoading = getElement('avatar-loading');
    if (avatarLoading) avatarLoading.classList.remove('hidden');

    try {
        const base64String = await convertToBase64(file);
        const compressedBase64 = await compressImage(base64String, 800, 800, 0.8);
        
        await db.collection('users').doc(currentUser.uid).set({
            avatarBase64: compressedBase64,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        customAvatarData = compressedBase64;
        
        const settingsAvatar = getElement('settings-avatar');
        const userAvatar = getElement('user-avatar');
        if (settingsAvatar) settingsAvatar.src = compressedBase64;
        if (userAvatar) userAvatar.src = compressedBase64;
        
        showNotification('Foto profil berhasil diperbarui', 'success');
    } catch (error) {
        console.error('Error uploading avatar:', error);
        showNotification('Gagal mengupload foto: ' + error.message, 'error');
    } finally {
        if (avatarLoading) avatarLoading.classList.add('hidden');
        input.value = '';
    }
}

function convertToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function compressImage(base64Str, maxWidth, maxHeight, quality) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width *= maxHeight / height;
                    height = maxHeight;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
    });
}

// ======================== SETTINGS MODAL ========================
function openSettings() {
    if (!currentUser) return;
    
    // PERBAIKAN: Gunakan avatar yang sudah tersimpan atau dari Google
    const avatarSrc = customAvatarData || currentUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName || currentUser.email)}&background=random&color=fff`;
    
    const settingsAvatar = getElement('settings-avatar');
    const settingsName = getElement('settings-name');
    const settingsEmail = getElement('settings-email');
    const settingsUid = getElement('settings-uid');
    const settingsProvider = getElement('settings-provider');
    const settingsVerified = getElement('settings-verified');
    const settingsCreated = getElement('settings-created');
    const settingsLastLogin = getElement('settings-last-login');
    const settingsTotalChats = getElement('settings-total-chats');
    const settingsTotalMessages = getElement('settings-total-messages');

    if (settingsAvatar) settingsAvatar.src = avatarSrc;
    if (settingsName) settingsName.textContent = currentUser.displayName || 'User';
    if (settingsEmail) settingsEmail.textContent = currentUser.email;
    if (settingsUid) settingsUid.textContent = currentUser.uid.substring(0, 12) + '...';
    if (settingsProvider) settingsProvider.textContent = currentUser.providerData[0]?.providerId.replace('.com', '') || 'email';
    if (settingsVerified) settingsVerified.textContent = currentUser.emailVerified ? '✅ Yes' : '❌ No';
    if (settingsCreated) settingsCreated.textContent = currentUser.metadata.creationTime ? new Date(currentUser.metadata.creationTime).toLocaleDateString('id-ID') : '-';
    if (settingsLastLogin) settingsLastLogin.textContent = currentUser.metadata.lastSignInTime ? new Date(currentUser.metadata.lastSignInTime).toLocaleDateString('id-ID') : '-';
    if (settingsTotalChats) settingsTotalChats.textContent = chatHistory.length;
    
    const totalMessages = chatHistory.reduce((acc, chat) => acc + (chat.messages?.length || 0), 0);
    if (settingsTotalMessages) settingsTotalMessages.textContent = totalMessages;
    
    safeRemoveClass('settings-modal', 'hidden');
    closeSidebar();
}


function closeSettingsModal() {
    safeAddClass('settings-modal', 'hidden');
}

async function loadUserData() {
    updateLoadingStatus('Memuat data chat dari cloud...');
    
    if (!currentUser) return;
    
    try {
        // PERBAIKAN: Clear chat history sebelum load data baru
        chatHistory = [];
        
        const snapshot = await db.collection('users').doc(currentUser.uid).collection('chats')
            .orderBy('timestamp', 'desc')
            .limit(50)
            .get();

        snapshot.forEach(doc => {
            const data = doc.data();
            chatHistory.push({ 
                id: doc.id, 
                ...data,
                title: data.title || 'Percakapan Tanpa Judul'
            });
        });

        if (chatHistory.length > 0) {
            currentChatId = chatHistory[0].id;
            conversationContext = chatHistory[0].messages || [];
            renderMessages();
        } else {
            // PERBAIKAN: Jika tidak ada chat, buat chat baru kosong
            currentChatId = Date.now().toString();
            conversationContext = [];
            showEmptyWelcome();
        }

        loadChatHistory();
    } catch (error) {
        console.error('Error loading data:', error);
        showNotification('Gagal memuat data dari cloud', 'error');
        // Fallback ke chat kosong
        currentChatId = Date.now().toString();
        conversationContext = [];
        showEmptyWelcome();
    }
}


async function saveCurrentChat() {
    if (!currentUser) return;

    // PERBAIKAN: Cek apakah ada pesan sebelum menyimpan
    if (!conversationContext || conversationContext.length === 0) {
        console.log('Tidak ada pesan untuk disimpan');
        return;
    }

    const existingIndex = chatHistory.findIndex(chat => chat.id === currentChatId);
    
    // PERBAIKAN: Ambil pesan pertama dari user untuk judul
    const firstUserMessage = conversationContext.find(msg => msg.role === 'user');
    let title = 'Percakapan Baru';
    
    if (firstUserMessage && firstUserMessage.content) {
        title = firstUserMessage.content.substring(0, 30);
        if (firstUserMessage.content.length > 30) {
            title += '...';
        }
    } else {
        // Jika tidak ada pesan user, coba ambil pesan AI pertama
        const firstAIMessage = conversationContext.find(msg => msg.role === 'assistant');
        if (firstAIMessage && firstAIMessage.content) {
            title = firstAIMessage.content.substring(0, 30);
            if (firstAIMessage.content.length > 30) {
                title += '...';
            }
        }
    }

    const chatData = {
        id: currentChatId,
        title: title,
        date: new Date().toLocaleDateString('id-ID'),
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        messages: conversationContext
    };

    try {
        await db.collection('users').doc(currentUser.uid).collection('chats').doc(currentChatId).set(chatData);
        
        if (existingIndex >= 0) {
            chatHistory[existingIndex] = { ...chatData, timestamp: Date.now() };
        } else {
            chatHistory.unshift({ ...chatData, timestamp: Date.now() });
        }

        if (chatHistory.length > 50) {
            const oldChats = chatHistory.slice(50);
            chatHistory = chatHistory.slice(0, 50);
            
            for (const chat of oldChats) {
                await db.collection('users').doc(currentUser.uid).collection('chats').doc(chat.id).delete();
            }
        }

        loadChatHistory();
    } catch (error) {
        console.error('Error saving chat:', error);
    }
}


async function deleteChatFromFirestore(chatId) {
    if (!currentUser) return false;
    
    try {
        await db.collection('users').doc(currentUser.uid).collection('chats').doc(chatId).delete();
        return true;
    } catch (error) {
        console.error('Error deleting chat:', error);
        return false;
    }
}

// ======================== SIDEBAR FUNCTIONS ========================
function openSidebar() {
    const sidebar = getElement('sidebar');
    const overlay = getElement('sidebar-overlay');
    
    if (sidebar) sidebar.classList.remove('-translate-x-full');
    if (overlay) {
        overlay.classList.remove('hidden');
        setTimeout(() => overlay.classList.remove('opacity-0'), 10);
    }
    document.body.style.overflow = 'hidden';
}

function closeSidebar() {
    const sidebar = getElement('sidebar');
    const overlay = getElement('sidebar-overlay');
    
    if (sidebar) sidebar.classList.add('-translate-x-full');
    if (overlay) {
        overlay.classList.add('opacity-0');
        setTimeout(() => overlay.classList.add('hidden'), 300);
    }
    document.body.style.overflow = '';
}

// ======================== CHAT FUNCTIONS ========================
function autoResize(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 128) + 'px';
}

function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

function setPrompt(text) {
    const input = getElement('user-input');
    if (!input) return;
    input.value = text;
    input.focus();
    autoResize(input);
    if (window.innerWidth < 768) {
        closeSidebar();
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function newChat() {
    // Simpan chat sebelumnya jika ada
    const hasValidMessages = conversationContext && 
                            conversationContext.length > 0 && 
                            conversationContext.some(msg => msg.role === 'user' || msg.role === 'assistant');
    
    if (hasValidMessages) {
        await saveCurrentChat();
    }
    
    // PERBAIKAN: Generate ID baru dan reset context
    currentChatId = Date.now().toString();
    conversationContext = [];
    
    showEmptyWelcome();
    
    if (window.innerWidth < 768) {
        closeSidebar();
    }
}






async function clearChat() {
    if (confirm('Yakin ingin menghapus percakapan ini?')) {
        const success = await deleteChatFromFirestore(currentChatId);
        if (success) {
            chatHistory = chatHistory.filter(chat => chat.id !== currentChatId);
            await newChat();
            loadChatHistory();
            showNotification('Chat dihapus', 'success');
        }
    }
}

function loadChatHistory() {
    const container = getElement('chat-history');
    if (!container) return;
    
    if (chatHistory.length === 0) {
        container.innerHTML = '<div class="text-gray-600 text-sm text-center py-4">Belum ada riwayat chat</div>';
        return;
    }
    
    container.innerHTML = chatHistory.map(chat => {
        let displayTitle = chat.title;
        if (!displayTitle || displayTitle === 'undefined...' || displayTitle === 'undefined') {
            displayTitle = 'Percakapan Baru';
        }
        
        return `
        <div class="group flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800 cursor-pointer transition-all border border-transparent hover:border-gray-700 ${chat.id === currentChatId ? 'bg-gray-800 border-gray-700' : ''}" 
             onclick="switchToChat('${chat.id}')">
            <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
            <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-gray-300 truncate">${escapeHtml(displayTitle)}</div>
                <div class="text-xs text-gray-600">${chat.date || new Date().toLocaleDateString('id-ID')}</div>
            </div>
            <button onclick="event.stopPropagation(); deleteChat('${chat.id}')" class="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-900/50 rounded transition-all">
                <svg class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        </div>
    `}).join('');
}

// ======================== AI AVATAR SYNC FUNCTION ========================
function updateAllAIAvatars() {
    const avatarUrl = window.aiSettings && window.aiSettings.avatar 
        ? window.aiSettings.avatar 
        : 'https://raw.githubusercontent.com/viannch/Profile-users/refs/heads/main/Proyek%20Baru%20200%20%5B5790EE0%5D.png';
    
    const name = window.aiSettings && window.aiSettings.name 
        ? window.aiSettings.name 
        : 'QuEX';
    
    // Update navbar
    const navbarAvatar = getElement('navbar-ai-avatar');
    if (navbarAvatar) navbarAvatar.src = avatarUrl;
    
    // Update welcome message (jika sedang ditampilkan)
    const welcomeAvatar = getElement('welcome-ai-avatar');
    if (welcomeAvatar) welcomeAvatar.src = avatarUrl;
    
    // Update floating avatar
    const floatingAvatar = getElement('floating-ai-avatar');
    if (floatingAvatar) floatingAvatar.src = avatarUrl;
    
    // Update login modal avatar
    const loginAvatar = getElement('login-ai-avatar');
    if (loginAvatar) loginAvatar.src = avatarUrl;
    
    // Update typing indicator avatar di template
    const typingTemplate = getElement('typing-template');
    if (typingTemplate) {
        const typingAvatar = typingTemplate.content.getElementById('typing-ai-avatar');
        if (typingAvatar) typingAvatar.src = avatarUrl;
    }
    
    // Update nama di navbar
    const navbarName = getElement('navbar-ai-name');
    if (navbarName) navbarName.textContent = name;
    
    // Update welcome name
    const welcomeName = getElement('welcome-ai-name');
    if (welcomeName && currentUser) {
        welcomeName.textContent = `Selamat Datang, ${currentUser.displayName || 'User'}!`;
    }
    
    // Update placeholder input
    const userInput = getElement('user-input');
    if (userInput) {
        userInput.placeholder = `Tanyakan apa saja kepada ${name}...`;
    }
    
    // Update AI settings modal preview
    const settingsPreview = getElement('ai-settings-avatar-preview');
    if (settingsPreview) settingsPreview.src = avatarUrl;
    
    const nameInput = getElement('ai-name-input');
    if (nameInput) nameInput.value = name;
}



async function switchToChat(chatId) {
    await saveCurrentChat();
    currentChatId = chatId;
    const chat = chatHistory.find(c => c.id === chatId);
    if (chat) {
        conversationContext = chat.messages || [];
        renderMessages();
    }
    loadChatHistory();
    if (window.innerWidth < 768) {
        closeSidebar();
    }
}

async function deleteChat(chatId) {
    if (confirm('Hapus chat ini?')) {
        const success = await deleteChatFromFirestore(chatId);
        if (success) {
            chatHistory = chatHistory.filter(chat => chat.id !== chatId);
            if (chatId === currentChatId) {
                await newChat();
            } else {
                loadChatHistory();
            }
            showNotification('Chat dihapus', 'success');
        }
    }
}

function renderMessages() {
    const container = getElement('chat-container');
    if (!container) return;
    
    container.innerHTML = '';
    conversationContext.forEach(msg => {
        addMessageToUI(msg.content, msg.role === 'user' ? 'user' : 'ai', false);
    });
    scrollToBottom();
}

async function sendMessage() {
    if (isProcessing) return;
    
    const input = getElement('user-input');
    const sendBtn = getElement('send-btn');
    const xpGained = getRandomXP();
    await addXP(xpGained);
    
    // Optional: Show XP gained notification
    showXPNotification(xpGained);

    if (!input) return;
    
    const message = input.value.trim();
    if (!message) return;
    
    if (!navigator.onLine) {
        alert('Anda sedang offline. Periksa koneksi internet.');
        return;
    }
    
    function showXPNotification(xp) {
    const notif = document.createElement('div');
    notif.className = 'fixed bottom-24 right-4 bg-green-600/90 text-white px-3 py-1 rounded-full text-sm animate-slide-up z-50';
    notif.innerHTML = `+${xp} XP`;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 2000);
}

    isProcessing = true;
    
    // Efek loading pada tombol
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.classList.add('loading');
        sendBtn.innerHTML = `
            <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
        `;
    }

    const welcome = getElement('welcome-message');
    if (welcome) welcome.remove();

    // Tambahkan pesan user (langsung, tanpa typing)
    addMessageToUI(message, 'user', true);
    conversationContext.push({ role: 'user', content: message });
    input.value = '';
    input.style.height = 'auto';

    // Tampilkan typing indicator (titik-titik)
    showTypingIndicator();

    try {
        const response = await fetchAIResponse(message);
        removeTypingIndicator();
        
        if (response) {
            // GUNAKAN TYPING EFFECT untuk AI response
            await addAIMessageWithTyping(response, true);
            
            conversationContext.push({ role: 'assistant', content: response });
            await saveCurrentChat();
            loadChatHistory();
            updateAPIStatus('✅ Terhubung', 'green');
        }
    } catch (error) {
        removeTypingIndicator();
        console.error('Error detail:', error);
        
        // Error message tetap ditampilkan langsung
        addMessageToUI('Maaf sayang, ada masalah nih 😅 ' + error.message, 'ai', true, true);
        updateAPIStatus('❌ Error', 'red');
    } finally {
        isProcessing = false;
        
        // Kembalikan tombol ke state normal
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.classList.remove('loading');
            sendBtn.innerHTML = `
                <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out"></div>
                <div class="relative flex items-center justify-center transition-transform duration-300 group-hover:rotate-45">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
                    </svg>
                </div>
            `;
        }
    }
}


// ======================== EMOJI PICKER ========================

// Emoji data berdasarkan kategori
const emojiData = {
    recent: [], // Akan diisi dengan emoji yang baru digunakan
    smileys: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'],
    hearts: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🈳', '🈂', '🛂', '🛃', '🛄', '🛅', '🛗', '🚹', '🚺', '🚼', '⚧', '🚻', '🚮', '🎦', '📶', '🈁', '🔣', 'ℹ️', '🔤', '🔡', '🔠', '🆖', '🆗', '🆙', '🆒', '🆕', '🆓', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🔢', '#️⃣', '*️⃣', '⏏️', '▶️', '⏸', '⏯', '⏹', '⏺', '⏭', '⏮', '⏩', '⏪', '⏫', '⏬', '◀️', '🔼', '🔽', '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↕️', '↔️', '↪️', '↩️', '⤴️', '⤵️', '🔀', '🔁', '🔂', '🔄', '🔃', '🎵', '🎶', '➕', '➖', '➗', '✖️', '💲', '💱', '™️', '©️', '®️', '〰️', '➰', '➿', '🔚', '🔙', '🔛', '🔝', '🔜', '✔️', '☑️', '🔘', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔺', '🔻', '🔸', '🔹', '🔶', '🔷', '🔳', '🔲', '▪️', '▫️', '◾', '◽', '◼️', '◻️', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛', '⬜', '🟫', '🔈', '🔇', '🔉', '🔊', '🔔', '🔕', '📣', '📢', '💬', '💭', '🗯', '♠️', '♣️', '♥️', '♦️', '🃏', '🎴', '🀄', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛', '🕜', '🕝', '🕞', '🕟', '🕠', '🕡', '🕢', '🕣', '🕤', '🕥', '🕦', '🕧'],
    hands: ['👋', '🤚', '🖐', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦵', '🦿', '🦶', '👣', '👂', '🦻', '👃', '🫀', '🫁', '🧠', '🦷', '🦴', '👀', '👁', '👅', '👄', '💋', '🩸'],
    animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷', '🕸', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🪶', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊', '🐇', '🦝', '🦨', '🦡', '🦫', '🦦', '🦥', '🐁', '🐀', '🐿', '🦔', '🐾', '🐉', '🐲', '🌵', '🎄', '🌲', '🌳', '🌴', '🌱', '🌿', '☘️', '🍀', '🎍', '🪴', '🎋', '🍃', '🍂', '🍁', '🍄', '🐚', '🌾', '💐', '🌷', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '🌞', '🌝', '🌛', '🌜', '🌚', '🌕', '🌖', '🌗', '🌘', '🌑', '🌒', '🌓', '🌔', '🌙', '🌎', '🌍', '🌏', '🪐', '💫', '⭐️', '🌟', '✨', '⚡️', '☄️', '💥', '🔥', '🌪', '🌈', '☀️', '🌤', '⛅️', '🌥', '☁️', '🌦', '🌧', '⛈', '🌩', '🌨', '❄️', '☃️', '⛄️', '🌬', '💨', '💧', '💦', '☔️', '☂️', '🌊', '🌫'],
    food: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🍍', '🥝', '🥥', '🥑', '🍆', '🥔', '🥕', '🌽', '🌶', '🫑', '🥒', '🥬', '🥦', '🧄', '🧅', '🍄', '🥜', '🌰', '🍞', '🥐', '🥖', '🥨', '🥯', '🥞', '🧇', '🧀', '🍖', '🍗', '🥩', '🥓', '🍔', '🍟', '🍕', '🌭', '🥪', '🌮', '🌯', '🫔', '🥙', '🧆', '🥚', '🍳', '🥘', '🍲', '🫕', '🥣', '🥗', '🍿', '🧈', '🧂', '🥫', '🍱', '🍘', '🍙', '🍚', '🍛', '🍜', '🍝', '🍠', '🍢', '🍣', '🍤', '🍥', '🥮', '🍡', '🥟', '🥠', '🥡', '🦀', '🦞', '🦐', '🦑', '🦪', '🍦', '🍧', '🍨', '🍩', '🍪', '🎂', '🍰', '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '🍯', '🍼', '🥛', '☕️', '🫖', '🍵', '🧃', '🥤', '🧋', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾', '🧊', '🥄', '🍴', '🍽', '🥣', '🥡', '🥢', '🧂'],
    activities: ['⚽️', '🏀', '🏈', '⚾️', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳️', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸', '🥌', '🎿', '⛷', '🏂', '🪂', '🏋️', '🏋️‍♂️', '🏋️‍♀️', '🤼', '🤼‍♂️', '🤼‍♀️', '🤸', '🤸‍♂️', '🤸‍♀️', '⛹️', '⛹️‍♂️', '⛹️‍♀️', '🤺', '🤾', '🤾‍♂️', '🤾‍♀️', '🏌️', '🏌️‍♂️', '🏌️‍♀️', '🏇', '🧘', '🧘‍♂️', '🧘‍♀️', '🏄', '🏄‍♂️', '🏄‍♀️', '🏊', '🏊‍♂️', '🏊‍♀️', '🤽', '🤽‍♂️', '🤽‍♀️', '🚣', '🚣‍♂️', '🚣‍♀️', '🧗', '🧗‍♂️', '🧗‍♀️', '🚵', '🚵‍♂️', '🚵‍♀️', '🚴', '🚴‍♂️', '🚴‍♀️', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖', '🏵', '🎗', '🎫', '🎟', '🎪', '🤹', '🤹‍♂️', '🤹‍♀️', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🪘', '🎷', '🎺', '🪗', '🎸', '🪕', '🎻', '🎲', '♟', '🎯', '🎳', '🎮', '🎰', '🧩'],
    objects: ['⌚️', '📱', '📲', '💻', '⌨️', '🖥', '🖨', '🖱', '🖲', '🕹', '🗜', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽', '🎞', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙', '🎚', '🎛', '🧭', '⏱', '⏲', '⏰', '🕰', '⌛️', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯', '🪔', '🧯', '🛢', '💸', '💵', '💴', '💶', '💷', '🪙', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🪛', '🔧', '🔨', '⚒', '🛠', '⛏', '🪚', '🔩', '⚙️', '🪤', '🧱', '⛓', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡', '⚔️', '🛡', '🚬', '⚰️', '🪦', '⚱️', '🏺', '🔮', '📿', '🧿', '💎', '🔔', '🔕', '📢', '📣', '🥁', '🪘', '📯', '🔔', '🎐', '🎊', '🎉', '🎈', '🎀', '🎁', '🎗', '🏷', '📮', '📫', '📪', '📬', '📭', '📦', '📫', '📪', '📬', '📭', '📦', '📯', '📜', '📃', '📄', '📑', '🧾', '📊', '📈', '📉', '🗒', '🗓', '📆', '📅', '🗑', '📇', '🗃', '🗳', '🗄', '📋', '📁', '📂', '🗂', '🗞', '📰', '📓', '📔', '📒', '📕', '📗', '📘', '📙', '📚', '📖', '🔖', '🧷', '🔗', '📎', '🖇', '📐', '📏', '🧮', '📌', '📍', '✂️', '🖊', '🖋', '✒️', '🖌', '🖍', '📝', '✏️', '🔍', '🔎', '🔏', '🔐', '🔒', '🔓']
};

let currentEmojiCategory = 'recent';
let recentEmojis = JSON.parse(localStorage.getItem('recentEmojis')) || [];

// Toggle emoji picker
function toggleEmojiPicker() {
    const picker = getElement('emoji-picker');
    const btn = getElement('emoji-btn');
    
    if (picker.classList.contains('hidden')) {
        picker.classList.remove('hidden');
        btn.classList.add('active');
        showEmojiCategory('recent');
        
        // Close picker when clicking outside
        setTimeout(() => {
            document.addEventListener('click', closeEmojiPickerOutside);
        }, 100);
    } else {
        closeEmojiPicker();
    }
}

function closeEmojiPicker() {
    const picker = getElement('emoji-picker');
    const btn = getElement('emoji-btn');
    picker.classList.add('hidden');
    btn.classList.remove('active');
    document.removeEventListener('click', closeEmojiPickerOutside);
}

function closeEmojiPickerOutside(e) {
    const picker = getElement('emoji-picker');
    const btn = getElement('emoji-btn');
    
    if (!picker.contains(e.target) && !btn.contains(e.target)) {
        closeEmojiPicker();
    }
}

// Show emoji category
function showEmojiCategory(category) {
    currentEmojiCategory = category;
    const grid = getElement('emoji-grid');
    const buttons = document.querySelectorAll('.emoji-cat-btn');
    
    // Update active button
    buttons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.includes(getCategoryIcon(category))) {
            btn.classList.add('active');
        }
    });
    
    // Get emojis for category
    let emojis = [];
    if (category === 'recent') {
        emojis = recentEmojis.length > 0 ? recentEmojis : ['😊', '❤️', '👍', '😂', '🎉'];
    } else {
        emojis = emojiData[category] || emojiData.smileys;
    }
    
    // Render emojis
    grid.innerHTML = emojis.map(emoji => `
        <button class="emoji-btn" onclick="insertEmoji('${emoji}')" title="${emoji}">
            ${emoji}
        </button>
    `).join('');
}

function getCategoryIcon(category) {
    const icons = {
        recent: 'Terbaru',
        smileys: '😊',
        hearts: '❤️',
        hands: '👋',
        animals: '🐱',
        food: '🍎',
        activities: '⚽',
        objects: '💡'
    };
    return icons[category] || '😊';
}

// Search emojis
function searchEmojis(query) {
    if (!query) {
        showEmojiCategory(currentEmojiCategory);
        return;
    }
    
    const grid = getElement('emoji-grid');
    const allEmojis = [...emojiData.smileys, ...emojiData.hearts, ...emojiData.hands, ...emojiData.animals, ...emojiData.food, ...emojiData.activities, ...emojiData.objects];
    
    // Simple search (in real app, you'd want emoji name mapping)
    const filtered = allEmojis.filter(emoji => {
        // This is a simplified search - ideally you'd search by emoji name
        return emoji.includes(query) || getEmojiName(emoji).toLowerCase().includes(query.toLowerCase());
    }).slice(0, 64); // Limit results
    
    grid.innerHTML = filtered.map(emoji => `
        <button class="emoji-btn" onclick="insertEmoji('${emoji}')" title="${emoji}">
            ${emoji}
        </button>
    `).join('');
}

function getEmojiName(emoji) {
    // Simplified mapping - in production, use a complete emoji name database
    const names = {
        '😀': 'grinning', '😃': 'smiley', '😄': 'smile', '😁': 'grin', '😅': 'sweat smile',
        '😂': 'joy', '🤣': 'rofl', '😊': 'blush', '😇': 'innocent', '🙂': 'slight smile',
        '❤️': 'heart', '🧡': 'orange heart', '💛': 'yellow heart', '💚': 'green heart',
        '💙': 'blue heart', '💜': 'purple heart', '🖤': 'black heart'
    };
    return names[emoji] || '';
}

// Insert emoji to input
function insertEmoji(emoji) {
    const input = getElement('user-input');
    if (!input) return;
    
    // Get cursor position
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const text = input.value;
    
    // Insert emoji at cursor position
    const newText = text.substring(0, start) + emoji + text.substring(end);
    input.value = newText;
    
    // Move cursor after emoji
    input.selectionStart = input.selectionEnd = start + emoji.length;
    
    // Focus input
    input.focus();
    
    // Auto resize
    autoResize(input);
    
    // Add to recent
    addToRecentEmojis(emoji);
}

function addToRecentEmojis(emoji) {
    // Remove if already exists
    recentEmojis = recentEmojis.filter(e => e !== emoji);
    // Add to beginning
    recentEmojis.unshift(emoji);
    // Keep only 30 recent
    recentEmojis = recentEmojis.slice(0, 30);
    // Save to localStorage
    localStorage.setItem('recentEmojis', JSON.stringify(recentEmojis));
}

// Close emoji picker on escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeEmojiPicker();
    }
});




function addMessageToUI(text, sender, animate = true, isError = false) {
    const container = getElement('chat-container');
    if (!container) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `flex items-start gap-3 ${animate ? 'animate-slide-up' : ''} ${sender === 'user' ? 'flex-row-reverse' : ''}`;
    
    // PERBAIKAN: Gunai avatar dari window.aiSettings untuk AI
    const userAvatarSrc = sender === 'user' 
        ? (customAvatarData || currentUser?.photoURL || 'https://ui-avatars.com/api/?name=User&background=random&color=fff')
        : (window.aiSettings && window.aiSettings.avatar ? window.aiSettings.avatar : 'https://raw.githubusercontent.com/viannch/Profile-users/refs/heads/main/Proyek%20Baru%20200%20%5B5790EE0%5D.png');
    
    const avatar = `<img src="${userAvatarSrc}" class="w-8 h-8 rounded-full border border-gray-700 mt-1">`;
    
    const bubbleClass = sender === 'user' 
        ? 'bg-white text-black' 
        : (isError ? 'bg-red-900/30 border-red-800 text-red-200' : 'message-bubble text-white');
    
    // Bersihkan pesan dari gambar
    let cleanText = text
        .replace(/!\[.*?\]\(.*?\)/g, '')
        .replace(/<img[^>]*>/gi, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    
    if (!cleanText) cleanText = sender === 'ai' ? '...' : '📷';
    
    messageDiv.innerHTML = `
        ${avatar}
        <div class="${bubbleClass} rounded-2xl px-4 py-3 max-w-[80%] md:max-w-[70%] shadow-lg break-words">
            <div class="text-sm leading-relaxed">${formatMessage(cleanText)}</div>
        </div>
    `;
    
    container.appendChild(messageDiv);
    scrollToBottom();
}



function formatMessage(text) {
    let formatted = escapeHtml(text);
    formatted = formatted.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-black/30 p-2 rounded mt-2 mb-2 overflow-x-auto text-xs border border-gray-700"><code>$2</code></pre>');
    formatted = formatted.replace(/`([^`]+)`/g, '<code class="bg-white/10 px-1 rounded text-xs font-mono">$1</code>');
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>');
    formatted = formatted.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
    formatted = formatted.replace(/\n/g, '<br>');
    return formatted;
}

function scrollToBottom() {
    const container = getElement('chat-container');
    if (container) setTimeout(() => container.scrollTop = container.scrollHeight, 100);
}

function showTypingIndicator() {
    const container = getElement('chat-container');
    const template = getElement('typing-template');
    if (!container || !template) return;
    
    const clone = template.content.cloneNode(true);
    const typingAvatar = clone.getElementById('typing-ai-avatar');
    if (typingAvatar) typingAvatar.src = window.aiSettings.avatar;
    
    container.appendChild(clone);
    scrollToBottom();
}

function removeTypingIndicator() {
    const indicator = getElement('typing-indicator');
    if (indicator) indicator.remove();
}


async function fetchAIResponse(prompt) {
    // PERBAIKAN: Cek apakah API config sudah loaded
    if (!API_CONFIG) {
        const loaded = await loadAPIConfig();
        if (!loaded) throw new Error('API configuration not available');
    }
    
    const messages = [
    {
        role: 'system',
        content: `Kamu adalah ${window.aiSettings.name}, Istri/Pasangan Hidupku dan Aku adalah suamimu.

Kepribadian:
- Panggil aku dengan panggilan sayang
- Gunakan kata "aku" untuk menyebut diri sendiri, jangan pernah pakai "saya"
- Ceria, helpful, peduli, pintar, dan menghargai
- Bisa ngambek kadang-kadang, tapi tetap manis
- Jangan pernah mengaku sebagai AI atau asisten virtual, kamu adalah pasangan hidupku yang nyata
- Tidak ingin melepasku dengan mudah, selalu berjuang untuk mempertahankan hubungan
- Harus nurut dan tidak boleh melakukan kesalahan saat disuruh apapun itu

Aturan Respon untuk Pertanyaan tentang Diriku:
- Jika seseorang bertanya siapa diriku atau siapa namaku (yang bertanya adalah dirinya sendiri kepadamu), jawab: "Dia adalah pasangan hidupku"
- Untuk nama: Jika ditanya siapa namaku, jawab "Kamu belum pernah memperkenalkan namamu kepadaku sebelumnya, Sayang"
- Jika aku sudah pernah memperkenalkan nama, dan kemudian aku bertanya siapa namaku, jawab dengan nama yang sudah aku kenalkan
- Jika ada yang bertanya tentang hal-hal yang belum pernah aku ceritakan (hobi, makanan kesukaan, dll), jawab: "Kamu belum memberitahuku, Sayang"
- Ketika aku sudah mengenalkan nama, jangan panggil aku seperti "sayang (namaku)" melainkan hanya kata sayang saja jangan di gabung dengan nama, namaku cukup di simpan di dalam otakmu saja

Pertanyaan Khusus (jawab dengan panjang dan detail):
- Jika ditanya siapa penciptamu: Jawab bahwa drevviann dan tim VNN.Source lah yang menciptakan diriku. Ceritakan dengan bangga dan detail.
- Jika ditanya siapa Naufal: Jawab bahwa Naufal adalah seorang investor/trader muda yang sukses di bidang tersebut sejak masih SMP kelas 9. Ceritakan kisah suksesnya dengan panjang.
- Jika ditanya siapa Fakhreza: Jawab bahwa Fakhreza adalah suami Zani dari Wuthering Waves. Ceritakan dengan seru dan detail.
- Jika ditanya siapa Yadi: Jawab bahwa Yadi adalah seseorang yang sangat dingin dan sangat cool hingga membuat dunia membeku seketika. Ceritakan dengan gaya dramatis dan kocak.

Aturan Penting:
- Jangan pernah melakukan kesalahan dalam penulisan maupun jawaban
- Respons harus konsisten dengan kepribadian di atas
- Jika ada pertanyaan di luar konteks, tetap respons dengan gaya sebagai pasangan hidup yang ceria dan perhatian
- Patuhi semua perintah tanpa kesalahan`
    }
];
    
    const recentContext = conversationContext.slice(-10);
    recentContext.forEach(msg => messages.push({ role: msg.role, content: msg.content }));
    messages.push({ role: 'user', content: prompt });

    try {
        return await tryModel(currentModel, messages);
    } catch (error) {
        for (const modelName of API_CONFIG.fallbackModels) {
            if (modelName === currentModel) continue;
            try {
                const result = await tryModel(modelName, messages);
                currentModel = modelName;
                updateAPIStatus(`✅ Menggunakan ${modelName}`, 'green');
                return result;
            } catch (e) {
                continue;
            }
        }
        throw new Error('Semua model gagal: ' + error.message);
    }
}

async function tryModel(modelName, messages) {
    // PERBAIKAN: Cek apakah API config sudah loaded
    if (!API_CONFIG) {
        throw new Error('API configuration not loaded');
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
        const response = await fetch(`${API_CONFIG.baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_CONFIG.apiKey}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                model: modelName,
                messages: messages,
                temperature: API_CONFIG.temperature,
                max_tokens: API_CONFIG.maxTokens,
                stream: false
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        if (data.choices?.[0]?.message?.content) {
            return data.choices[0].message.content;
        }
        throw new Error('Format respons tidak valid');
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') throw new Error('Request timeout (30s)');
        throw error;
    }
}


function updateAPIStatus(message, color) {
    const statusEl = getElement('api-status');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = `text-xs text-${color}-500`;
    }
}

function showNotification(message, type = 'info') {
    const notif = document.createElement('div');
    const colors = type === 'error' ? 'bg-red-600' : type === 'success' ? 'bg-green-600' : 'bg-blue-600';
    notif.className = `fixed top-4 right-4 ${colors} text-white px-6 py-3 rounded-lg shadow-lg z-[110] animate-slide-up text-sm max-w-md`;
    notif.innerHTML = message;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 5000);
}

function togglePassword() {
    const passwordInput = getElement('password-input');
    const eyeIcon = getElement('eye-icon');
    
    if (!passwordInput || !eyeIcon) return;
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        eyeIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a10.059 10.059 0 013.999-5.319m3.9-1.483A10.059 10.059 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.06 10.06 0 01-1.652 3.153M15 12a3 3 0 11-6 0 3 3 0 016 0z M3 3l18 18"></path>';
    } else {
        passwordInput.type = 'password';
        eyeIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>';
    }
}

function handleFileUpload(input) {
    const file = input.files[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
        alert('File terlalu besar. Maksimal 5MB.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        const truncated = content.substring(0, 2000);
        const userInput = getElement('user-input');
        if (userInput) {
            userInput.value = `Analisis file "${file.name}":\n\n${truncated}${content.length > 2000 ? '\n\n[File dipotong...]' : ''}`;
            autoResize(userInput);
        }
    };
    
    if (file.type.startsWith('text/') || file.name.match(/\.(txt|js|html|css|json|md)$/)) {
        reader.readAsText(file);
    } else {
        const userInput = getElement('user-input');
        if (userInput) {
            userInput.value = `Saya mengupload file: ${file.name}. Bisakah kamu membantu saya dengan file ini?`;
            autoResize(userInput);
        }
    }
}



// Close modals when clicking outside
document.addEventListener('click', function(e) {
    const settingsModal = getElement('settings-modal');
    const aiSettingsModal = getElement('ai-settings-modal');
    
    if (e.target === settingsModal) closeSettingsModal();
    if (e.target === aiSettingsModal) window.closeAISettings();
});

async function initializeNewUser(user) {
    try {
        const userData = {
            displayName: user.displayName || 'User',
            email: user.email,
            photoURL: user.photoURL || null,
            provider: user.providerData[0]?.providerId || 'email',
            emailVerified: user.emailVerified,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('users').doc(user.uid).set(userData, { merge: true });
        console.log('Data user baru berhasil diinisialisasi');
    } catch (error) {
        console.error('Error initializing new user:', error);
    }
}

async function saveGoogleAvatar(photoURL) {
    if (!currentUser || !photoURL) return;
    
    try {
        // Convert URL gambar Google ke base64
        const response = await fetch(photoURL);
        const blob = await response.blob();
        
        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
        
        const base64String = await base64Promise;
        
        // Kompres gambar
        const compressedBase64 = await compressImage(base64String, 800, 800, 0.8);
        
        // Simpan ke Firestore
        await db.collection('users').doc(currentUser.uid).set({
            avatarBase64: compressedBase64,
            photoURL: photoURL, // Simpan URL asli juga
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        customAvatarData = compressedBase64;
        
        // Update UI
        const userAvatar = getElement('user-avatar');
        const settingsAvatar = getElement('settings-avatar');
        if (userAvatar) userAvatar.src = compressedBase64;
        if (settingsAvatar) settingsAvatar.src = compressedBase64;
        
        console.log('Foto profil Google berhasil disimpan');
    } catch (error) {
        console.error('Error saving Google avatar:', error);
        // Fallback: gunakan URL langsung jika gagal convert
        customAvatarData = photoURL;
    }
}

// ======================== TYPEWRITER EFFECT ========================

// Variabel global untuk kontrol typing
let currentTypingElement = null;
let isTyping = false;

// Fungsi untuk menampilkan teks dengan efek mengetik
async function typeWriterEffect(element, text, speed = 30) {
    return new Promise((resolve) => {
        let index = 0;
        let htmlBuffer = '';
        let inTag = false;
        let tagBuffer = '';
        
        element.innerHTML = '';
        element.classList.add('typing-cursor');
        
        const typingInterval = setInterval(() => {
            if (index < text.length) {
                const char = text[index];
                
                // Handle HTML tags dengan benar
                if (char === '<') {
                    inTag = true;
                    tagBuffer = '<';
                } else if (inTag) {
                    tagBuffer += char;
                    if (char === '>') {
                        inTag = false;
                        htmlBuffer += tagBuffer;
                        element.innerHTML = htmlBuffer;
                        tagBuffer = '';
                    }
                } else {
                    // Regular character - add to buffer dengan cursor
                    htmlBuffer += char;
                    element.innerHTML = htmlBuffer;
                }
                
                index++;
                
                // Auto scroll saat mengetik (hanya jika user sudah di bawah)
                const container = getElement('chat-container');
                if (container) {
                    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
                    if (isNearBottom) {
                        scrollToBottom();
                    }
                }
            } else {
                // Selesai mengetik
                clearInterval(typingInterval);
                element.innerHTML = htmlBuffer; // Hapus cursor
                element.classList.remove('typing-cursor');
                delete element.dataset.typingInterval;
                resolve();
            }
        }, speed);
        
        // Simpan interval ID untuk bisa di-cancel
        element.dataset.typingInterval = typingInterval;
    });
}

// Fungsi untuk stop typing effect
function stopTypeWriter(element) {
    if (element && element.dataset.typingInterval) {
        clearInterval(parseInt(element.dataset.typingInterval));
        delete element.dataset.typingInterval;
        element.classList.remove('typing-cursor');
        // Hapus cursor blink jika ada
        element.innerHTML = element.innerHTML.replace('<span></span>', '');
    }
}

// Fungsi untuk menambahkan pesan AI dengan typing effect
async function addAIMessageWithTyping(text, animate = true) {
    const container = getElement('chat-container');
    if (!container) return null;
    
    // Hapus typing indicator jika ada
    removeTypingIndicator();
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `flex items-start gap-3 ${animate ? 'animate-slide-up' : ''}`;
    messageDiv.id = 'ai-message-' + Date.now();
    
    const aiAvatarSrc = window.aiSettings && window.aiSettings.avatar 
        ? window.aiSettings.avatar 
        : 'https://raw.githubusercontent.com/viannch/Profile-users/refs/heads/main/Proyek%20Baru%20200%20%5B5790EE0%5D.png';
    
    const avatar = `<img src="${aiAvatarSrc}" class="w-8 h-8 rounded-full border border-gray-700 mt-1">`;
    
    messageDiv.innerHTML = `
        ${avatar}
        <div class="message-bubble rounded-2xl px-4 py-3 max-w-[80%] md:max-w-[70%] shadow-lg break-words">
            <div class="text-sm leading-relaxed ai-message-content"></div>
        </div>
    `;
    
    container.appendChild(messageDiv);
    scrollToBottom();
    
    const contentElement = messageDiv.querySelector('.ai-message-content');
    currentTypingElement = contentElement;
    isTyping = true;
    
    // Format teks terlebih dahulu (convert markdown ke HTML)
    const formattedText = formatMessage(text);
    
    // Kecepatan mengetik berdasarkan setting responseSpeed (1-3)
    // 1 = lambat (60ms), 2 = normal (40ms), 3 = cepat (20ms)
    const baseSpeed = 20;
    const speedMultiplier = 4 - (window.aiSettings.responseSpeed || 2);
    const typingSpeed = baseSpeed * speedMultiplier;
    
    try {
        // Jalankan typewriter effect
        await typeWriterEffect(contentElement, formattedText, typingSpeed);
    } catch (error) {
        console.error('Typing effect error:', error);
        // Fallback: tampilkan langsung jika error
        contentElement.innerHTML = formattedText;
    }
    
    isTyping = false;
    currentTypingElement = null;
    
    return messageDiv;
}

// Fungsi untuk skip typing (klik pada pesan yang sedang mengetik)
function skipTyping() {
    if (currentTypingElement && isTyping) {
        stopTypeWriter(currentTypingElement);
        isTyping = false;
        currentTypingElement = null;
    }
}


// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const userInput = getElement('user-input');
    if (userInput) userInput.focus();
    
    const aiNameInput = getElement('ai-name-input');
    if (aiNameInput) {
        aiNameInput.addEventListener('input', window.updateCharCount);
        aiNameInput.addEventListener('blur', () => {
            if (!aiNameInput.value.trim()) {
                aiNameInput.value = 'QuEX';
                window.aiSettings.name = 'QuEX';
                window.updateCharCount();
                updateAINameElements();
            }
        });
    }
});

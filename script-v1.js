import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

console.log("🚀 AeroByte Script Loaded v5.5");

const firebaseConfig = {
  apiKey: "AIzaSyCl-SEIc2IWYFvz5mdUJsE8WNsrHoI1tsc",
  authDomain: "aerobytebot.firebaseapp.com",
  projectId: "aerobytebot",
  storageBucket: "aerobytebot.firebasestorage.app",
  messagingSenderId: "1007925810373",
  appId: "1:1007925810373:web:faaf0321a65acff659ccac",
  measurementId: "G-7G2NFT0JQ8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const STRIPE_PK = 'pk_test_51TFKE1IlExQEZUkSBzHPPiTVBWXwQRvpmW3HlVK7wT35MrB0FDyu2dEzLKvNIre6E70huYkcX5mdgRZtmen2D20700hv4OukTE';
const BACKEND_URL = 'https://aerobyte-website.onrender.com';

// --- PRODUCT DATA & DYNAMIC UI ---
let globalProducts = [];

// Listen for product changes site-wide
onSnapshot(collection(db, "system_status"), (snapshot) => {
    globalProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`📦 Loaded ${globalProducts.length} products`);
    
    // Update UI elements that depend on products
    // populateNavigation(); // Disabled to prefer hardcoded paths
    
    if (window.location.pathname.includes('product.html')) {
        renderProductPage();
    }
    
    if (window.location.pathname.includes('admin.html')) {
        refreshProductStatus();
        refreshLicenses();
    }
    
    // if (window.location.pathname.includes('index.html') || window.location.pathname.endsWith('/')) {
    //     renderHomeProducts();
    // }

    // if (window.location.pathname.includes('solutions.html')) {
    //     renderSolutionsProducts();
    // }
});

// --- ADMIN REFRESH FUNCTIONS (Global Scope for Listener) ---
const refreshProductStatus = async () => {
    const container = document.getElementById('adminProductStatusBody');
    if (!container) return;
    
    if (globalProducts.length === 0) {
        container.innerHTML = '<div style="padding:40px; text-align:center;"><p style="color:var(--text-muted);">No products found. Add one to get started!</p></div>';
        return;
    }

    try {
        let html = '';
        for (const p of globalProducts) {
            html += `
                <div class="saas-card" style="padding: 25px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <div class="saas-avatar" style="background: var(--gradient-saas);"><i class="${p.icon || 'fas fa-cube'}"></i></div>
                            <div>
                                <h3 style="margin: 0; color: #fff; font-size: 1rem;">${p.name || 'Untitled Product'}</h3>
                                <p style="font-size: 0.7rem; color: var(--text-muted); margin-top: 4px;">ID: ${p.id} | Type: ${p.type || 'N/A'}</p>
                            </div>
                        </div>
                        <div class="saas-status-dot" style="background: ${p.status === 'down' ? '#EF4444' : '#10B981'}; box-shadow: 0 0 10px ${p.status === 'down' ? '#EF444466' : '#10B98166'};"></div>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; font-size: 0.85rem; color: var(--text-muted);">
                        <p>Version: <span style="color: #fff;">${p.version || 'v1.0'}</span></p>
                        <p>Status: <span style="color: ${p.status === 'down' ? '#EF4444' : '#10B981'};">${p.status === 'active' ? 'Active' : 'Maintenance'}</span></p>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 15px; border-top: 1px solid var(--border-color);">
                        <button class="saas-manage-btn edit-product-btn" data-pid="${p.id}" style="font-size: 0.75rem; background: rgba(255,255,255,0.05);"><i class="fas fa-edit"></i> Edit Details</button>
                        <button class="saas-manage-btn toggle-product-status-btn" 
                                data-pid="${p.id}" 
                                data-status="${p.status}"
                                style="background: ${p.status === 'down' ? '#10B98122' : '#EF444422'}; color: ${p.status === 'down' ? '#10B981' : '#EF4444'}; border: 1px solid ${p.status === 'down' ? '#10B98144' : '#EF444444'}; font-size: 0.75rem;">
                            ${p.status === 'down' ? 'Restore Service' : 'Mark Maintenance'}
                        </button>
                    </div>
                </div>`;
        }
        container.innerHTML = html;

        // Attach Edit listeners
        container.querySelectorAll('.edit-product-btn').forEach(btn => {
            btn.onclick = () => {
                const pid = btn.getAttribute('data-pid');
                const p = globalProducts.find(x => x.id === pid);
                if (p) openProductModal(p);
            };
        });

        // Attach Toggle listeners
        container.querySelectorAll('.toggle-product-status-btn').forEach(btn => {
            btn.onclick = async () => {
                const pid = btn.getAttribute('data-pid');
                const currentStatus = btn.getAttribute('data-status');
                const newStatus = currentStatus === 'active' ? 'down' : 'active';
                
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                try {
                    await updateDoc(doc(db, "system_status", pid), { status: newStatus, lastUpdated: Date.now() });
                } catch (e) { alert(e.message); btn.disabled = false; }
            };
        });
    } catch (err) {
        console.error("Product Status Refresh Error:", err);
    }
};

const refreshLicenses = async () => {
    const container = document.getElementById('adminLicenseInventoryBody');
    if (!container) return;
    console.log("🔄 License Inventory Syncing...");

    const productSelect = document.getElementById('directProduct');
    if (productSelect) {
        productSelect.innerHTML = globalProducts.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    }

    try {
        const [userSnap, licSnap] = await Promise.all([
            getDocs(collection(db, "users")),
            getDocs(collection(db, "licenses"))
        ]);

        const usersList = [];
        userSnap.forEach(docSnap => {
            usersList.push({ id: docSnap.id, ...docSnap.data() });
        });

        container.innerHTML = '';
        usersList.sort((a,b) => (a.discordUsername || a.email || "").localeCompare(b.discordUsername || b.email || ""));

        for (const user of usersList) {
            let licensesHtml = '';

            for (const p of globalProducts) {
                let pKey = null;
                if (user.licenseKeys && user.licenseKeys[p.id]) {
                    pKey = user.licenseKeys[p.id];
                } else if (p.id === "rl-bot-trainer" && user.licenseKey) {
                    pKey = user.licenseKey;
                }

                if (pKey) {
                    licensesHtml += `
                        <div class="saas-mini-card">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="font-size:0.6rem; text-transform:uppercase; font-weight:800; color:var(--text-muted);"><i class="${p.icon || 'fas fa-cube'}"></i> ${p.name}</span>
                                <span style="font-size:0.6rem; color:#10B981; font-weight:bold;">Active</span>
                            </div>
                            <code class="admin-license-mask" data-key="${pKey}" style="font-family:monospace; font-size:0.75rem; color:var(--primary); margin: 5px 0; cursor:pointer;">••••-••••-••••-••••</code>
                            <div style="display:flex; gap:8px;">
                                <button class="saas-manage-btn action-reset-hwid" data-uid="${user.id}" data-key="${pKey}" data-product="${p.id}">HWID</button>
                                <button class="saas-manage-btn action-regen-key" data-uid="${user.id}" data-key="${pKey}" data-plan="${user.plan || 'Trial'}" data-product="${p.id}">Regen</button>
                                ${pKey && pKey !== 'None' ? `<button class="saas-ban-btn action-ban-hwid" data-uid="${user.id}" data-key="${pKey}" data-product="${p.id}"><i class="fas fa-hammer"></i> BAN</button>` : ''}
                            </div>
                        </div>`;
                } else {
                    licensesHtml += `
                        <div class="saas-mini-card" style="border-style: dashed; opacity: 0.8; display: flex; align-items: center; justify-content: center; min-height: 80px;">
                            <button class="saas-manage-btn action-gen-key" data-uid="${user.id}" data-product="${p.id}" data-product-name="${p.name}" data-plan="${user.plan || 'Trial'}" style="width:100%; height:100%; background:transparent; border:none; color:var(--primary); font-size:0.65rem; font-weight:bold; cursor:pointer; flex-direction:column; gap:5px;">
                                <i class="fas fa-plus-circle" style="font-size: 1rem;"></i>
                                <span>ADD ${p.name.toUpperCase()}</span>
                            </button>
                        </div>`;
                }
            }

            const row = document.createElement('div');
            row.className = 'saas-user-row';
            row.style.gridTemplateColumns = '300px 1fr'; 
            
            row.innerHTML = `
                <div class="saas-user-info" style="min-width: 0;">
                    <div class="saas-avatar">${(user.discordUsername || user.email || "A").charAt(0).toUpperCase()}</div>
                    <div style="min-width: 0; overflow: hidden;">
                        <p style="font-weight: 700; color: #fff; margin:0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${user.discordUsername || 'Unlinked User'}</p>
                        <p style="font-size: 0.7rem; color: var(--text-muted); margin:0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${user.email}</p>
                    </div>
                </div>
                <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:15px;">
                    ${licensesHtml}
                </div>
            `;
            container.appendChild(row);
        }
    } catch (err) { console.error("License Error:", err); }
};

// --- PRODUCT MANAGEMENT HELPERS (Global Scope) ---
const openProductModal = (product = null) => {
    const modal = document.getElementById('productModal');
    const form = document.getElementById('productForm');
    const title = document.getElementById('productModalTitle');
    
    if (!modal || !form) return;
    
    form.reset();
    if (product) {
        title.innerHTML = `Edit <span class="gradient-text">${product.name}</span>`;
        document.getElementById('prodID').value = product.id;
        document.getElementById('prodID').readOnly = true;
        document.getElementById('prodName').value = product.name;
        document.getElementById('prodDesc').value = product.description || '';
        document.getElementById('prodIcon').value = product.icon || 'fas fa-cube';
        document.getElementById('prodType').value = product.type || 'product';
        document.getElementById('prodVersion').value = product.version || 'v1.0';
        document.getElementById('prodStatus').value = product.status || 'active';
        document.getElementById('dlWindows').value = product.downloadLinks?.windows || '';
        document.getElementById('dlAndroid').value = product.downloadLinks?.android || '';
        document.getElementById('dlIOS').value = product.downloadLinks?.ios || '';
    } else {
        title.innerHTML = `Add New <span class="gradient-text">Product</span>`;
        document.getElementById('prodID').readOnly = false;
    }
    
    modal.classList.add('active');
    
    // Toggle delete button
    const deleteBtn = document.getElementById('deleteProdBtn');
    if (deleteBtn) {
        deleteBtn.style.display = product ? 'flex' : 'none';
        deleteBtn.onclick = async () => {
            if (confirm(`Are you sure you want to delete ${product.name}? This action cannot be undone.`)) {
                deleteBtn.disabled = true;
                deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
                try {
                    await deleteDoc(doc(db, "system_status", product.id));
                    modal.classList.remove('active');
                    console.log(`🗑️ Product ${product.id} deleted`);
                } catch (err) {
                    alert("Delete failed: " + err.message);
                    deleteBtn.disabled = false;
                    deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete Product';
                }
            }
        };
    }
};

// Global Submit Handler
const setupProductForm = () => {
    const productForm = document.getElementById('productForm');
    if (productForm) {
        productForm.onsubmit = async (e) => {
            e.preventDefault();
            const saveBtn = productForm.querySelector('button[type="submit"]');
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            
            const prodID = document.getElementById('prodID').value;
            const productData = {
                name: document.getElementById('prodName').value,
                description: document.getElementById('prodDesc').value,
                icon: document.getElementById('prodIcon').value,
                type: document.getElementById('prodType').value,
                version: document.getElementById('prodVersion').value,
                status: document.getElementById('prodStatus').value,
                downloadLinks: {
                    windows: document.getElementById('dlWindows').value || null,
                    android: document.getElementById('dlAndroid').value || null,
                    ios: document.getElementById('dlIOS').value || null
                },
                lastUpdated: Date.now(),
                updatedBy: auth.currentUser?.email || 'Admin'
            };
            
            try {
                await setDoc(doc(db, "system_status", prodID), productData, { merge: true });
                document.getElementById('productModal').classList.remove('active');
            } catch (err) {
                alert("Failed to save product: " + err.message);
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = 'Save Product';
            }
        };
    }

    const addProdBtn = document.getElementById('addProductBtn');
    if (addProdBtn) {
        addProdBtn.onclick = () => openProductModal();
    }

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.onclick = () => document.getElementById('productModal').classList.remove('active');
    });
};

const populateNavigation = () => {
    const productsDropdown = document.getElementById('nav-products-dropdown');
    const solutionsDropdown = document.getElementById('nav-solutions-dropdown');
    
    // Helper to get filename from ID
    const getPageFile = (pid) => {
        if (pid === 'rl-bot-trainer') return 'rl-bot-trainer.html';
        if (pid === 'among-us-mod-menu') return 'among-us-mod-menu.html';
        if (pid === 'cinema') return 'cinema.html';
        return `product.html?id=${pid}`; // Fallback for new products
    };

    if (productsDropdown) {
        const productItems = globalProducts.filter(p => p.type === 'product');
        productsDropdown.innerHTML = productItems.map(p => `
            <li><a href="${getPageFile(p.id)}">${p.name}</a></li>
        `).join('') + `
            <li class="dropdown-divider"></li>
            <li><a href="solutions.html#products">View All</a></li>
        `;
    }
    
    if (solutionsDropdown) {
        const solutionItems = globalProducts.filter(p => p.type === 'solution');
        solutionsDropdown.innerHTML = solutionItems.map(p => `
            <li><a href="${getPageFile(p.id)}">${p.name}</a></li>
        `).join('') + `
            <li class="dropdown-divider"></li>
            <li><a href="solutions.html#solutions">View All</a></li>
        `;
    }
};

const renderProductPage = () => {
    const params = new URLSearchParams(window.location.search);
    const prodID = params.get('id');
    const loadingContent = document.getElementById('product-page-content');
    const errorState = document.getElementById('product-error');
    
    if (!prodID) {
        if (loadingContent) loadingContent.classList.add('hidden');
        if (errorState) errorState.classList.remove('hidden');
        return;
    }
    
    const product = globalProducts.find(p => p.id === prodID);
    if (!product) {
        // If products are loaded but this one isn't there, show error
        if (globalProducts.length > 0) {
            if (loadingContent) loadingContent.classList.add('hidden');
            if (errorState) errorState.classList.remove('hidden');
        }
        return;
    }
    
    // Clear error
    if (errorState) errorState.classList.add('hidden');
    if (loadingContent) loadingContent.classList.remove('hidden');
    
    // Update Meta & Title
    document.title = `AeroByte | ${product.name}`;
    const meta = document.getElementById('meta-description');
    if (meta) meta.setAttribute('content', product.description);
    
    // Update Text Content
    const updateEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    updateEl('product-name', product.name);
    updateEl('product-short-name', product.name);
    updateEl('product-description', product.description || '');
    updateEl('product-version', product.version || 'v1.0');
    updateEl('product-status', product.status === 'active' ? 'PROFESSIONAL' : 'MAINTENANCE');
    
    const badge = document.getElementById('product-badge');
    if (badge) {
        badge.className = `badge ${product.status === 'down' ? 'badge-down' : ''}`;
        const dot = badge.querySelector('.status-dot');
        if (dot) dot.style.background = product.status === 'active' ? 'var(--primary)' : 'var(--danger)';
    }

    // Update Icon
    const iconEl = document.getElementById('product-main-icon');
    if (iconEl) iconEl.className = `${product.icon || 'fas fa-cube'}`;

    // Render Features
    const featuresGrid = document.getElementById('product-features-grid');
    if (featuresGrid && product.features) {
        featuresGrid.innerHTML = product.features.map(f => `
            <div class="feature-card">
                <div class="feature-icon">${f.icon.includes('fa-') ? `<i class="${f.icon}"></i>` : f.icon}</div>
                <h3>${f.title}</h3>
                <p>${f.description}</p>
            </div>
        `).join('');
    }

    // Render Download Actions
    const downloadActions = document.getElementById('download-actions');
    if (downloadActions && product.downloadLinks) {
        let html = '';
        if (product.downloadLinks.windows) {
            html += `<a href="${product.downloadLinks.windows}" target="_blank" class="btn-primary glow-btn" style="padding: 15px 30px;"><i class="fab fa-windows"></i> Download for Windows</a>`;
        }
        if (product.downloadLinks.android) {
            html += `<a href="${product.downloadLinks.android}" target="_blank" class="btn-secondary" style="padding: 15px 30px;"><i class="fab fa-android"></i> Download for Android</a>`;
        }
        if (product.downloadLinks.ios) {
            html += `<a href="${product.downloadLinks.ios}" target="_blank" class="btn-secondary" style="padding: 15px 30px;"><i class="fab fa-apple"></i> Download for iOS</a>`;
        }
        downloadActions.innerHTML = html || '<p>No downloads available for this product yet.</p>';
    }

    // Render Pro Features in Pricing
    const proFeaturesList = document.getElementById('pro-features-list');
    if (proFeaturesList && product.features) {
        proFeaturesList.innerHTML = product.features.map(f => `
            <li><strong>${f.title}</strong></li>
        `).join('') + `<li>Premium 24/7 Support</li>`;
    }
};

const renderHomeProducts = () => {
    const productGrid = document.querySelector('.product-grid');
    if (!productGrid) return;
    
    const getPageFile = (pid) => {
        if (pid === 'rl-bot-trainer') return 'rl-bot-trainer.html';
        if (pid === 'among-us-mod-menu') return 'among-us-mod-menu.html';
        if (pid === 'cinema') return 'cinema.html';
        return `product.html?id=${pid}`;
    };

    productGrid.innerHTML = globalProducts.slice(0, 3).map(p => `
        <div class="product-card">
            <div>
                <span class="product-tag">${p.type === 'solution' ? 'Software Solution' : 'Gaming Enhancement'}</span>
                <h3>${p.name}</h3>
                <p style="color: var(--text-muted); margin-bottom: 20px;">${p.description}</p>
            </div>
            <a href="${getPageFile(p.id)}" class="btn-secondary" style="text-align: center;">Explore ${p.name.split(' ').pop()}</a>
        </div>
    `).join('');
};

const renderSolutionsProducts = () => {
    const prodGrid = document.getElementById('products-grid');
    const solGrid = document.getElementById('solutions-grid');
    
    const getPageFile = (pid) => {
        if (pid === 'rl-bot-trainer') return 'rl-bot-trainer.html';
        if (pid === 'among-us-mod-menu') return 'among-us-mod-menu.html';
        if (pid === 'cinema') return 'cinema.html';
        return `product.html?id=${pid}`;
    };

    if (prodGrid) {
        const items = globalProducts.filter(p => p.type === 'product');
        prodGrid.innerHTML = items.map(p => `
            <div class="solution-card">
                <div class="solution-icon"><i class="${p.icon || 'fas fa-cube'}"></i></div>
                <h3>${p.name}</h3>
                <p>${p.description}</p>
                <div class="solution-footer">
                    <span class="badge" style="margin:0;">${p.version || 'v1.0'}</span>
                    <a href="${getPageFile(p.id)}" class="btn-primary" style="padding: 8px 20px;">Explore</a>
                </div>
            </div>
        `).join('');
    }
    
    if (solGrid) {
        const items = globalProducts.filter(p => p.type === 'solution');
        solGrid.innerHTML = items.map(p => `
            <div class="solution-card">
                <div class="solution-icon"><i class="${p.icon || 'fas fa-film'}"></i></div>
                <h3>${p.name}</h3>
                <p>${p.description}</p>
                <div class="solution-footer">
                    <span class="solution-tag expert">FLAGSHIP</span>
                    <a href="product.html?id=${p.id}" class="solution-btn">Details</a>
                </div>
            </div>
        `).join('');
    }
};


// --- TOP LEVEL HELPERS (Prioritized) ---
const generateLicenseKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const rand = (len) => Array.from({length: len}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${rand(4)}-${rand(4)}-${rand(4)}-${rand(4)}`;
};

// --- GLOBAL MESSAGE UTILITIES ---
const parseMessageLinks = (text) => {
    if (!text) return "";
    // Basic HTML escaping for security
    const escapedText = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return escapedText.replace(urlRegex, (url) => {
        // Remove trailing punctuation from URLs often caught by regex
        const cleanUrl = url.replace(/[.,!?;:]$/, "");
        return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="message-link">${cleanUrl}</a>`;
    });
};

const updateGlobalUI = (data) => {
    // 1. Handle Maintenance Mode
    let maintOverlay = document.getElementById('global-maintenance-overlay');
    if (data.maintenance_mode) {
        if (!maintOverlay) {
            maintOverlay = document.createElement('div');
            maintOverlay.id = 'global-maintenance-overlay';
            maintOverlay.className = 'maintenance-overlay';
            document.body.appendChild(maintOverlay);
        }
        maintOverlay.innerHTML = `
            <div class="maintenance-card glass-panel">
                <div class="maintenance-icon"><i class="fas fa-tools"></i></div>
                <h2>System <span class="gradient-text">Maintenance</span></h2>
                <div class="maintenance-message">${parseMessageLinks(data.maintenance_message || "AeroByte is currently undergoing maintenance.")}</div>
                <p class="maintenance-footer">We'll be back shortly!</p>
            </div>
        `;
        document.body.style.overflow = 'hidden';
        maintOverlay.style.display = 'flex';
    } else if (maintOverlay) {
        maintOverlay.style.display = 'none';
        document.body.style.overflow = '';
    }

    // 2. Handle Global Broadcast
    let broadcastBanner = document.getElementById('global-broadcast-banner');
    if (data.broadcast_active && !data.maintenance_mode) {
        document.body.classList.add('has-broadcast');
        if (!broadcastBanner) {
            broadcastBanner = document.createElement('div');
            broadcastBanner.id = 'global-broadcast-banner';
            broadcastBanner.className = 'global-broadcast-banner';
            document.body.prepend(broadcastBanner);
        }
        broadcastBanner.innerHTML = `
            <div class="broadcast-content">
                <i class="fas fa-bullhorn broadcast-icon"></i>
                <span class="broadcast-text">${parseMessageLinks(data.broadcast_message)}</span>
            </div>
        `;
        broadcastBanner.style.display = 'block';
    } else {
        document.body.classList.remove('has-broadcast');
        if (broadcastBanner) broadcastBanner.style.display = 'none';
    }
};

// --- GLOBAL DISCORD OAUTH HANDLER (v4.0) ---
const handleDiscordHash = () => {
    const hash = window.location.hash;
    if (!hash.includes('access_token=')) return;
    
    const isLinkingAction = window.location.pathname.includes('profile.html') || localStorage.getItem('waitingForDiscord') === 'true';
    if (!isLinkingAction) return;

    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get('access_token');
    if (!accessToken) return;

    // Engaged! Block all redirects immediately
    window.DISCORD_SSO_LOCK = true; 
    sessionStorage.setItem('discordSSOInProgress', 'true');
    console.log("🔄 Starting Secure Discord Handshake...");

    const updateStatus = (msg, color = '#fff') => {
        const discordStatusMsg = document.getElementById('discordStatusMsg');
        const loginBanner = document.getElementById('loginStatusBanner');
        const loginText = document.getElementById('loginStatusText');
        
        console.log(`[SSO Status] ${msg}`); // Always log
        
        if (discordStatusMsg) { 
            discordStatusMsg.textContent = msg; 
            discordStatusMsg.style.display = 'block'; 
            discordStatusMsg.style.color = color; 
        }
        if (loginBanner) loginBanner.style.display = 'block';
        if (loginText) loginText.textContent = msg;
    };

    updateStatus('Verifying Discord Identity...');

    fetch('https://discord.com/api/users/@me', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    .then(res => res.json())
    .then(async discordUser => {
        if (!discordUser.id) throw new Error("Discord API error.");
        
        const currentUser = auth.currentUser;
        if (currentUser) {
            updateStatus(`Linking ${discordUser.username}...`);
            await updateDoc(doc(db, "users", currentUser.uid), {
                discordId: String(discordUser.id),
                discordUsername: discordUser.username,
                discordAvatar: discordUser.avatar || null
            });
            updateStatus(`Successfully Linked!`, '#10B981');
            sessionStorage.removeItem('discordSSOInProgress');
            window.DISCORD_SSO_LOCK = false;
            window.history.replaceState({}, document.title, window.location.pathname);
            setTimeout(() => window.location.reload(), 1000);
        } else {
            updateStatus(`Authenticating...`);
            const synthEmail = `discord_${discordUser.id}@aerobyte.shop`;
            const synthPass = `Aero!Discord!${discordUser.id}`;
            
            try {
                const creds = await signInWithEmailAndPassword(auth, synthEmail, synthPass);
                updateStatus(`Welcome back, ${discordUser.username}!`, '#10B981');
                
                // Refresh Discord info on login to ensure sync
                await updateDoc(doc(db, "users", creds.user.uid), {
                    discordUsername: discordUser.username,
                    discordAvatar: discordUser.avatar || null
                });

                sessionStorage.removeItem('discordSSOInProgress');
                window.DISCORD_SSO_LOCK = false;
                window.history.replaceState({}, document.title, window.location.pathname);
            } catch (loginErr) {
                const isNewUser = loginErr.code === 'auth/user-not-found' || 
                                 loginErr.code.includes('invalid-credential') || 
                                 loginErr.code.includes('invalid-login-credentials');

                if (isNewUser) {
                    updateStatus(`Creating account for ${discordUser.username}...`);
                    const newCreds = await createUserWithEmailAndPassword(auth, synthEmail, synthPass);
                    const newUser = newCreds.user;
                    const newKey = generateLicenseKey();
                    
                    await setDoc(doc(db, "users", newUser.uid), {
                        email: synthEmail, plan: "Free", licenseKey: newKey,
                        discordId: String(discordUser.id), discordUsername: discordUser.username,
                        discordAvatar: discordUser.avatar || null, createdAt: Date.now()
                    });
                    
                    await setDoc(doc(db, "licenses", newKey), {
                        userId: newUser.uid, plan: "Free", status: "active", hwid: null, createdAt: Date.now()
                    });
                    
                    updateStatus(`Success! Syncing Profile...`, '#10B981');
                    sessionStorage.removeItem('discordSSOInProgress');
                    window.DISCORD_SSO_LOCK = false;
                    window.history.replaceState({}, document.title, window.location.pathname);
                } else { throw loginErr; }
            }
        }
    }).catch(err => {
        console.error("❌ OAuth Error:", err);
        updateStatus("Failed: " + err.message, "#ff4d4d");
        sessionStorage.removeItem('discordSSOInProgress');
        window.DISCORD_SSO_LOCK = false;
        window.history.replaceState({}, document.title, window.location.pathname);
        if (window.location.pathname.includes('profile.html')) setTimeout(() => { window.location.href = 'index.html'; }, 3000);
    });
};

// Start Handshake IMMEDIATELY with Safety Box
try {
    handleDiscordHash();
} catch (e) {
    console.error("🚨 Critical SSO Execution Failure:", e);
    // Force release lock if we crashed internally
    window.DISCORD_SSO_LOCK = false;
    sessionStorage.removeItem('discordSSOInProgress');
}

const initAeroByte = () => {
    console.log("🛠️ Initializing AeroByte Core...");

    // --- REAL-TIME GLOBAL CONFIG LISTENER ---
    onSnapshot(doc(db, "config", "global"), (snapshot) => {
        if (snapshot.exists()) {
            console.log("📡 Global Config Update Received");
            updateGlobalUI(snapshot.data());
        }
    });

    // Update Admin Platform Version Footer (v5.5)
    const versionFooter = document.getElementById('admin-platform-version');
    if (versionFooter) {
        versionFooter.textContent = 'v5.5 Stable Release';
    }
    let stripe = null;
    const ADMIN_EMAILS = [
        'aerobytebot@gmail.com', 
        'adamfrawi@gmail.com',
        'discord_1220002225385111683@aerobyte.shop'
    ].map(e => e.toLowerCase().trim());

    // PRE-WARM BACKEND (Wake up Render free instance immediately)
    fetch(BACKEND_URL).catch(() => {});

    try {
        if (typeof Stripe !== 'undefined') {
            stripe = Stripe(STRIPE_PK);
        } else {
            console.warn("⚠️ Stripe SDK not found at startup.");
        }
    } catch (e) {
        console.error("❌ Stripe Initialization Error:", e);
    }
    let elements;

    // --- DYNAMIC MODAL INJECTION ---
    const injectModals = () => {
        if (!document.getElementById('authModal')) {
            const authHTML = `
                <div id="authModal" class="modal-overlay">
                    <div class="modal-container">
                        <button class="close-modal close-auth-modal">&times;</button>
                        <div class="modal-header">
                            <h2>Welcome to <span class="gradient-text">AeroByte</span></h2>
                            <p id="authSubtitle">Sign in to your account.</p>
                        </div>
                        <div class="auth-tabs">
                            <button class="auth-tab active" id="tabLogin">Log In</button>
                            <button class="auth-tab" id="tabSignup">Sign Up</button>
                        </div>
                        <form class="auth-form" id="authForm">
                            <div class="form-group">
                                <label>Email Address</label>
                                <input type="email" id="authEmail" placeholder="you@example.com" required>
                            </div>
                            <div class="form-group">
                                <label>Password</label>
                                <input type="password" id="authPassword" placeholder="••••••••" required>
                            </div>
                            <button type="submit" class="btn-primary full-width glow-btn pay-btn" id="authSubmitBtn">Log In</button>
                        </form>
                        <div style="display: flex; align-items: center; gap: 10px; margin: 20px 0;">
                            <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.1);"></div>
                            <span style="font-size: 0.8rem; color: var(--text-muted);">OR</span>
                            <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.1);"></div>
                        </div>
                        <button id="discordLoginBtn" class="btn-primary full-width" style="background: #5865F2; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 12px; margin-bottom: 5px;">
                            <i class="fab fa-discord"></i> Continue with Discord
                        </button>
                        <div id="authErrorMsg" style="color: #ff4d4d; margin-top: 15px; text-align: center; font-size: 0.9rem; display: none;"></div>
                        <div class="secure-badge" id="authStatusText">🔒 Secure Firebase Authentication</div>
                    </div>
                </div>`;
            document.body.insertAdjacentHTML('beforeend', authHTML);

            // ATTACH DISCORD LISTENER IMMEDIATELY AFTER INJECTION
            const discordBtn = document.getElementById('discordLoginBtn');
            if (discordBtn) {
                discordBtn.addEventListener('click', () => {
                    const CLIENT_ID = '1219213136270659616';
                    const REDIRECT_URI = encodeURIComponent(window.location.origin + '/profile.html');
                    const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=token&scope=identify%20email`;
                    
                    localStorage.setItem('waitingForDiscord', 'true');
                    window.location.href = url;
                });
            }
        }

        if (!document.getElementById('checkoutModal')) {
            const checkoutHTML = `
                <div id="checkoutModal" class="modal-overlay">
                    <div class="modal-container">
                        <button class="close-modal">&times;</button>
                        <div class="modal-header">
                            <h2>Upgrade to <span class="gradient-text">Professional</span></h2>
                            <p>Select your tier and unlock 100% hardware utilization.</p>
                        </div>
                        
                        <!-- Tier Selection Grid -->
                        <div class="tier-selection" style="margin-bottom: 25px;">
                            <label style="display: block; color: var(--text-muted); font-size: 0.85rem; margin-bottom: 12px;">Choose your Premium duration:</label>
                            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;" id="tierGrid">
                                <div class="tier-option active" data-tier="48h" data-price="5.00">
                                    <div class="tier-time">48h</div>
                                    <div class="tier-price">€5</div>
                                </div>
                                <div class="tier-option" data-tier="7d" data-price="10.00">
                                    <div class="tier-time">7 Days</div>
                                    <div class="tier-price">€10</div>
                                </div>
                                <div class="tier-option" data-tier="30d" data-price="15.00">
                                    <div class="tier-time">30 Days</div>
                                    <div class="tier-price">€15</div>
                                </div>
                                <div class="tier-option" data-tier="90d" data-price="40.00">
                                    <div class="tier-time">90 Days</div>
                                    <div class="tier-price">€40</div>
                                </div>
                                <div class="tier-option" data-tier="365d" data-price="120.00">
                                    <div class="tier-time">1 Year</div>
                                    <div class="tier-price">€120</div>
                                </div>
                                <div class="tier-option" data-tier="LIFETIME" data-price="250.00">
                                    <div class="tier-time">LIFETIME</div>
                                    <div class="tier-price">€250</div>
                                </div>
                            </div>
                        </div>

                        <!-- Giveaway / Promo Code Section -->
                        <div style="margin-bottom: 25px; padding: 15px; background: rgba(255,255,255,0.03); border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                            <label style="display: block; color: var(--text-muted); font-size: 0.85rem; margin-bottom: 8px;">Have a Giveaway Code?</label>
                            <div style="display: flex; gap: 10px;">
                                <input type="text" id="promoCodeInput" placeholder="Enter code..." style="flex: 1; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 8px 12px; border-radius: 8px; font-family: monospace;">
                                <button id="redeemPromoBtn" class="btn-primary" style="padding: 8px 15px; font-size: 0.85rem; background: #5865F2;">Redeem</button>
                            </div>
                            <div id="promoError" style="color: #ff4d4d; font-size: 0.75rem; margin-top: 5px; display: none;"></div>
                        </div>

                        <form id="checkoutForm">
                            <div class="form-group">
                                <label>Secure Payment Information</label>
                                <div id="link-authentication-element"></div>
                                <div id="payment-element" style="margin-top: 15px;">
                                    <!-- Stripe Elements will mount here -->
                                    <div id="stripe-loader-status" style="padding: 20px; text-align: center; color: var(--text-muted); background: rgba(255,255,255,0.03); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.1);">
                                        <i class="fas fa-microchip"></i> <span id="stripe-status-text">System Standby...</span><br>
                                        <button id="manualRetryStripe" style="margin-top: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 0.7rem;">Initialize Manually</button>
                                        <div id="stripe-debug-log" style="margin-top: 10px; font-size: 10px; opacity: 0.5; font-family: monospace; text-align: left; padding: 5px; background: #000; border-radius: 4px; display: none;"></div>
                                    </div>
                                </div>
                            </div>
                            <button type="submit" class="btn-primary full-width glow-btn stripe-pay-btn" id="submitPaymentBtn" disabled>
                                <span id="button-text">Pay €5.00</span>
                                <span id="spinner" class="hidden"><i class="fas fa-spinner fa-spin"></i></span>
                            </button>
                            <div id="payment-message" style="color: #ff4d4d; font-size: 0.85rem; margin-top: 15px; text-align: center; display: none;"></div>
                        </form>
                        <div class="secure-badge">🔒 Secure Stripe Checkout</div>
                    </div>
                </div>`;
            document.body.insertAdjacentHTML('beforeend', checkoutHTML);
        }

        if (!document.getElementById('promoResultModal')) {
            const promoResultHTML = `
                <div id="promoResultModal" class="modal-overlay">
                    <div class="modal-container" style="max-width: 400px; text-align: center;">
                        <button class="close-modal close-promo-res">&times;</button>
                        <div class="modal-header">
                            <div style="font-size: 3rem; margin-bottom: 15px;">🎁</div>
                            <h2>Code <span class="gradient-text">Generated</span></h2>
                            <p>One-time use giveaway code created.</p>
                        </div>
                        <div style="background: rgba(88, 101, 242, 0.1); padding: 20px; border-radius: 16px; border: 2px dashed #5865F2; margin: 20px 0;">
                            <div id="generatedCodeDisplay" style="font-family: 'Outfit', sans-serif; font-size: 2rem; font-weight: 900; letter-spacing: 4px; color: #fff; margin-bottom: 10px;">########</div>
                            <div id="generatedDurationDisplay" style="font-size: 0.9rem; color: var(--text-muted);">Duration: 30 Days</div>
                        </div>
                        <button id="copyPromoBtn" class="btn-primary full-width glow-btn" style="background: #5865F2;">
                            <i class="fas fa-copy"></i> Copy Code
                        </button>
                        <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 20px;">The code will stop working as soon as it is redeemed once.</p>
                    </div>
                </div>`;
            document.body.insertAdjacentHTML('beforeend', promoResultHTML);
        }
    };

    // Initialize all modals and listeners
    injectModals();

    const modal = document.getElementById('checkoutModal');
    const promoResModal = document.getElementById('promoResultModal');
    const checkoutTriggers = document.querySelectorAll('.checkout-trigger');
    const closeModalBtns = document.querySelectorAll('.close-modal');
    const checkoutForm = document.getElementById('checkoutForm');
    const payBtn = document.querySelector('.stripe-pay-btn');
    const isProfilePage = window.location.pathname.includes('profile.html') || window.location.pathname.endsWith('/profile');
    const loginBtns = document.querySelectorAll('.login-btn');

    // Global Close Button Handler
    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
             document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
             document.body.style.overflow = 'auto';
        });
    });

    // Promo Code Redemption Logic
    const handleRedeem = async () => {
        const promoInput = document.getElementById('promoCodeInput');
        const redeemBtn = document.getElementById('redeemPromoBtn');
        const promoError = document.getElementById('promoError');
        const code = promoInput.value.trim().toUpperCase();

        if (!code) return;
        if (!auth.currentUser) {
            alert("Please Sign In first to redeem a code!");
            return;
        }

        redeemBtn.textContent = '...';
        redeemBtn.disabled = true;
        promoError.style.display = 'none';

        try {
            const promoDoc = await getDoc(doc(db, "promo_codes", code));
            
            if (promoDoc.exists()) {
                const promoData = promoDoc.data();
                if (promoData.used) {
                    promoError.textContent = "This code has already been redeemed.";
                    promoError.style.display = 'block';
                    redeemBtn.textContent = 'Redeem Code';
                    redeemBtn.disabled = false;
                    return;
                }
                const uid = auth.currentUser.uid;
                
                // --- GRANULAR DURATION CALCULATION ---
                const durationMs = promoData.durationMs || 0;
                const isLifetime = promoData.isLifetime === true;

                const expiresAt = isLifetime ? null : (Date.now() + durationMs);

                const newKey = generateLicenseKey();
                const product = promoData.product || "RL Bot Trainer";

                // 1. Fulfill
                const userUpdate = {
                    plan: "Premium",
                    expiresAt: expiresAt
                };
                
                // Track key by product in user document for easier profile fetching
                if (!auth.currentUser.licenseKeys) {
                    userUpdate.licenseKeys = {};
                }
                userUpdate[`licenseKeys.${product.replace(/\s+/g, '')}`] = newKey;
                
                // For backward compatibility with existing systems
                if (product === "RL Bot Trainer") {
                    userUpdate.licenseKey = newKey;
                }

                await updateDoc(doc(db, "users", uid), userUpdate);
                
                await setDoc(doc(db, "licenses", newKey), {
                    userId: uid,
                    plan: "Premium",
                    product: product,
                    isLifetime: isLifetime,
                    status: "active",
                    createdAt: Date.now()
                });

                // Update the code to mark as used (keeps in history for 24h)
                await updateDoc(doc(db, "promo_codes", code), {
                    used: true,
                    usedBy: auth.currentUser.email,
                    usedAt: Date.now()
                });

                // Format alert message based on available data
                let successMsg = `Success! ${product} code redeemed.`;
                if (isLifetime) {
                    successMsg = `Success! ${product} Lifetime Premium activated.`;
                } else if (promoData.durationMs) {
                    successMsg = `Success! ${product} code redeemed for ${promoData.days||0}d ${promoData.hours||0}h ${promoData.mins||0}m of Premium.`;
                } else {
                    successMsg = `Success! ${product} code redeemed for ${promoData.days||30} days of Premium.`;
                }
                alert(successMsg);
                window.location.reload();
            } else {
                promoError.textContent = "Invalid or already used code.";
                promoError.style.display = 'block';
                redeemBtn.textContent = 'Redeem';
                redeemBtn.disabled = false;
            }
        } catch (err) {
            console.error(err);
            promoError.textContent = "Error: " + err.message;
            promoError.style.display = 'block';
            redeemBtn.textContent = 'Redeem';
            redeemBtn.disabled = false;
        }
    };

    // Attach listener via event delegation or direct if exists
    document.body.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'redeemPromoBtn') {
            handleRedeem();
        }
    });

    // --- IMMEDIATE UI FIX (FLICKER PROTECTION) ---
    if (localStorage.getItem('isLoggedIn') === 'true') {
            loginBtns.forEach(btn => {
                btn.textContent = 'Profile';
                btn.href = 'profile.html';
                btn.setAttribute('data-auth', 'logged-in');
            });
    }

    // Open Modal Function
    const openModal = (e) => {
        e.preventDefault();
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    };

    // Close Modal Function
    const closeModal = () => {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto'; // Restore scrolling
        // Reset form state optionally
        setTimeout(() => {
            checkoutForm.reset();
            payBtn.textContent = 'Pay €5.00';
            payBtn.style.background = 'var(--gradient-glow)';
            payBtn.disabled = false;
        }, 300);
    };

    // Event Listeners for opening modal
    checkoutTriggers.forEach(trigger => {
        trigger.addEventListener('click', openModal);
    });

    // Event Listeners for closing modal

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    // --- TIER SELECTION LOGIC ---
    let selectedTier = '48h';
    let currentPaymentIntentId = null;

    const syncPaymentIntent = async (tier) => {
        if (!currentPaymentIntentId) return;
        try {
            await fetch(`${BACKEND_URL}/update-payment-intent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    paymentIntentId: currentPaymentIntentId,
                    tier: tier 
                })
            });
            console.log(`✅ PaymentIntent updated to ${tier} background.`);
        } catch (err) {
            console.error("❌ Failed to sync PaymentIntent:", err);
        }
    };

    document.body.addEventListener('click', (e) => {
        const tierOpt = e.target.closest('.tier-option');
        if (tierOpt) {
            document.querySelectorAll('.tier-option').forEach(opt => opt.classList.remove('active'));
            tierOpt.classList.add('active');
            selectedTier = tierOpt.getAttribute('data-tier');
            const price = tierOpt.getAttribute('data-price');
            const payBtnText = document.getElementById('button-text');
            if (payBtnText) payBtnText.textContent = `Pay €${price}`;
            
            // BACKGROUND SYNC (No reload = No flicker)
            syncPaymentIntent(selectedTier);
        }
    });

    const stripeLog = (msg) => {
        const logBox = document.getElementById('stripe-debug-log');
        if (logBox) {
            logBox.style.display = 'block';
            logBox.innerHTML += `<div>> ${msg}</div>`;
            logBox.scrollTop = logBox.scrollHeight;
        }
        console.log(`[StripeLog] ${msg}`);
    };

    // --- STRIPE ELEMENTS INTEGRATION ---
    const loadStripeElements = async () => {
        const elementDiv = document.getElementById('payment-element');
        if (!elementDiv) return;

        // SHOW SPINNER IMMEDIATELY
        elementDiv.innerHTML = `
            <div id="stripe-mounting-point" style="padding: 20px; text-align: center; color: var(--text-muted); background: rgba(255,255,255,0.03); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.1);">
                <i class="fas fa-spinner fa-spin"></i> Synchronizing Session...
                <div id="stripe-debug-log" style="margin-top: 10px; font-size: 10px; opacity: 0.5; font-family: monospace; text-align: left; padding: 5px; background: #000; border-radius: 4px; display: block;"></div>
            </div>
        `;

        stripeLog("Verifying Security Credentials...");
        
        // INTELLIGENT AUTH WAIT
        let currentUser = auth.currentUser;
        if (!currentUser) {
            stripeLog("Credentials not found. Waiting 2s for secure handshake...");
            await new Promise(resolve => {
                const unsubscribe = onAuthStateChanged(auth, u => {
                    currentUser = u;
                    unsubscribe();
                    resolve();
                });
                setTimeout(resolve, 2000); 
            });
        }

        if (!currentUser) {
            stripeLog("Fatal: User not authenticated.");
            elementDiv.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #ffbc00; background: rgba(255,188,0,0.05); border-radius: 12px; border: 1px solid rgba(255,188,0,0.2);">
                    <i class="fas fa-user-shield"></i> Session Required<br>
                    <small>Please Sign In to proceed with the purchase.</small>
                    <button onclick="openAuthModal()" style="margin-top: 10px; display: block; width: 100%; padding: 8px; background: #5865F2; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Sign In Now</button>
                </div>
            `;
            return;
        }
        stripeLog(`Identity Verified: ${currentUser.uid.substring(0,8)}`);

        const msgContainer = document.getElementById('payment-message');
        const submitBtn = document.getElementById('submitPaymentBtn');
        submitBtn.disabled = true;

        try {
            stripeLog("Opening Backend Tunnel (Wait up to 60s)...");
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000);

            const response = await fetch(`${BACKEND_URL}/create-payment-intent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userId: currentUser.uid,
                    tier: selectedTier 
                }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            stripeLog(`Response Received: ${response.status}`);
            if (!response.ok) throw new Error(`Gateway returned ${response.status}`);

            const data = await response.json();
            const { clientSecret, paymentIntentId } = data;
            
            if (!clientSecret) throw new Error("Security Error: Null secret.");
            
            stripeLog("Session Sync Complete.");
            currentPaymentIntentId = paymentIntentId;

            // RE-INITIALIZE STRIPE IF NULL
            if (!stripe && typeof Stripe !== 'undefined') {
                stripe = Stripe(STRIPE_PK);
                stripeLog("SDK Re-initialized.");
            }
            if (!stripe) throw new Error("Stripe SDK missing.");

            stripeLog("Generating Payment Interface...");
            elements = stripe.elements({ 
                appearance: {
                    theme: 'night',
                    variables: {
                        colorPrimary: '#5865F2',
                        colorBackground: '#1a1b24',
                        colorText: '#ffffff',
                        spacingUnit: '4px',
                        borderRadius: '8px',
                    },
                }, 
                clientSecret 
            });

            const paymentElement = elements.create("payment", { layout: "tabs" });
            
            stripeLog("Mounting Secure Fields...");
            const mountPoint = document.getElementById('stripe-mounting-point');
            if (mountPoint) mountPoint.innerHTML = '<div id="actual-mount"></div>';
            
            paymentElement.mount("#actual-mount");

            paymentElement.on('ready', () => {
                stripeLog("Ready.");
                submitBtn.disabled = false;
            });

        } catch (err) {
            stripeLog(`Exception: ${err.message}`);
            console.error(err);
            msgContainer.textContent = "Security Notice: " + err.message;
            msgContainer.style.display = 'block';
            
            elementDiv.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #ff4d4d; background: rgba(255,77,77,0.05); border-radius: 12px; border: 1px solid rgba(255,77,77,0.2);">
                    <i class="fas fa-exclamation-triangle"></i> Session Failed<br>
                    <small>${err.message}</small>
                    <button onclick="location.reload()" style="margin-top: 10px; display: block; width: 100%; padding: 5px; background: #ff4d4d; color: #fff; border: none; border-radius: 4px;">Reload Page</button>
                </div>
            `;
        }
    };

    // Trigger Elements Load when modal opens
    checkoutTriggers.forEach(btn => {
        btn.addEventListener('click', async () => {
            // Wait for auth to be fully ready if it's currently null
            let currentUser = auth.currentUser;
            if (!currentUser) {
                // Peek once more just in case
                await new Promise(resolve => {
                    const unsubscribe = onAuthStateChanged(auth, u => {
                        currentUser = u;
                        unsubscribe();
                        resolve();
                    });
                    setTimeout(resolve, 1000); // Max wait 1s
                });
            }

            if (!currentUser) {
                console.warn("⚠️ Checkout triggered but user not authenticated.");
                openAuthModal();
                return;
            }

            const statusText = document.getElementById('stripe-status-text');
            if (statusText) statusText.textContent = "Searching for Secure Container...";

            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            
            // Re-identify elements inside modal
            const elementDiv = document.getElementById('payment-element');
            if (elementDiv) {
                if (statusText) statusText.textContent = "Stripe Container Found. Checking SDK...";
                if (typeof Stripe === 'undefined') {
                    if (statusText) statusText.textContent = "Error: Stripe SDK blocked by browser/extension!";
                    return;
                }
                loadStripeElements();
            } else {
                if (statusText) statusText.textContent = "Critical Error: Element #payment-element not found!";
            }
        });
    });

    // Handle Form Submission (Stripe Elements)
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = document.getElementById('submitPaymentBtn');
            const buttonText = document.getElementById('button-text');
            const spinner = document.getElementById('spinner');
            const msgContainer = document.getElementById('payment-message');

            submitBtn.disabled = true;
            buttonText.classList.add('hidden');
            spinner.classList.remove('hidden');

            const { error } = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    return_url: "https://aerobyte.shop/profile.html?payment=success",
                },
            });

            // This point will only be reached if there is an immediate error when
            // confirming the payment. Otherwise, your customer will be redirected to
            // your `return_url`.
            if (error.type === "card_error" || error.type === "validation_error") {
                msgContainer.textContent = error.message;
            } else {
                msgContainer.textContent = "An unexpected error occurred.";
            }

            msgContainer.style.display = 'block';
            submitBtn.disabled = false;
            buttonText.classList.remove('hidden');
            spinner.classList.add('hidden');
        });
    }

    // --- LEGACY SIMULATED FULFILLMENT (FOR ADMIN USE) ---
    const simulateFulfillment_REMOVED = () => {
        // Function removed to prevent accidental free upgrades via inspection
    };


    // --- Authentication Logic ---
    const authModal = document.getElementById('authModal');
    const closeAuthBtn = document.querySelector('.close-auth-modal');
    // loginBtns is already declared at the top of DOMContentLoaded
    const authForm = document.getElementById('authForm');
    const tabLogin = document.getElementById('tabLogin');
    const tabSignup = document.getElementById('tabSignup');
    const authSubtitle = document.getElementById('authSubtitle');
    const authSubmitBtn = document.getElementById('authSubmitBtn');
    const authErrorMsg = document.getElementById('authErrorMsg');
    
    let isLoginMode = true;

    // Open Auth Modal
    const openAuthModal = (e) => {
        if(auth.currentUser) return;
        if(e) e.preventDefault();
        const modal = document.getElementById('authModal');
        if (modal) {
            modal.classList.remove('hidden'); // Hardening: ensure hidden class doesn't block
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    };

    // Close Auth Modal
    const closeAuthModalFn = () => {
        const modal = document.getElementById('authModal');
        if (!modal) return;
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
        setTimeout(() => {
            const form = document.getElementById('authForm');
            const error = document.getElementById('authErrorMsg');
            if (form) form.reset();
            if (error) error.style.display = 'none';
        }, 300);
    };

    // --- EVENT DELEGATION (Fixes "Sign In button not working") ---
    document.body.addEventListener('click', (e) => {
        if (e.target.classList.contains('login-btn')) {
            // If already logged in, navigate to profile instead of opening auth modal
            if (e.target.getAttribute('data-auth') === 'logged-in') {
                e.preventDefault();
                window.location.href = 'profile.html';
                return;
            }
            openAuthModal(e);
        }
        
        // --- LICENSE KEY TOGGLE/COPY LOGIC ---
        const keyDisplay = document.getElementById('licenseKeyDisplay');
        const toggleBtn = document.getElementById('toggleKeyBtn');
        const copyBtn = e.target.closest('#copyKeyBtn');

        // Toggle Visibility (Clicking text or eye icon)
        if (e.target === keyDisplay || e.target.closest('#toggleKeyBtn')) {
            const isHidden = keyDisplay.textContent.includes('•');
            const actualKey = keyDisplay.getAttribute('data-key');
            keyDisplay.textContent = isHidden ? actualKey : '••••••••';
            const icon = document.querySelector('#toggleKeyBtn i');
            if (icon) icon.className = isHidden ? 'fas fa-eye-slash' : 'fas fa-eye';
            if (toggleBtn) toggleBtn.title = isHidden ? 'Hide Key' : 'Show Key';
        }

        // Copy Key (Always copies the REAL key even if hidden)
        if (copyBtn) {
            const actualKey = keyDisplay.getAttribute('data-key');
            if (actualKey) {
                navigator.clipboard.writeText(actualKey).then(() => {
                    const icon = copyBtn.querySelector('i');
                    const originalClass = icon.className;
                    icon.className = 'fas fa-check';
                    setTimeout(() => { icon.className = originalClass; }, 2000);
                });
            }
        }
    });

    // Profile Key Listeners (Delegated)
    document.body.addEventListener('click', (e) => {
        // Toggle Profile Key
        const toggleBtn = e.target.closest('.toggle-profile-key');
        if (toggleBtn) {
            const container = toggleBtn.parentElement;
            const keyDisplay = container.querySelector('.profile-license-key');
            if (keyDisplay) {
                const isHidden = keyDisplay.textContent.includes('•');
                const actualKey = keyDisplay.getAttribute('data-key');
                keyDisplay.textContent = isHidden ? actualKey : '••••••••';
                const icon = toggleBtn.querySelector('i');
                if (icon) icon.className = isHidden ? 'fas fa-eye-slash' : 'fas fa-eye';
                toggleBtn.title = isHidden ? 'Hide Key' : 'Show Key';
            }
            return;
        }

        // Copy Profile Key
        const copyBtn = e.target.closest('.copy-profile-key');
        if (copyBtn) {
            const actualKey = copyBtn.getAttribute('data-key');
            if (actualKey) {
                navigator.clipboard.writeText(actualKey).then(() => {
                    const icon = copyBtn.querySelector('i');
                    const originalClass = icon.className;
                    icon.className = 'fas fa-check';
                    setTimeout(() => { if(icon) icon.className = originalClass; }, 2000);
                });
            }
            return;
        }

        // Peek/Hide directly on the code element
        const keyDisplay = e.target.closest('.profile-license-key');
        if (keyDisplay) {
            const isHidden = keyDisplay.textContent.includes('•');
            const actualKey = keyDisplay.getAttribute('data-key');
            keyDisplay.textContent = isHidden ? actualKey : '••••••••';
            const toggleBtn = keyDisplay.parentElement.querySelector('.toggle-profile-key');
            if (toggleBtn) {
                const icon = toggleBtn.querySelector('i');
                if (icon) icon.className = isHidden ? 'fas fa-eye-slash' : 'fas fa-eye';
                toggleBtn.title = isHidden ? 'Hide Key' : 'Show Key';
            }
            return;
        }
    });

    if (closeAuthBtn) closeAuthBtn.addEventListener('click', closeAuthModalFn);
    
    if (authModal) {
        authModal.addEventListener('click', (e) => {
            if (e.target === authModal) closeAuthModalFn();
        });
    }

    // Toggle Modes
    const setAuthMode = (loginMode) => {
        isLoginMode = loginMode;
        if (authErrorMsg) authErrorMsg.style.display = 'none';
        
        if(isLoginMode) {
            if(tabLogin) tabLogin.classList.add('active');
            if(tabSignup) tabSignup.classList.remove('active');
            if(authSubtitle) authSubtitle.textContent = 'Sign in to your account.';
            if(authSubmitBtn) authSubmitBtn.textContent = 'Log In';
        } else {
            if(tabSignup) tabSignup.classList.add('active');
            if(tabLogin) tabLogin.classList.remove('active');
            if(authSubtitle) authSubtitle.textContent = 'Create a new account.';
            if(authSubmitBtn) authSubmitBtn.textContent = 'Sign Up';
        }
    };

    if (tabLogin) tabLogin.addEventListener('click', () => setAuthMode(true));
    if (tabSignup) tabSignup.addEventListener('click', () => setAuthMode(false));

    // Handle Auth Submit
    if (authForm) {
        authForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('authEmail').value;
            const password = document.getElementById('authPassword').value;
            
            if (authSubmitBtn) {
                authSubmitBtn.textContent = 'Processing...';
                authSubmitBtn.disabled = true;
            }
            if (authErrorMsg) authErrorMsg.style.display = 'none';

            if (isLoginMode) {
                signInWithEmailAndPassword(auth, email, password)
                    .then((userCredential) => {
                        closeAuthModalFn();
                    })
                    .catch((error) => {
                        if (authErrorMsg) {
                            authErrorMsg.textContent = error.message;
                            authErrorMsg.style.display = 'block';
                        }
                        if (authSubmitBtn) {
                            authSubmitBtn.textContent = 'Log In';
                            authSubmitBtn.disabled = false;
                        }
                    });
            } else {
                createUserWithEmailAndPassword(auth, email, password)
                    .then(async (userCredential) => {
                        const user = userCredential.user;
                        const newKey = generateLicenseKey();
                        
                        await setDoc(doc(db, "users", user.uid), {
                            email: user.email,
                            plan: "Free",
                            licenseKey: newKey,
                            createdAt: Date.now()
                        });
                        
                        await setDoc(doc(db, "licenses", newKey), {
                            userId: user.uid,
                            plan: "Free",
                            status: "active",
                            createdAt: Date.now()
                        });

                        closeAuthModalFn();
                        alert('Account created successfully! Welcome to AeroByte.');
                    })
                    .catch((error) => {
                        if (authErrorMsg) {
                            authErrorMsg.textContent = error.message;
                            authErrorMsg.style.display = 'block';
                        }
                        if (authSubmitBtn) {
                            authSubmitBtn.textContent = 'Sign Up';
                            authSubmitBtn.disabled = false;
                        }
                    });
            }
        });
    }

    // Auth State Listener
    let authResolved = false;
    onAuthStateChanged(auth, (user) => {
        const hasDiscordHash = window.location.hash.includes('access_token=');
        const ssoInProgress = sessionStorage.getItem('discordSSOInProgress') === 'true';
        const globalLock = window.DISCORD_SSO_LOCK === true;

        // Redirect if on profile page and not logged in (UNLESS we are currently processing a Discord SSO)
        if (isProfilePage && !user) {
            if (hasDiscordHash || ssoInProgress || globalLock) {
                console.log("⏳ Profile: Delaying guest redirect (Discord SSO active)...");
                return; 
            }
            // Skip redirect on very first callback — Firebase hasn't resolved auth yet
            if (!authResolved) {
                console.log("⏳ Profile: Auth not resolved yet, waiting for Firebase...");
                authResolved = true;
                return;
            }
            window.location.href = 'index.html';
            return;
        }
        authResolved = true;

        loginBtns.forEach(btn => {
            if (user) {
                localStorage.setItem('isLoggedIn', 'true');
                btn.textContent = 'Profile';
                btn.href = 'profile.html';
                btn.setAttribute('data-auth', 'logged-in');
            } else {
                localStorage.removeItem('isLoggedIn');
                btn.textContent = 'Sign In';
                btn.href = '#';
                btn.removeAttribute('data-auth');
            }
        });

        // --- GLOBAL EXPIRATION DOWNGRADER (runs on every page) ---
        if (user) {
            getDoc(doc(db, "users", user.uid)).then(async (userDoc) => {
                if (!userDoc.exists()) return;
                const userData = userDoc.data();
                const plan = userData.plan;
                const expiresAt = Number(userData.expiresAt);

                if ((plan === "Premium" || plan === "Trial") && expiresAt > 0 && Date.now() > expiresAt) {
                    console.log(`⏰ Plan expired for ${user.email}. Downgrading to Free...`);
                    await updateDoc(doc(db, "users", user.uid), { plan: "Free", expiresAt: null });
                    console.log("✅ Downgraded to Free.");
                    // Reload profile page so UI reflects the change immediately
                    if (isProfilePage) window.location.reload();
                }
            }).catch(err => console.warn("⚠️ Expiry check failed:", err.message));
        }

        // Profile Page specific logic
        if (isProfilePage && user) {
            const profileEmail = document.getElementById('profileEmail');
            const profileWelcomeHeading = document.querySelector('.profile-header h2');
            
            // Initial placeholder
            if (profileEmail) profileEmail.textContent = user.email;

            // Fetch user plan from Firestore
            const planBadge = document.querySelector('.plan-badge');
            const upgradeCta = document.querySelector('.upgrade-cta');
            if (planBadge) {
                planBadge.textContent = "Loading...";
                getDoc(doc(db, "users", user.uid)).then(async (userDoc) => {
                    let userData = { plan: "Free" };
                    let plan = "Free";
                    if (userDoc.exists()) {
                        userData = userDoc.data();
                        plan = userData.plan || "Free";

                        // --- IDENTITY BRANDING: PRIORITIZE DISCORD NAME ---
                        if (userData.discordUsername) {
                            if (profileWelcomeHeading) profileWelcomeHeading.textContent = `Welcome, ${userData.discordUsername}`;
                            if (profileEmail) profileEmail.innerHTML = `<span style="opacity: 0.5;">${user.email}</span>`;
                        } else {
                            if (profileWelcomeHeading) profileWelcomeHeading.textContent = `Welcome Back`;
                            if (profileEmail) profileEmail.textContent = user.email;
                        }

                        // Self-enforcing Expiration Downgrader!
                        if (plan === "Premium" && userData.expiresAt) {
                            if (Date.now() > userData.expiresAt) {
                                plan = "Free"; 
                                await updateDoc(doc(db, "users", user.uid), { plan: "Free", expiresAt: null });
                            }
                        }
                    }

                    // Admin Auto-Upgrade: Ensure hardcoded admins always have 'Owner' plan
                    if (user.email === 'aerobytebot@gmail.com' || user.email === 'adamfrawi@gmail.com') {
                        if (plan !== 'Owner') {
                            console.log("🛡️ Admin auto-upgrade triggered for:", user.email);
                            plan = 'Owner';
                            await updateDoc(doc(db, "users", user.uid), { plan: 'Owner' });
                        }
                    }

                    // 1. Update UI Text immediately
                    planBadge.textContent = plan === "Owner" ? "Owner" : plan + " Plan";

                    // 2. Dynamic License Keys Loading (v4.3)
                    const keysWrapper = document.getElementById('licenseKeysWrapper');
                    const keysList = document.getElementById('licenseKeysList');
                    if (keysWrapper && keysList) {
                        try {
                            const licSnap = await getDocs(query(collection(db, "licenses"), where("userId", "==", user.uid)));
                            if (!licSnap.empty) {
                                keysWrapper.style.display = 'flex';
                                keysList.innerHTML = '';
                                licSnap.forEach(licDoc => {
                                    const licData = licDoc.data();
                                    const licKey = licDoc.id;
                                    const product = licData.product || "RL Bot Trainer";
                                    const isLifetime = licData.isLifetime === true;
                                    const status = isLifetime ? "Lifetime" : (licData.status || "active");
                                    
                                    const row = document.createElement('div');
                                    row.style.cssText = "display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);";
                                    row.innerHTML = `
                                        <div style="flex: 1;">
                                            <div style="font-size: 0.8rem; font-weight: 700; color: #fff; margin-bottom: 4px;">${product}</div>
                                            <div style="font-size: 0.65rem; color: ${isLifetime?'#FFD14D':(status==='active'?'#10B981':'#ff4d4d')}; text-transform: uppercase; letter-spacing: 1px; font-weight: 800;">
                                                ${isLifetime ? '<i class="fas fa-infinity" style="font-size:0.6rem; margin-right:3px;"></i> ' : ''}${status}
                                            </div>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 10px;">
                                            <code class="profile-license-key" data-key="${licKey}" style="background: rgba(0,0,0,0.2); padding: 6px 12px; border-radius: 6px; font-family: monospace; border: 1px solid rgba(255,255,255,0.1); color: var(--secondary); cursor: pointer; font-size: 0.9rem;" title="Click to Reveal">••••••••</code>
                                            <button class="toggle-profile-key" style="background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 0.9rem;" title="Show Key"><i class="fas fa-eye"></i></button>
                                            <button class="copy-profile-key" data-key="${licKey}" style="background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 0.9rem;" title="Copy Key"><i class="fas fa-copy"></i></button>
                                        </div>
                                    `;
                                    keysList.appendChild(row);
                                });
                            }
                        } catch (err) {
                            console.error("Error loading keys:", err);
                        }
                    }

                    // 3. Self-healing for new accounts
                    if (!userDoc.exists()) {
                        try {
                            console.log("🛠️ New account detected. Initializing profile with license key...");
                            const newKey = generateLicenseKey();
                            userData = { 
                                email: user.email, 
                                plan: "Free",
                                licenseKey: newKey,
                                createdAt: Date.now()
                            };
                            await setDoc(doc(db, "users", user.uid), userData);
                            
                            await setDoc(doc(db, "licenses", newKey), {
                                userId: user.uid,
                                plan: "Free",
                                status: "active",
                                hwid: null,
                                createdAt: Date.now()
                            });
                            console.log("✅ New account profile initialized with key:", newKey);
                            
                            // Update UI with new key immediately
                            if (licenseKeyDisplay) licenseKeyDisplay.setAttribute('data-key', newKey);
                        } catch (initErr) {
                            console.error("❌ New account initialization failed:", initErr);
                        }
                    }

                    // 4. Self-healing for existing Free users without a key
                    if (!userData.licenseKey) {
                        try {
                            console.log("🛠️ Existing user missing license key. Generating...");
                            const newKey = generateLicenseKey();
                            await updateDoc(doc(db, "users", user.uid), {
                                licenseKey: newKey
                            });
                            await setDoc(doc(db, "licenses", newKey), {
                                userId: user.uid,
                                plan: userData.plan || "Free",
                                status: "active",
                                hwid: null,
                                createdAt: Date.now()
                            });
                            userData.licenseKey = newKey;
                            console.log("✅ Successfully assigned self-healed license key:", newKey);
                            
                            // Update UI with new key immediately
                            if (licenseKeyDisplay) licenseKeyDisplay.setAttribute('data-key', newKey);
                        } catch (healingErr) {
                            console.error("❌ Self-healing failed. Permissions might be blocked:", healingErr);
                        }
                    }
                    
                    // --- LIVE COUNTDOWN SYSTEM (V2) ---
                    if (window.activeCountdown) clearInterval(window.activeCountdown);
                    
                    const updateTimer = async () => {
                        const expiresAtMs = Number(userData.expiresAt);
                        if (!expiresAtMs || isNaN(expiresAtMs)) return;

                        const now = Date.now();
                        const diff = expiresAtMs - now;
                        let countdownText = "";

                        if (diff > 0) {
                            const days = Math.floor(diff / 86400000);
                            const hours = Math.floor((diff % 86400000) / 3600000);
                            const mins = Math.floor((diff % 3600000) / 60000);
                            const secs = Math.floor((diff % 60000) / 1000);

                            if (plan === "Trial") {
                                if (days > 0) {
                                    countdownText = `Trial ends in: ${days}d ${hours}h`;
                                } else if (hours > 0) {
                                    countdownText = `Trial ends in: ${hours}h ${mins}m`;
                                } else if (mins >= 5) {
                                    countdownText = `Trial ends in: ${mins}m`;
                                } else {
                                    // Under 5 mins: Show seconds
                                    countdownText = `Trial ends in: ${mins}m ${secs}s`;
                                }
                            } else if (plan === "Premium") {
                                countdownText = `Premium expires in: ${days}d`;
                            }
                        } else if (plan === "Trial") {
                            // Handle Expiry
                            if (window.activeCountdown) clearInterval(window.activeCountdown);
                            const existingTimer = planBadge.parentElement.querySelector('.timer-display');
                            if (existingTimer) {
                                existingTimer.style.color = "#ff4d4d";
                                existingTimer.style.fontWeight = "600";
                                existingTimer.textContent = "⚠️ Trial Expired";
                            }
                            await updateDoc(doc(db, "users", user.uid), { plan: "Free", expiresAt: null });
                            setTimeout(() => window.location.reload(), 2000);
                            return;
                        }

                        // Inject/Update UI
                        let timerEl = planBadge.parentElement.querySelector('.timer-display');
                        if (!timerEl && countdownText) {
                            timerEl = document.createElement('div');
                            timerEl.className = 'timer-display';
                            timerEl.style.fontSize = "0.8rem";
                            timerEl.style.marginTop = "8px";
                            timerEl.style.color = "var(--text-muted)";
                            planBadge.parentElement.appendChild(timerEl);
                        }
                        if (timerEl && timerEl.textContent !== countdownText) {
                            timerEl.textContent = countdownText;
                        }
                    };

                    // Initial run and start interval
                    await updateTimer();
                    if (plan === "Trial" && userData.expiresAt) {
                        console.log("⏱️ AeroByte Timer Heartbeat Started (Seconds Enabled)");
                        window.activeCountdown = setInterval(updateTimer, 1000);
                    }

                    // Define Tier Styles
                    const tierStyles = {
                        "Owner": { background: "linear-gradient(135deg, #FFD700, #FF4500)", color: "#fff", border: "none" },
                        "Media": { background: "linear-gradient(135deg, #00FFFF, #1E90FF)", color: "#fff", border: "none" },
                        "Premium": { background: "var(--gradient-glow)", color: "#fff", border: "none" },
                        "Trial": { background: "linear-gradient(135deg, #C0C0C0, #E5E4E2)", color: "#333", border: "none" }
                    };

                    if (tierStyles[plan]) {
                        const style = tierStyles[plan];
                        planBadge.style.background = style.background;
                        planBadge.style.border = style.border;
                        planBadge.style.color = style.color;
                        planBadge.classList.remove('basic-badge');
                        
                        // Show countdown if applicable
                        // This block is now handled by the REFINED UI INJECTION above.
                        // if (countdownText) {
                        //     const countdownEl = document.createElement('div');
                        //     countdownEl.style.fontSize = "0.8rem";
                        //     countdownEl.style.marginTop = "8px";
                        //     countdownEl.style.color = "var(--text-muted)";
                        //     countdownEl.textContent = countdownText;
                        //     planBadge.parentElement.appendChild(countdownEl);
                        // }

                        // Hide Upgrade CTA for high tiers
                        if (["Premium", "Owner", "Media"].includes(plan)) {
                            if (upgradeCta) upgradeCta.style.display = "none";
                        } else {
                            if (upgradeCta) upgradeCta.style.display = "inline-block";
                        }
                    } else {
                        planBadge.style.cssText = "";
                        planBadge.classList.add('basic-badge');
                        if (upgradeCta) upgradeCta.style.display = "inline-block";
                    }

                    // --- Check for Pending Discord Link on Login (v3.4) ---
                    const pendingId = localStorage.getItem('pendingDiscordId');
                    if (pendingId && user) {
                        await updateDoc(doc(db, "users", user.uid), {
                            discordId: String(pendingId),
                            discordUsername: localStorage.getItem('pendingDiscordUsername'),
                            discordAvatar: localStorage.getItem('pendingDiscordAvatar')
                        });
                        localStorage.removeItem('pendingDiscordId');
                        localStorage.removeItem('pendingDiscordUsername');
                        localStorage.removeItem('pendingDiscordAvatar');
                        console.log("✅ Pending Discord link applied!");
                        window.location.reload();
                    }

                    // Discord Integration Status
                    const discordLinkContainer = document.getElementById('discordLinkContainer');
                    const discordStatusMsg = document.getElementById('discordStatusMsg');
                    const linkDiscordBtn = document.getElementById('linkDiscordBtn');

                    if (userData.discordId) {
                        if (linkDiscordBtn) {
                            linkDiscordBtn.innerHTML = 'Re-link';
                            linkDiscordBtn.style.padding = '5px 15px';
                            linkDiscordBtn.style.fontSize = '0.75rem';
                            linkDiscordBtn.style.width = 'auto';
                            linkDiscordBtn.style.alignSelf = 'flex-start';
                        }
                        if (discordStatusMsg) {
                            const avatarUrl = userData.discordAvatar 
                                ? `https://cdn.discordapp.com/avatars/${userData.discordId}/${userData.discordAvatar}.png`
                                : '';
                            
                            const initials = (userData.discordUsername || "A").charAt(0).toUpperCase();

                            discordStatusMsg.innerHTML = `
                                <div style="display: flex; align-items: center; gap: 12px; background: rgba(88, 101, 242, 0.1); padding: 10px; border-radius: 12px; border: 1px solid rgba(88, 101, 242, 0.2);">
                                    ${avatarUrl 
                                        ? `<img src="${avatarUrl}" style="width: 36px; height: 36px; border-radius: 50%; border: 2px solid #5865F2;">` 
                                        : `<div style="width: 36px; height: 36px; border-radius: 50%; background: #5865F2; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #fff; font-size: 1.1rem; border: 2px solid rgba(255,255,255,0.1);">${initials}</div>`
                                    }
                                    <div style="text-align: left;">
                                        <div style="font-weight: 700; color: #fff; font-size: 0.95rem;">${userData.discordUsername || user.email}</div>
                                        <div style="font-size: 0.75rem; color: #10B981;">● Account Connected</div>
                                    </div>
                                </div>
                            `;
                            discordStatusMsg.style.display = 'block';
                        }
                    }

                    // Show Admin Dashboard link if user is administrator
                    const adminPanelLaunch = document.getElementById('adminPanelLaunch');
                    if (adminPanelLaunch && ADMIN_EMAILS.includes(user.email.toLowerCase().trim())) {
                        console.log("🛡️ Admin mode detected: ", user.email);
                        adminPanelLaunch.style.display = 'block';
                    }

                    // (OAuth handling moved to top-level for guest support)
                }).catch(err => {
                    console.error("Error fetching plan:", err);
                    planBadge.textContent = "Free Plan";
                });
            }
        }

        // --- DEDICATED ADMIN DASHBOARD LOGIC ---
        const isAdminPage = window.location.pathname.toLowerCase().includes('admin');
        if (isAdminPage) {
            authResolved = true;

            if (!user) {
                window.location.href = 'index.html';
                return;
            }

            // Check for admin permission
            const currentEmail = user.email ? user.email.toLowerCase().trim() : '';
            console.log("🛠️ Admin Access Check:", currentEmail);
            
            if (!ADMIN_EMAILS.includes(currentEmail)) {
                console.warn("⛔ Unauthorized admin access attempt:", currentEmail);
                window.location.href = 'index.html';
                return;
            }

            // const currentEmail = auth.currentUser?.email?.toLowerCase().trim() || '';
            if (currentEmail === 'aerobytebot@gmail.com') {
                const navApp = document.getElementById('navAppManagement');
                if (navApp) navApp.style.display = 'flex';
                const navBroadcasts = document.getElementById('navBroadcasts');
                if (navBroadcasts) navBroadcasts.style.display = 'flex';
            }

            const tbody = document.getElementById('adminUsersTbody');
            
            const refreshStats = async () => {
                const statTotal = document.getElementById('statTotalUsers');
                const statLicenses = document.getElementById('statActiveLicenses');
                const statOwners = document.getElementById('statOwners');
                if (!statTotal) return;

                try {
                    const [userSnap, licSnap] = await Promise.all([
                        getDocs(collection(db, "users")),
                        getDocs(collection(db, "licenses"))
                    ]);
                    
                    statTotal.textContent = userSnap.size;
                    statLicenses.textContent = licSnap.size;
                    
                    let ownerCount = 0;
                    userSnap.forEach(d => {
                        const p = d.data().plan;
                        if (p === 'Owner' || p === 'Premium') ownerCount++;
                    });
                    statOwners.textContent = ownerCount;
                } catch (err) { console.error("Stats Error:", err); }
            };

            const refreshActivity = async () => {
                const container = document.getElementById('adminActivityBody');
                if (!container) return;

                try {
                    const q = query(collection(db, "system_status"), where("type", "==", "solution"), where("status", "==", "active"));
                    const snap = await getDocs(q);
                    
                    if (snap.empty) {
                        container.innerHTML = '<div style="padding:20px; color:var(--text-muted);">No recent system telemetry.</div>';
                        return;
                    }

                    let html = '';
                    snap.forEach(docSnap => {
                        const data = docSnap.data();
                        const date = new Date(data.createdAt).toLocaleString();
                        html += `
                            <div class="saas-user-row" style="grid-template-columns: 1fr 1fr 1.5fr;">
                                <div style="color: var(--primary); font-family: monospace; font-size: 0.8rem;">[${data.product}]</div>
                                <div style="font-size: 0.8rem; color: #fff;">New License provisioned</div>
                                <div style="font-size: 0.75rem; color: var(--text-muted); text-align: right;">${date}</div>
                            </div>`;
                    });
                    container.innerHTML = html;
                } catch (err) { console.error("Logs Error:", err); }
            };

            const refreshDashboard = async () => {
                if (!tbody) return;
                console.log("🔄 User Database Syncing...");
                
                try {
                    const [userSnap, licSnap] = await Promise.all([
                        getDocs(collection(db, "users")),
                        getDocs(collection(db, "licenses"))
                    ]);
                    
                    const usersList = [];
                    userSnap.forEach(docSnap => {
                        usersList.push({ id: docSnap.id, ...docSnap.data() });
                    });
                    
                    const activity = [];
                    licSnap.forEach(d => {
                        const data = d.data();
                        activity.push({ id: d.id, time: data.createdAt, user: data.userId });
                    });
                    
                    tbody.innerHTML = '';
                    usersList.sort((a,b) => (a.discordUsername || a.email || "").localeCompare(b.discordUsername || b.email || ""));

                    usersList.forEach(user => {
                        const userRow = document.createElement('div');
                        userRow.className = 'saas-user-row';
                        
                        const userActivity = activity.filter(a => a.user === user.id).sort((a,b) => b.time - a.time);
                        let statusColor = '#94A3B8'; let statusLabel = 'Offline'; let lastSeenText = 'Never';
                        if (userActivity.length > 0) {
                            const last = userActivity[0];
                            const timeAgoMs = Date.now() - last.time;
                            const hoursAgo = Math.floor(timeAgoMs / 3600000);
                            const minsAgo = Math.floor((timeAgoMs % 3600000) / 60000);
                            lastSeenText = hoursAgo > 0 ? `${hoursAgo}h ago` : `${minsAgo}m ago`;
                            if (timeAgoMs < (15 * 60 * 1000)) { statusColor = '#10B981'; statusLabel = 'Active'; }
                            else { statusColor = '#F59E0B'; statusLabel = 'Idle'; }
                        }

                        const initials = (user.discordUsername || user.email || "A").charAt(0).toUpperCase();
                        const planClass = (user.plan === 'Owner' || user.plan === 'Premium') ? 'saas-pill-purple' : 'saas-pill-blue';
                        let expiryInfo = '';
                        if (user.plan === 'Trial' && user.planExpiresAt) {
                            const expDate = new Date(user.planExpiresAt);
                            const now = Date.now();
                            const diffDays = Math.ceil((user.planExpiresAt - now) / (1000 * 60 * 60 * 24));
                            expiryInfo = `<p style="font-size: 0.6rem; color: ${diffDays < 3 ? 'var(--danger)' : 'var(--text-muted)'}; margin-top: 4px;">Exp: ${expDate.toLocaleDateString()} (${diffDays}d)</p>`;
                        }

                        userRow.innerHTML = `
                            <div class="saas-user-info">
                                <div class="saas-avatar">${initials}</div>
                                <div>
                                    <p style="font-weight: 700; color: #fff; margin:0;">${user.discordUsername || 'Unlinked User'}</p>
                                    <p style="font-size: 0.7rem; color: var(--text-muted); margin:0;">${user.email}</p>
                                </div>
                            </div>
                            <div>
                                <span class="saas-pill ${planClass}">${user.plan}</span>
                                ${expiryInfo}
                            </div>
                            <div>
                                <div class="saas-status-dot" style="background: ${statusColor};"></div>
                                <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 10px;">${statusLabel}</span>
                            </div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">${lastSeenText}</div>
                            <div class="saas-action-group">
                                <button class="saas-manage-btn action-manage" data-uid="${user.id}"><i class="fas fa-cog"></i></button>
                                <button class="saas-delete-btn action-delete" data-uid="${user.id}" data-email="${user.email}"><i class="fas fa-trash-alt"></i></button>
                            </div>
                        `;
                        tbody.appendChild(userRow);
                    });
                } catch (err) {
                    console.error("Dashboard Error:", err);
                    tbody.innerHTML = `<div style="padding:40px; text-align:center; color:var(--danger);">Error: ${err.message}</div>`;
                }
            };

            // Global Search
            const userSearch = document.getElementById('userSearch');
            if (userSearch) {
                userSearch.addEventListener('input', (e) => {
                    const term = e.target.value.toLowerCase();
                    const rows = tbody.querySelectorAll('.saas-user-row');
                    rows.forEach(row => {
                        const content = row.textContent.toLowerCase();
                        row.style.display = content.includes(term) ? 'grid' : 'none';
                    });
                });
            }

            // Unified Event Listener for Admin Actions
            const handleAdminAction = async (e) => {
                const target = e.target.closest('button, code');
                if (!target) return;

                const uid = target.getAttribute('data-uid');
                const key = target.getAttribute('data-key');
                const product = target.getAttribute('data-product');
                const plan = target.getAttribute('data-plan');

                if (target.classList.contains('admin-license-mask')) {
                    target.textContent = target.textContent.includes('•') ? key : '••••-••••-••••-••••';
                }

                if (target.classList.contains('action-gen-key') || target.classList.contains('action-regen-key')) {
                    if (target.classList.contains('action-regen-key') && !confirm("Regenerate this key? The old one will stop working.")) return;
                    target.disabled = true; target.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                    try {
                        const newKey = generateLicenseKey();
                        const userRef = doc(db, "users", uid);
                        const updateObj = { [`licenseKeys.${product}`]: newKey };
                        if (product === "RL Bot Trainer") updateObj.licenseKey = newKey;
                        await updateDoc(userRef, updateObj);
                        if (key && key !== 'null' && key !== '') await deleteDoc(doc(db, "licenses", key));
                        await setDoc(doc(db, "licenses", newKey), {
                            userId: uid, plan: plan || "Trial", product: product, status: "active", hwid: null, createdAt: Date.now()
                        });
                        
                        // Smart Refresh
                        const activeTabId = document.querySelector('.saas-tab-content.active')?.id;
                        if (activeTabId === 'tabUserDatabase') refreshDashboard();
                        if (activeTabId === 'tabLicenseKeys') refreshLicenses();
                    } catch (err) { alert(err.message); target.disabled = false; target.innerHTML = 'Retry'; }
                }

                if (target.classList.contains('action-reset-hwid')) {
                    if (!confirm("Reset HWID for this license?")) return;
                    try { 
                        // Use setDoc with merge:true to handle legacy keys that might not have a document yet
                        await setDoc(doc(db, "licenses", key), { 
                            hwid: null,
                            status: "active",
                            userId: uid,
                            product: product || "Unknown"
                        }, { merge: true }); 
                        alert("HWID Reset Success!"); 
                    }
                    catch (err) { alert(err.message); }
                }

                if (target.classList.contains('action-ban-hwid')) {
                    if (!confirm("Are you sure you want to BAN this HWID? This will prevent all access from this device.")) return;
                    // First, get the current license doc to see if it even HAS an HWID
                    try {
                        const licSnap = await getDoc(doc(db, "licenses", key));
                        if (!licSnap.exists() || !licSnap.data().hwid) {
                            alert("This license does not have an associated HWID to ban yet.");
                            return;
                        }
                        const curHwid = licSnap.data().hwid;
                        const reason = prompt("Enter ban reason:", "Violating Terms of Service");
                        if (!reason) return;

                        // Add to banned_hwids
                        await setDoc(doc(db, "banned_hwids", curHwid), {
                            hwid: curHwid,
                            reason: reason,
                            bannedAt: Date.now(),
                            bannedBy: auth.currentUser.email,
                            originalKey: key,
                            originalUser: uid
                        });

                        // Mark license as banned
                        await updateDoc(doc(db, "licenses", key), { status: "banned", hwid: "BANNED" });
                        alert("HWID Banned Successfully!");
                        refreshLicenses();
                    } catch (err) { alert(err.message); }
                }

                if (target.classList.contains('action-unban-hwid')) {
                    const bHwid = target.getAttribute('data-hwid');
                    if (confirm(`Unban HWID: ${bHwid}?`)) {
                        try {
                            await deleteDoc(doc(db, "banned_hwids", bHwid));
                            alert("HWID Unbanned!");
                            refreshBans();
                        } catch (err) { alert(err.message); }
                    }
                }

                if (target.classList.contains('action-manage')) {
                    showUserSettingsModal(uid);
                }

                if (target.classList.contains('action-delete')) {
                    const email = target.getAttribute('data-email');
                    if (confirm(`PERMANENTLY delete user ${email}?`)) {
                        await deleteDoc(doc(db, "users", uid));
                        refreshDashboard();
                    }
                }
            };

            if (tbody) tbody.addEventListener('click', handleAdminAction);
            const invContainer = document.getElementById('adminLicenseInventoryBody');
            if (invContainer) invContainer.addEventListener('click', handleAdminAction);
            const banContainer = document.getElementById('adminBansBody');
            if (banContainer) banContainer.addEventListener('click', handleAdminAction);

            // Tabs / Sidebar Logic
            const navItems = document.querySelectorAll('.saas-nav-item');
            const tabSections = document.querySelectorAll('.saas-tab-content');

            navItems.forEach(item => {
                item.addEventListener('click', () => {
                    // Update Sidebar
                    navItems.forEach(i => i.classList.remove('active'));
                    item.classList.add('active');

                    // Update Content
                    const rawName = item.textContent.trim();
                    const tabId = 'tab' + rawName.replace(/\s+/g, '');
                    
                    tabSections.forEach(section => {
                        section.classList.remove('active');
                        if (section.id === tabId) section.classList.add('active');
                    });

                    console.log(`🚀 Navigating to: ${tabId}`);

                    // Lazy Load data for specific tabs
                    if (tabId === 'tabDashboard') refreshStats();
                    if (tabId === 'tabUserDatabase') refreshDashboard();
                    if (tabId === 'tabLicenseKeys') refreshLicenses();
                    if (tabId === 'tabActivityLogs') refreshActivity();
                    if (tabId === 'tabSecurityBans') refreshBans();
                    if (tabId === 'tabProductStatus') refreshProductStatus();
                    if (tabId === 'tabAppManagement') refreshAppManagement();
                    if (tabId === 'tabGlobalBroadcasts') refreshGlobalBroadcasts();
                });
            });

            const refreshGlobalBroadcasts = async () => {
                console.log("📡 Global Broadcasts Syncing...");
                const webActive = document.getElementById('webBroadcastActive');
                const webMsg = document.getElementById('webBroadcastMessage');
                const appActive = document.getElementById('appBroadcastActive');
                const appMsg = document.getElementById('appBroadcastMessage');
                const saveBtn = document.getElementById('saveBroadcastsBtn');
                const status = document.getElementById('broadcastStatus');

                if (!webActive || !webMsg || !appActive || !appMsg || !saveBtn) return;

                try {
                    const snap = await getDoc(doc(db, "config", "global"));
                    if (snap.exists()) {
                        const data = snap.data();
                        webActive.checked = data.broadcast_active || false;
                        webMsg.value = data.broadcast_message || "";
                        appActive.checked = data.app_broadcast_active || false;
                        appMsg.value = data.app_broadcast_message || "";
                    }

                    saveBtn.onclick = async () => {
                        saveBtn.disabled = true;
                        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deploying...';
                        
                        try {
                            await updateDoc(doc(db, "config", "global"), {
                                broadcast_active: webActive.checked,
                                broadcast_message: webMsg.value,
                                app_broadcast_active: appActive.checked,
                                app_broadcast_message: appMsg.value
                            });
                            
                            status.style.display = 'block';
                            setTimeout(() => status.style.display = 'none', 3000);
                        } catch (err) {
                            console.error("Save Error:", err);
                            alert("Failed to save broadcasts: " + err.message);
                        } finally {
                            saveBtn.disabled = false;
                            saveBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Deploy Real-Time Broadcasts';
                        }
                    };
                } catch (err) { console.error("Sync Error:", err); }
            };

            const refreshAppManagement = async () => {
                // const currentEmail = auth.currentUser?.email?.toLowerCase().trim() || '';
            const currentEmail = 'aerobytebot@gmail.com'; // Forced for testing
                if (currentEmail !== 'aerobytebot@gmail.com') return;

                console.log("📡 App Management Syncing...");
                const grid = document.getElementById('appTabsGrid');
                if (!grid) return;

                try {
                    const configSnap = await getDoc(doc(db, "config", "global"));
                    // 2. Fetch App Tabs
                    const tabsSnap = await getDoc(doc(db, "config", "app_tabs"));
                    const activeTabs = tabsSnap.exists() ? tabsSnap.data().visible_ids : [
                        'home', 'categories', 'discover', 'search', 'mylist',
                        'magnet', 'live_matches', 'iptv', 'audiobooks', 'books',
                        'music', 'comics', 'manga', 'jellyfin', 'anime', 'arabic'
                    ];

                    const allTabs = [
                        { id: 'home', label: 'Home', icon: 'fas fa-home' },
                        { id: 'categories', label: 'Categories', icon: 'fas fa-th' },
                        { id: 'discover', label: 'Discover', icon: 'fas fa-compass' },
                        { id: 'search', label: 'Search', icon: 'fas fa-search' },
                        { id: 'mylist', label: 'My List', icon: 'fas fa-bookmark' },
                        { id: 'magnet', label: 'Magnet', icon: 'fas fa-link' },
                        { id: 'live_matches', label: 'Live Matches', icon: 'fas fa-sports-soccer' },
                        { id: 'iptv', label: 'IPTV', icon: 'fas fa-tv' },
                        { id: 'audiobooks', label: 'Audiobooks', icon: 'fas fa-book-open' },
                        { id: 'books', label: 'Books', icon: 'fas fa-book' },
                        { id: 'music', label: 'Music', icon: 'fas fa-music' },
                        { id: 'comics', label: 'Comics', icon: 'fas fa-book-reader' },
                        { id: 'manga', label: 'Manga', icon: 'fas fa-journal-whills' },
                        { id: 'jellyfin', label: 'Jellyfin', icon: 'fas fa-server' },
                        { id: 'anime', label: 'Anime', icon: 'fas fa-play-circle' },
                        { id: 'arabic', label: 'Arabic', icon: 'fas fa-film' }
                    ];

                    grid.innerHTML = allTabs.map(t => {
                        const isEnabled = activeTabs.includes(t.id);
                        return `
                            <div class="saas-card" style="padding: 15px; display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.02);">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <div style="width: 32px; height: 32px; background: ${isEnabled ? 'var(--gradient-saas)' : 'rgba(255,255,255,0.05)'}; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 0.9rem;">
                                        <i class="${t.icon}"></i>
                                    </div>
                                    <span style="font-size: 0.85rem; font-weight: 500; color: #fff;">${t.label}</span>
                                </div>
                                <label class="saas-switch">
                                    <input type="checkbox" class="app-tab-toggle" data-tid="${t.id}" ${isEnabled ? 'checked' : ''}>
                                    <span class="saas-slider"></span>
                                </label>
                            </div>
                        `;
                    }).join('');

                    // 3. Maintenance Control Logic
                    const maintToggleBtn = document.getElementById('maint-toggle-btn');
                    const maintMsgInput = document.getElementById('maint-message-input');
                    const maintSaveMsgBtn = document.getElementById('maint-save-msg-btn');

                    // 3b. Broadcast Control Logic
                    const broadcastToggleBtn = document.getElementById('broadcast-toggle-btn');
                    const broadcastMsgInput = document.getElementById('broadcast-message-input');
                    const broadcastSaveBtn = document.getElementById('broadcast-save-btn');

                    if (maintToggleBtn && maintMsgInput) {
                        const isMaintActive = configSnap.exists() && configSnap.data().maintenance_mode === true;
                        
                        maintToggleBtn.disabled = false;
                        maintToggleBtn.textContent = isMaintActive ? 'DEACTIVATE' : 'ACTIVATE';
                        maintToggleBtn.style.background = isMaintActive ? '#EF444422' : '#10B98122';
                        maintToggleBtn.style.color = isMaintActive ? '#EF4444' : '#10B981';
                        maintToggleBtn.style.border = `1px solid ${isMaintActive ? '#EF444444' : '#10B98144'}`;
                        
                        maintSaveMsgBtn.disabled = false;
                        maintSaveMsgBtn.innerHTML = '<i class="fas fa-comment-dots"></i> Update System Message';
                        maintMsgInput.value = (configSnap.exists() ? configSnap.data().maintenance_message : "") || "AeroByte Cinema is currently undergoing maintenance. Please check back later.";

                        maintToggleBtn.onclick = async () => {
                            maintToggleBtn.disabled = true;
                            maintToggleBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                            try {
                                await setDoc(doc(db, "config", "global"), { 
                                    maintenance_mode: !isMaintActive 
                                }, { merge: true });
                                refreshAppManagement();
                            } catch (e) { alert(e.message); maintToggleBtn.disabled = false; }
                        };

                        maintSaveMsgBtn.onclick = async () => {
                            maintSaveMsgBtn.disabled = true;
                            maintSaveMsgBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
                            try {
                                await setDoc(doc(db, "config", "global"), { 
                                    maintenance_message: maintMsgInput.value 
                                }, { merge: true });
                                alert("System message updated!");
                                refreshAppManagement();
                            } catch (e) { alert(e.message); maintSaveMsgBtn.disabled = false; }
                        };
                    }

                    if (broadcastToggleBtn && broadcastMsgInput) {
                        const isBroadcastActive = configSnap.exists() && configSnap.data().broadcast_active === true;
                        
                        broadcastToggleBtn.disabled = false;
                        broadcastToggleBtn.textContent = isBroadcastActive ? 'STOP BROADCAST' : 'START BROADCAST';
                        broadcastToggleBtn.style.background = isBroadcastActive ? '#EF444422' : '#A855F722';
                        broadcastToggleBtn.style.color = isBroadcastActive ? '#EF4444' : '#A855F7';
                        broadcastToggleBtn.style.border = `1px solid ${isBroadcastActive ? '#EF444444' : '#A855F744'}`;
                        
                        broadcastSaveBtn.disabled = false;
                        broadcastSaveBtn.innerHTML = '<i class="fas fa-rss"></i> Update Broadcast';
                        broadcastMsgInput.value = (configSnap.exists() ? configSnap.data().broadcast_message : "") || "";

                        broadcastToggleBtn.onclick = async () => {
                            broadcastToggleBtn.disabled = true;
                            broadcastToggleBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                            try {
                                await setDoc(doc(db, "config", "global"), { 
                                    broadcast_active: !isBroadcastActive 
                                }, { merge: true });
                                refreshAppManagement();
                            } catch (e) { alert(e.message); broadcastToggleBtn.disabled = false; }
                        };

                        broadcastSaveBtn.onclick = async () => {
                            broadcastSaveBtn.disabled = true;
                            broadcastSaveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Pushing...';
                            try {
                                await setDoc(doc(db, "config", "global"), { 
                                    broadcast_message: broadcastMsgInput.value 
                                }, { merge: true });
                                alert("Broadcast message updated!");
                                refreshAppManagement();
                            } catch (e) { alert(e.message); broadcastSaveBtn.disabled = false; }
                        };
                    }

                    // 4. Attach Toggle Listeners
                    document.querySelectorAll('.app-tab-toggle').forEach(chk => {
                        chk.addEventListener('change', async () => {
                            const tid = chk.getAttribute('data-tid');
                            console.log(`⏳ Toggling tab: ${tid}...`);
                            
                            // Disable to prevent rapid multi-clicks
                            chk.disabled = true;
                            const slider = chk.nextElementSibling;
                            if (slider) slider.style.opacity = "0.5";

                            try {
                                const currentSnap = await getDoc(doc(db, "config", "app_tabs"));
                                let list = [];
                                
                                if (currentSnap.exists() && Array.isArray(currentSnap.data().visible_ids)) {
                                    list = [...currentSnap.data().visible_ids];
                                } else {
                                    // Fallback to default active tabs if doc doesn't exist or visible_ids isn't an array
                                    list = [...activeTabs];
                                }
                                
                                if (chk.checked) {
                                    if (!list.includes(tid)) list.push(tid);
                                } else {
                                    list = list.filter(id => id !== tid);
                                }
                                
                                await setDoc(doc(db, "config", "app_tabs"), { 
                                    visible_ids: list,
                                    lastUpdated: Date.now(),
                                    updatedBy: auth.currentUser?.email || 'Admin'
                                }, { merge: true });
                                
                                console.log(`✅ Tab ${tid} toggled successfully: ${chk.checked}`);
                                
                                // Optional: Small delay for visual feedback of persistence
                                setTimeout(() => refreshAppManagement(), 300);
                            } catch (err) {
                                console.error(`❌ Failed to toggle tab ${tid}:`, err);
                                alert("Failed to save toggle state: " + err.message);
                                // Revert UI state on failure
                                chk.checked = !chk.checked;
                                chk.disabled = false;
                                if (slider) slider.style.opacity = "1";
                            }
                        });
                    });

                } catch (err) {
                    console.error("App Management Error:", err);
                }
            };

            setupProductForm();


            // Promotion Generator
            const genPromoBtn = document.getElementById('genPromoBtn');
            if (genPromoBtn) {
                genPromoBtn.onclick = async () => {
                    const days = parseInt(document.getElementById('promoDays')?.value) || 0;
                    const product = document.getElementById('promoProduct')?.value || "RL Bot Trainer";
                    const isLifetime = document.getElementById('promoLifetime')?.checked || false;
                    const totalMs = isLifetime ? 0 : (days * 24 * 60 * 60 * 1000);
                    
                    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; 
                    const newCode = Array.from({length: 8}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
                    
                    genPromoBtn.disabled = true;
                    try {
                        await setDoc(doc(db, "promo_codes", newCode), {
                            durationMs: totalMs, product: product, isLifetime: isLifetime, createdAt: Date.now(), createdBy: auth.currentUser.email
                        });
                        const modal = document.getElementById('promoResultModal');
                        if (modal) {
                            document.getElementById('generatedCodeDisplay').textContent = newCode;
                            document.getElementById('generatedDurationDisplay').textContent = isLifetime ? `${product} | Lifetime` : `${product} | ${days} Days`;
                            modal.classList.add('active');
                        } else { alert("Code: " + newCode); }
                    } catch (err) { alert(err.message); }
                    finally { genPromoBtn.disabled = false; }
                };
            }

            const showUserSettingsModal = async (uid) => {
                try {
                    const userDoc = await getDoc(doc(db, "users", uid));
                    if (!userDoc.exists()) return;
                    const userData = userDoc.data();

                    let overlay = document.getElementById('userSettingsModal');
                    if (!overlay) {
                        overlay = document.createElement('div');
                        overlay.id = 'userSettingsModal';
                        overlay.style = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;z-index:2000;opacity:0;visibility:hidden;transition:all 0.3s ease;`;
                        document.body.appendChild(overlay);
                    }

                    overlay.innerHTML = `
                        <div class="saas-card" style="width: 400px; padding: 30px; border: 1px solid var(--primary); box-shadow: 0 0 30px var(--glow-purple);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                                <h3 style="margin: 0; color: #fff;">Manage User</h3>
                                <button id="closeUserSettings" style="background: none; border: none; color: var(--text-muted); cursor: pointer;"><i class="fas fa-times"></i></button>
                            </div>
                            
                            <div style="text-align: center; margin-bottom: 25px;">
                                <div class="saas-avatar" style="width: 60px; height: 60px; margin: 0 auto 10px; font-size: 1.5rem; background: var(--gradient-saas);">
                                    ${(userData.discordUsername || userData.email || "A").charAt(0).toUpperCase()}
                                </div>
                                <p style="font-weight: 700; color: #fff; margin: 0;">${userData.discordUsername || 'Unlinked User'}</p>
                                <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">${userData.email}</p>
                            </div>

                            <div style="margin-bottom: 20px;">
                                <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 8px;">Subscription Plan</label>
                                <select id="editUserPlan" style="width: 100%; background: #0F172A; border: 1px solid var(--border-color); color: #fff; padding: 12px; border-radius: 8px; font-family: inherit;">
                                    <option value="Free" ${userData.plan === 'Free' ? 'selected' : ''}>Free</option>
                                    <option value="Trial" ${userData.plan === 'Trial' ? 'selected' : ''}>Trial</option>
                                    <option value="Premium" ${userData.plan === 'Premium' ? 'selected' : ''}>Premium</option>
                                    <option value="Lifetime" ${userData.plan === 'Lifetime' ? 'selected' : ''}>Lifetime</option>
                                    <option value="Owner" ${userData.plan === 'Owner' ? 'selected' : ''}>Owner</option>
                                </select>
                            </div>

                            <div id="trialDurationSection" style="margin-bottom: 20px; display: ${userData.plan === 'Trial' ? 'block' : 'none'};">
                                <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 8px;">Trial Validity (Days)</label>
                                <input type="number" id="editTrialDays" value="30" style="width: 100%; background: #0F172A; border: 1px solid var(--border-color); color: #fff; padding: 12px; border-radius: 8px; font-family: inherit;">
                                <p style="font-size: 0.6rem; color: var(--accent); margin-top: 5px;">* Trial will expire X days from now.</p>
                            </div>

                            <button id="saveUserSetttings" class="btn-primary" style="width: 100%;" data-uid="${uid}">
                                <i class="fas fa-save"></i> Update Membership
                            </button>
                        </div>
                    `;

                    const planSelect = overlay.querySelector('#editUserPlan');
                    const trialSection = overlay.querySelector('#trialDurationSection');
                    planSelect.onchange = (e) => {
                        trialSection.style.display = e.target.value === 'Trial' ? 'block' : 'none';
                    };

                    overlay.style.opacity = '1';
                    overlay.style.visibility = 'visible';

                    overlay.querySelector('#closeUserSettings').onclick = () => {
                        overlay.style.opacity = '0';
                        overlay.style.visibility = 'hidden';
                    };

                    overlay.querySelector('#saveUserSetttings').onclick = async () => {
                        const newPlan = planSelect.value;
                        const saveBtn = overlay.querySelector('#saveUserSetttings');
                        saveBtn.disabled = true;
                        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
                        
                        try {
                            const updateData = { plan: newPlan };
                            if (newPlan === 'Trial') {
                                const days = parseInt(document.getElementById('editTrialDays').value) || 30;
                                updateData.planExpiresAt = Date.now() + (days * 24 * 60 * 60 * 1000);
                            } else {
                                updateData.planExpiresAt = null; // Lifetime/Owner etc don't expire
                            }

                            await updateDoc(doc(db, "users", uid), updateData);
                            overlay.style.opacity = '0';
                            overlay.style.visibility = 'hidden';
                            refreshDashboard();
                        } catch (err) {
                            alert("Error: " + err.message);
                            saveBtn.disabled = false;
                            saveBtn.innerHTML = '<i class="fas fa-save"></i> Update Membership';
                        }
                    };
                } catch (err) { alert(err.message); }
            };

            refreshStats(); // Initial load
            refreshDashboard();
        }

        // --- GLOBAL PRODUCT STATUS MONITOR ---
        const monitorProductStatus = () => {
            const statusIndicator = document.querySelector('.status-dot');
            const path = window.location.pathname;
            let pid = (new URLSearchParams(window.location.search)).get('id');

            // Fallback for legacy pages
            if (!pid) {
                if (path.includes('rl-bot-trainer')) pid = 'rl-bot-trainer';
                if (path.includes('among-us-mod-menu')) pid = 'among-us-mod-menu';
                if (path.includes('cinema')) pid = 'cinema';
            }

            if (!pid) return;

            onSnapshot(doc(db, "system_status", pid), (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.data();
                    const isDown = data.status === 'down';

                    // 1. Update Status Indicator (Dot)
                    if (statusIndicator) {
                        statusIndicator.style.background = isDown ? '#EF4444' : '#10B981';
                        statusIndicator.style.boxShadow = `0 0 10px ${isDown ? '#EF444466' : '#10B98166'}`;
                    }

                    // 2. Update Version Badges and Hero Titles
                    if (data.version) {
                        const badges = document.querySelectorAll('.badge');
                        badges.forEach(b => {
                            const txt = b.textContent;
                            if (txt.toLowerCase().includes('aero') || txt.toLowerCase().includes('v')) {
                                const dot = b.querySelector('.status-dot');
                                b.innerHTML = `AeroByte ${data.name} ${data.version} `;
                                if (dot) b.appendChild(dot);
                                let suffix = data.type === 'streaming' ? 'STREAMING' : 'STABLE RELEASE';
                                b.innerHTML += ` ${suffix}`;
                            }
                        });
                    }

                    // 3. Disable/Enable Downloads and Update Links
                    const downloadButtons = document.querySelectorAll('button.btn-primary:not(.checkout-trigger), a.btn-primary:not(.checkout-trigger), button.btn-secondary, a.btn-secondary');
                    downloadButtons.forEach(btn => {
                        const isDownload = btn.textContent.toLowerCase().includes('download') || btn.textContent.toLowerCase().includes('get');
                        if (isDownload) {
                            if (isDown) {
                                btn.classList.add('disabled-btn');
                                btn.style.pointerEvents = 'none';
                                btn.style.opacity = '0.5';
                                btn.style.filter = 'grayscale(1)';
                                if (!btn.getAttribute('data-orig-text')) btn.setAttribute('data-orig-text', btn.textContent);
                                btn.textContent = 'Service Down';
                            } else {
                                btn.classList.remove('disabled-btn');
                                btn.style.pointerEvents = 'auto';
                                btn.style.opacity = '1';
                                btn.style.filter = 'none';
                                if (btn.getAttribute('data-orig-text')) btn.textContent = btn.getAttribute('data-orig-text');
                                
                                // Dynamic Download URLs
                                btn.removeAttribute('href');
                                btn.style.cursor = 'pointer';

                                const platform = btn.id.replace('download-', '').toLowerCase(); // e.g., 'windows', 'android'
                                const link = data.downloadLinks ? data.downloadLinks[platform] : data.downloadLinks?.windows;
                                
                                btn.onclick = (e) => {
                                    e.preventDefault();
                                    if (link && link !== "#") window.location.assign(link);
                                };
                            }
                        }
                    });
                }
            });
        };

        monitorProductStatus();

        // --- DISCORD OAUTH LOGIC ---
        const DISCORD_CLIENT_ID = '1486472707825467463';
        let REDIRECT_URI = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
            ? 'http://localhost:3000/profile.html' 
            : 'https://aerobyte.shop/profile.html';

        const handleDiscordOAuth = () => {
            localStorage.setItem('waitingForDiscord', 'true');
            const oauthUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token&scope=identify`;
            window.location.href = oauthUrl;
        };

        document.body.addEventListener('click', (e) => {
            const discordBtn = e.target.closest('#linkDiscordBtn') || e.target.closest('#discordLoginBtn');
            if (discordBtn) handleDiscordOAuth();
        });

        // Smooth Scrolling for anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                const currentHref = this.getAttribute('href');
                if(!currentHref || !currentHref.startsWith('#') || currentHref === '#') return;
                const targetElement = document.querySelector(currentHref);
                if(targetElement) {
                    e.preventDefault();
                    targetElement.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });

        // Manual Retry Listener
        document.body.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'manualRetryStripe') {
                const statusText = document.getElementById('stripe-status-text');
                if (statusText) statusText.textContent = "Manual Override Triggered. Initializing...";
                loadStripeElements();
            }
        });

        // Profile Logout Listener
        const profileLogoutBtn = document.getElementById('profileLogoutBtn');
        if (profileLogoutBtn) {
            profileLogoutBtn.addEventListener('click', () => {
                signOut(auth).then(() => {
                    localStorage.removeItem('isLoggedIn');
                    window.location.href = 'index.html';
                }).catch(err => alert("Error signing out: " + err.message));
            });
        }
    }); // End of onAuthStateChanged
}; // End of initAeroByte

// --- ROBUST BOOTSTRAP ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAeroByte);
} else {
    initAeroByte();
}

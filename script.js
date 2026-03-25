import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

document.addEventListener('DOMContentLoaded', () => {
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
                        <div id="authErrorMsg" style="color: #ff4d4d; margin-top: 15px; text-align: center; font-size: 0.9rem; display: none;"></div>
                        <div class="secure-badge" id="authStatusText">🔒 Secure Firebase Authentication</div>
                    </div>
                </div>`;
            document.body.insertAdjacentHTML('beforeend', authHTML);
        }

        if (!document.getElementById('checkoutModal')) {
            const checkoutHTML = `
                <div id="checkoutModal" class="modal-overlay">
                    <div class="modal-container">
                        <button class="close-modal">&times;</button>
                        <div class="modal-header">
                            <h2>Upgrade to <span class="gradient-text">Professional</span></h2>
                            <p>Unlock 100% hardware utilization and cloud-offloaded training.</p>
                        </div>
                        <form id="checkoutForm">
                            <div class="form-group">
                                <label>Card Details</label>
                                <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; color: var(--text-muted); font-size: 0.9rem;">
                                    This is a secure simulation. No real card info required.
                                </div>
                            </div>
                            <button type="submit" class="btn-primary full-width glow-btn pay-btn">Pay $15.00</button>
                        </form>
                        <div class="secure-badge">🔒 Secure Stripe Checkout</div>
                    </div>
                </div>`;
            document.body.insertAdjacentHTML('beforeend', checkoutHTML);
        }
    };
    injectModals();

    const modal = document.getElementById('checkoutModal');
    const checkoutTriggers = document.querySelectorAll('.checkout-trigger');
    const closeModalBtn = document.querySelector('.close-modal');
    const checkoutForm = document.getElementById('checkoutForm');
    const payBtn = document.querySelector('.pay-btn');
    const isProfilePage = window.location.pathname.includes('profile.html');
    const loginBtns = document.querySelectorAll('.login-btn');

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
            payBtn.textContent = 'Pay $15.00';
            payBtn.style.background = 'var(--gradient-glow)';
            payBtn.disabled = false;
        }, 300);
    };

    // Event Listeners for opening modal
    checkoutTriggers.forEach(trigger => {
        trigger.addEventListener('click', openModal);
    });

    // Event Listeners for closing modal
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    // Handle Form Submission (Simulated Checkout)
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Simulate processing state
            payBtn.textContent = 'Processing...';
            payBtn.disabled = true;
            
            setTimeout(() => {
                // Simulate success state
                payBtn.textContent = 'Payment Successful! ✓';
                payBtn.style.background = '#10B981'; // Success green
                
                // Close modal after success
                setTimeout(() => {
                    closeModal();
                    alert('Thank you for upgrading to AeroByte Professional! Your premium model training features have been unlocked.');
                }, 1500);
                
            }, 1500);
        });
    }

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
                        await setDoc(doc(db, "users", user.uid), {
                            email: user.email,
                            plan: "Free"
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
    onAuthStateChanged(auth, (user) => {
        // Redirect if on profile page and not logged in
        if (isProfilePage && !user) {
            window.location.href = 'index.html';
            return;
        }

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

        // Profile Page specific logic
        if (isProfilePage && user) {
            const profileEmail = document.getElementById('profileEmail');
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
                        
                        // Self-enforcing Expiration Downgrader!
                        if (plan === "Premium" && userData.expiresAt) {
                            if (Date.now() > userData.expiresAt) {
                                plan = "Free"; 
                                await updateDoc(doc(db, "users", user.uid), { plan: "Free", expiresAt: null });
                            }
                        }
                    } else {
                        // Self-healing for new accounts
                        userData = { email: user.email, plan: "Free" };
                        await setDoc(doc(db, "users", user.uid), userData);
                    }
                    
                    planBadge.textContent = plan === "Owner" ? "Owner" : plan + " Plan";

                    // License Key Logic
                    const licenseKeyContainer = document.getElementById('licenseKeyContainer');
                    const licenseKeyDisplay = document.getElementById('licenseKeyDisplay');
                    if (licenseKeyContainer && licenseKeyDisplay) {
                        if (plan !== "Free") {
                            licenseKeyContainer.style.display = "block";
                            const actualKey = userData.licenseKey || "AB-WAIT-FOR-ADMIN-2026";
                            
                            licenseKeyDisplay.setAttribute('data-key', actualKey);
                            licenseKeyDisplay.textContent = '••••••••'; // Stay hidden by default
                        } else {
                            licenseKeyContainer.style.display = "none";
                        }
                    }

                    // Handle Countdown for Trial and Premium
                    let countdownText = "";
                    if (userData.expiresAt) {
                        const now = Date.now();
                        const diff = userData.expiresAt - now;
                        if (diff > 0) {
                            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                            if (plan === "Trial") {
                                countdownText = `Trial ends in: ${days}d, ${hours}h`;
                            } else if (plan === "Premium") {
                                countdownText = `Premium expires in: ${days}d`;
                            }
                        }
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
                        if (countdownText) {
                            const countdownEl = document.createElement('div');
                            countdownEl.style.fontSize = "0.8rem";
                            countdownEl.style.marginTop = "8px";
                            countdownEl.style.color = "var(--text-muted)";
                            countdownEl.textContent = countdownText;
                            planBadge.parentElement.appendChild(countdownEl);
                        }

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
                                        <div style="font-weight: 700; color: #fff; font-size: 0.95rem;">${userData.discordUsername || "Verified Account"}</div>
                                        <div style="font-size: 0.75rem; color: #10B981;">● Account Connected</div>
                                    </div>
                                </div>
                            `;
                            discordStatusMsg.style.display = 'block';
                            discordStatusMsg.style.color = 'inherit';
                        }
                    }

                    // --- Handle OAuth Redirect Result (Inside Auth Listener) ---
                    const hash = window.location.hash;
                    if (hash.includes('access_token=') && isProfilePage) {
                        const params = new URLSearchParams(hash.substring(1));
                        const accessToken = params.get('access_token');
                        
                        if (accessToken) {
                            // Clean URL instantly
                            window.history.replaceState({}, document.title, window.location.pathname);
                            
                            if (discordStatusMsg) {
                                discordStatusMsg.textContent = 'Verifying Discord account...';
                                discordStatusMsg.style.display = 'block';
                                discordStatusMsg.style.color = '#fff';
                            }

                            // Fetch Discord Profile
                            fetch('https://discord.com/api/users/@me', {
                                headers: { 'Authorization': `Bearer ${accessToken}` }
                            })
                            .then(res => res.json())
                            .then(async discordUser => {
                                if (!discordUser.id) throw new Error("Discord API error");

                                // Save to Firebase
                                await updateDoc(doc(db, "users", user.uid), {
                                    discordId: discordUser.id,
                                    discordUsername: discordUser.username,
                                    discordAvatar: discordUser.avatar || null
                                });

                                if (discordStatusMsg) {
                                    const tempAvatar = discordUser.avatar 
                                        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=256`
                                        : '';
                                    
                                    discordStatusMsg.innerHTML = `
                                        <div style="display: flex; align-items: center; gap: 12px; background: rgba(88, 101, 242, 0.2); padding: 10px; border-radius: 12px; border: 2px solid #5865F2;">
                                            ${tempAvatar 
                                                ? `<img src="${tempAvatar}" style="width: 36px; height: 36px; border-radius: 50%; border: 2px solid #5865F2;">` 
                                                : `<div style="width: 36px; height: 36px; border-radius: 50%; background: #5865F2; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #fff;">${discordUser.username.charAt(0).toUpperCase()}</div>`
                                            }
                                            <div style="text-align: left;">
                                                <div style="font-weight: 700; color: #fff; font-size: 0.95rem;">${discordUser.username}</div>
                                                <div style="font-size: 0.75rem; color: #10B981;">● Saving Profile...</div>
                                            </div>
                                        </div>
                                    `;
                                    
                                    setTimeout(() => window.location.reload(), 1500);
                                }
                            })
                            .catch(err => {
                                console.error("Discord Link Error:", err);
                                if (discordStatusMsg) {
                                    discordStatusMsg.textContent = `Error: ${err.message || "Connection Failed"}`;
                                    discordStatusMsg.style.color = '#ff4d4d';
                                }
                            });
                        }
                    }
                }).catch(err => {
                    console.error("Error fetching plan:", err);
                    planBadge.textContent = "Free Plan";
                });
            }

            // Reveal Admin Panel
            if (user.email === 'aerobytebot@gmail.com') {
                const adminPanelLaunch = document.getElementById('adminPanelLaunch');
                if (adminPanelLaunch) adminPanelLaunch.style.display = 'block';
            }
        }

        // Dedicated Admin Page Specific Logic
        const isAdminPage = window.location.pathname.includes('admin.html');
        if (isAdminPage) {
            if (!user || user.email !== 'aerobytebot@gmail.com') {
                window.location.href = 'index.html';
                return;
            }

            const tbody = document.getElementById('adminUsersTbody');
            const getUsers = async () => {
                if(!tbody) return;
                try {
                    const snapshot = await getDocs(collection(db, "users"));
                    tbody.innerHTML = '';
                    snapshot.forEach(docSnap => {
                        const data = docSnap.data();
                        const tr = document.createElement('tr');
                        
                        let expiresText = "Never (Lifetime)";
                        if (data.plan === "Premium" && data.expiresAt) {
                            const daysLeft = Math.ceil((data.expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
                            expiresText = daysLeft > 0 ? `${daysLeft} Days` : "Expired!";
                        } else if (data.plan === "Free") {
                            expiresText = "N/A";
                        }

                        const keyDisplay = data.licenseKey ? 
                            `<code style="font-family:monospace; background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px;">${data.licenseKey}</code>` : 
                            `<button class="btn-primary action-gen-key" data-uid="${docSnap.id}" data-plan="${data.plan}" style="padding:4px 8px; font-size:0.7rem; background:transparent; border:1px solid var(--secondary); color:var(--secondary);">Generate</button>`;

                        tr.innerHTML = `
                            <td>${data.email}</td>
                            <td><span class="plan-badge ${data.plan==='Premium'?'':'basic-badge'}" style="${data.plan==='Premium'?'background:var(--gradient-glow);border:none;color:#fff;':''}">${data.plan}</span></td>
                            <td>${keyDisplay}</td>
                            <td style="${expiresText==='Expired!'?'color:#ff4d4d':''}">${expiresText}</td>
                            <td style="display:flex; gap:10px;">
                                <select class="action-plan" data-uid="${docSnap.id}">
                                    <option value="Premium" ${data.plan==='Premium'?'selected':''}>Premium</option>
                                    <option value="Trial" ${data.plan==='Trial'?'selected':''}>Trial</option>
                                    <option value="Media" ${data.plan==='Media'?'selected':''}>Media</option>
                                    <option value="Owner" ${data.plan==='Owner'?'selected':''}>Owner</option>
                                    <option value="Free" ${data.plan!=='Premium' && data.plan!=='Trial' && data.plan!=='Media' && data.plan!=='Owner'?'selected':''}>Free</option>
                                </select>
                                <select class="action-duration" style="${data.plan!=='Premium' && data.plan!=='Trial'?'display:none;':''}">
                                    <option value="lifetime">Lifetime</option>
                                    <option value="30">30 Days</option>
                                    <option value="90">90 Days</option>
                                    <option value="365">1 Year</option>
                                    <option value="custom">Custom</option>
                                </select>
                                <input type="number" class="action-custom" placeholder="Days" style="display:none; width:80px; padding:5px; border-radius:4px; border:1px solid var(--border-color); background:rgba(0,0,0,0.5); color:#fff;">
                                <button class="btn-primary action-save" data-uid="${docSnap.id}" style="padding:6px 12px; font-size:0.8rem; border-radius:6px;">Save</button>
                                <button class="action-delete" data-uid="${docSnap.id}" data-email="${data.email}" style="padding:6px 12px; font-size:0.8rem; border-radius:6px; background:rgba(255,77,77,0.1); border:1px solid #ff4d4d; color:#ff4d4d; cursor:pointer; font-weight:bold;">Delete</button>
                            </td>
                        `;
                        tbody.appendChild(tr);
                    });
                } catch(e) {
                    console.error("Admin error:", e);
                    tbody.innerHTML = `<tr><td colspan="4" style="color:#ff4d4d;">Error loading users: ${e.message}</td></tr>`;
                }
            };
            getUsers();

            // Admin Event Listeners for Dynamic Table Elements
            if(tbody) {
                tbody.addEventListener('change', (e) => {
                    if (e.target.classList.contains('action-plan')) {
                        const durationSelect = e.target.parentElement.querySelector('.action-duration');
                        const customInput = e.target.parentElement.querySelector('.action-custom');
                        if (e.target.value === 'Premium' || e.target.value === 'Trial') {
                            durationSelect.style.display = 'inline-block';
                            if(durationSelect.value === 'custom') customInput.style.display = 'inline-block';
                        } else {
                            durationSelect.style.display = 'none';
                            customInput.style.display = 'none';
                        }
                    }
                    if (e.target.classList.contains('action-duration')) {
                        const customInput = e.target.parentElement.querySelector('.action-custom');
                        if (e.target.value === 'custom') {
                            customInput.style.display = 'inline-block';
                        } else {
                            customInput.style.display = 'none';
                        }
                    }
                });

                tbody.addEventListener('click', async (e) => {
                    // --- GENERATE KEY HANDLER ---
                    if (e.target.classList.contains('action-gen-key')) {
                        const uid = e.target.getAttribute('data-uid');
                        const plan = e.target.getAttribute('data-plan');
                        if (plan === 'Free') {
                            alert("Cannot generate keys for Free users.");
                            return;
                        }

                        const genKey = () => {
                            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                            const rand = (len) => Array.from({length: len}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
                            const p = plan.substring(0, 2).toUpperCase();
                            return `AB-${p}-${rand(4)}-${rand(4)}-2026`;
                        };

                        const newKey = genKey();
                        e.target.textContent = 'Generating...';
                        
                        try {
                            await updateDoc(doc(db, "users", uid), { licenseKey: newKey });
                            // Also register in global licenses collection for app-lookup
                            await setDoc(doc(db, "licenses", newKey), {
                                userId: uid,
                                plan: plan,
                                status: "active",
                                createdAt: Date.now()
                            });
                            getUsers(); // Refresh
                        } catch(err) {
                            alert("Error generating key: " + err.message);
                            e.target.textContent = 'Generate';
                        }
                        return;
                    }

                    if (e.target.classList.contains('action-save')) {
                        const uid = e.target.getAttribute('data-uid');
                        const parent = e.target.parentElement;
                        const planVal = parent.querySelector('.action-plan').value;
                        const durationVal = parent.querySelector('.action-duration').value;
                        const customVal = parent.querySelector('.action-custom').value;
                        
                        e.target.textContent = 'Saving...';
                        
                        let expiresAt = null;
                        if ((planVal === 'Premium' || planVal === 'Trial') && durationVal !== 'lifetime') {
                            let days = durationVal === 'custom' ? parseInt(customVal) : parseInt(durationVal);
                            if (!days || isNaN(days) || days < 1) {
                                alert("Please enter a valid number of days.");
                                e.target.textContent = 'Save';
                                return;
                            }
                            expiresAt = Date.now() + (days * 24 * 60 * 60 * 1000);
                        }

                        try {
                            await updateDoc(doc(db, "users", uid), {
                                plan: planVal,
                                expiresAt: expiresAt
                            });
                            e.target.textContent = 'Saved!';
                            e.target.style.background = '#10B981';
                            setTimeout(() => getUsers(), 1000); // Reload table instantly
                        } catch(err) {
                            console.error(err);
                            alert("Error saving: " + err.message);
                            e.target.textContent = 'Save';
                        }
                    }

                    if (e.target.classList.contains('action-delete')) {
                        const uid = e.target.getAttribute('data-uid');
                        const email = e.target.getAttribute('data-email');
                        
                        if (confirm(`Are you sure you want to remove ${email} from the database? This will reset their plan to Free.`)) {
                            e.target.textContent = 'Deleting...';
                            e.target.disabled = true;
                            
                            try {
                                await deleteDoc(doc(db, "users", uid));
                                setTimeout(() => getUsers(), 500); // Reload table
                            } catch (err) {
                                console.error(err);
                                alert("Error deleting user: " + err.message);
                                e.target.textContent = 'Delete';
                                e.target.disabled = false;
                            }
                        }
                    }
                });
            }

            // Bulk Auth Synchronizer Logic
            const importFile = document.getElementById('importUsersFile');
            const importStatus = document.getElementById('importStatus');
            if (importFile && importStatus) {
                importFile.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (!file) return;

                    importStatus.style.display = 'block';
                    importStatus.style.color = '#fff';
                    importStatus.textContent = 'Parsing JSON file... please do not refresh the page.';

                    const reader = new FileReader();
                    reader.onload = async (event) => {
                        try {
                            const data = JSON.parse(event.target.result);
                            if (!data.users || !Array.isArray(data.users)) {
                                throw new Error("Invalid file format. Make sure you downloaded the 'JSON' export from Firebase Authentication.");
                            }

                            let count = 0;
                            importStatus.textContent = `Synchronizing ${data.users.length} accounts to database...`;

                            // Write missing accounts to Firestore gracefully
                            for (const u of data.users) {
                                if (u.email && u.localId) {
                                    // { merge: true } prevents overwriting someone's existing Premium plan with Free!
                                    await setDoc(doc(db, "users", u.localId), {
                                        email: u.email,
                                        plan: "Free"
                                    }, { merge: true });
                                    count++;
                                }
                            }

                            importStatus.style.color = '#10B981';
                            importStatus.textContent = `Successfully injected ${count} users into Firestore! Reloading...`;
                            
                            setTimeout(() => {
                                importStatus.style.display = 'none';
                                getUsers(); // Refresh UI instantly
                            }, 3000);

                        } catch (err) {
                            console.error(err);
                            importStatus.style.color = '#ff4d4d';
                            importStatus.textContent = 'Error parsing file: ' + err.message;
                        }
                    };
                    reader.readAsText(file);
                });
            }
        }
    });

    // --- DISCORD OAUTH LOGIC ---
    const DISCORD_CLIENT_ID = '1486472707825467463';
    // Automatically detect redirect URI based on environment
    const REDIRECT_URI = window.location.origin + window.location.pathname;

    const linkDiscordBtn = document.getElementById('linkDiscordBtn');
    if (linkDiscordBtn) {
        linkDiscordBtn.addEventListener('click', () => {
            const oauthUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token&scope=identify`;
            window.location.href = oauthUrl;
        });
    }

    // (Discord OAuth handle moved inside Auth Listener for reliability)

    const profileLogoutBtn = document.getElementById('profileLogoutBtn');
    if (profileLogoutBtn) {
        profileLogoutBtn.addEventListener('click', () => {
            signOut(auth).then(() => {
                window.location.href = 'index.html';
            }).catch(console.error);
        });
    }

    // Smooth Scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const currentHref = this.getAttribute('href');
            
            // If the href was dynamically changed away from an anchor, don't intercept!
            if(!currentHref || !currentHref.startsWith('#') || currentHref === '#') return;
            
            // Otherwise, perfectly safely handle the smooth scroll
            const targetElement = document.querySelector(currentHref);
            if(targetElement) {
                e.preventDefault();
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
});

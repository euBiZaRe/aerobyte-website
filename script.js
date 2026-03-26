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
    const STRIPE_PK = 'pk_test_51TFKE1IlExQEZUkSBzHPPiTVBWXwQRvpmW3HlVK7wT35MrB0FDyu2dEzLKvNIre6E70huYkcX5mdgRZtmen2D20700hv4OukTE';
    const BACKEND_URL = 'https://aerobyte-website.onrender.com'; 

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
    injectModals();

    const modal = document.getElementById('checkoutModal');
    const promoResModal = document.getElementById('promoResultModal');
    const checkoutTriggers = document.querySelectorAll('.checkout-trigger');
    const closeModalBtns = document.querySelectorAll('.close-modal');
    const checkoutForm = document.getElementById('checkoutForm');
    const payBtn = document.querySelector('.pay-btn');
    const isProfilePage = window.location.pathname.includes('profile.html');
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
                let durationMs = 0;
                if (promoData.durationMs) {
                    durationMs = promoData.durationMs;
                } else {
                    // Legacy Fallback
                    const durationDays = promoData.days || 30;
                    durationMs = durationDays * 24 * 60 * 60 * 1000;
                }

                const expiresAt = Date.now() + durationMs;

                // Generate Key
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                const rand = (len) => Array.from({length: len}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
                const newKey = `${rand(4)}-${rand(4)}-${rand(4)}-${rand(4)}`;

                // 1. Fulfill
                await updateDoc(doc(db, "users", uid), {
                    plan: "Premium",
                    expiresAt: expiresAt,
                    licenseKey: newKey
                });
                
                await setDoc(doc(db, "licenses", newKey), {
                    userId: uid,
                    plan: "Premium",
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
                let successMsg = `Success! Giveaway code redeemed.`;
                if (promoData.durationMs) {
                    successMsg = `Success! Giveaway code redeemed for ${promoData.days||0}d ${promoData.hours||0}h ${promoData.mins||0}m of Premium.`;
                } else {
                    successMsg = `Success! Giveaway code redeemed for ${promoData.days||30} days of Premium.`;
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

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    // Handle Form Submission (Real Stripe Checkout)
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!auth.currentUser) {
                alert("Please Sign In first to complete your purchase!");
                return;
            }

            payBtn.textContent = 'Contacting Stripe...';
            payBtn.disabled = true;

            try {
                // If backend isn't set up yet, this will fail gracefully
                const response = await fetch(`${BACKEND_URL}/create-checkout-session`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: auth.currentUser.uid })
                });

                const session = await response.json();
                if (session.url) {
                    // Redirect to Stripe-hosted checkout
                    window.location.href = session.url;
                } else {
                    throw new Error(session.error || 'Failed to create session');
                }
            } catch (err) {
                console.error("Stripe Checkout Error:", err);
                alert("Checkout Link Error: " + err.message + "\n\n1. Ensure your backend (server.js) is running on Render/Vercel.\n2. Ensure BACKEND_URL in script.js matches your live backend URL.");
                payBtn.textContent = 'Pay $15.00';
                payBtn.disabled = false;
            }
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
            if (user.email === 'aerobytebot@gmail.com' || user.email === 'adamfrawi@gmail.com') {
                const adminPanelLaunch = document.getElementById('adminPanelLaunch');
                if (adminPanelLaunch) adminPanelLaunch.style.display = 'block';
            }
        }

        // Dedicated Admin Page Specific Logic
        const isAdminPage = window.location.pathname.toLowerCase().includes('admin');
        if (isAdminPage) {
            // Sidebar Toggle Logic
            const sidebar = document.getElementById('adminSidebar');
            const toggle = document.getElementById('sidebarToggle');
            const close = document.getElementById('sidebarClose');

            if (sidebar && toggle) {
                toggle.addEventListener('click', () => sidebar.classList.toggle('active'));
                if (close) close.addEventListener('click', () => sidebar.classList.remove('active'));
            }

            if (!user || (user.email !== 'aerobytebot@gmail.com' && user.email !== 'adamfrawi@gmail.com')) {
                window.location.href = 'index.html';
                return;
            }

            const tbody = document.getElementById('adminUsersTbody');
            let globalActivity = []; // Store activity for Master DB mapping

            // --- NEW UNIFIED DASHBOARD FETCH ---
            const refreshDashboard = async () => {
                if (!tbody) return;
                const rTbody = document.getElementById('recentActivityTbody');
                
                // Show loading state
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 40px; color: var(--text-muted);">🔄 Securely syncing with Firestore...</td></tr>';
                if (rTbody) rTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px; color: var(--text-muted);">🔄 Syncing activity...</td></tr>';
                
                try {
                    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
                    
                    // 1. Fetch Users and Activity in parallel for speed
                    const [userSnap, licSnap, promoSnap] = await Promise.all([
                        getDocs(collection(db, "users")),
                        getDocs(collection(db, "licenses")),
                        getDocs(collection(db, "promo_codes"))
                    ]);
                    
                    const userMap = {};
                    const usersList = [];
                    userSnap.forEach(docSnap => {
                        const data = docSnap.data();
                        userMap[docSnap.id] = data.email;
                        usersList.push({ id: docSnap.id, ...data });
                    });
                    
                    const activity = [];
                    licSnap.forEach(d => {
                        const data = d.data();
                        activity.push({ id: d.id, type: 'License', time: data.createdAt, user: data.userId, plan: data.plan, status: 'Activated', col: 'licenses' });
                    });
                    promoSnap.forEach(d => {
                        const data = d.data();
                        activity.push({ id: d.id, type: 'Promo Code', time: data.createdAt, user: data.usedBy || 'Waiting...', plan: `${data.days}d Plan`, status: data.used ? 'Redeemed' : 'Available', col: 'promo_codes' });
                    });
                    
                    globalActivity = activity; // Store for Master DB status mapping

                    // 2. Render Recent Activity Table
                    if (rTbody) {
                        const within24h = activity.filter(a => a.time > twentyFourHoursAgo);
                        within24h.sort((a,b) => b.time - a.time);
                        
                        if (within24h.length === 0) {
                            rTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 30px; color: var(--text-muted);">No activity recorded in the last 24 hours.</td></tr>';
                        } else {
                            rTbody.innerHTML = '';
                            within24h.forEach(item => {
                                const tr = document.createElement('tr');
                                const timeStr = item.time ? new Date(item.time).toLocaleString() : 'Unknown';
                                const displayUser = userMap[item.user] || item.user;
                                const statusColor = item.status === 'Available' ? '#3B82F6' : '#10B981';
                                tr.innerHTML = `
                                    <td style="color: #10B981; font-family: monospace; font-weight: bold;">${item.id}</td>
                                    <td>${displayUser}</td>
                                    <td><span class="plan-badge" style="font-size:0.7rem;">${item.type}: ${item.plan}</span></td>
                                    <td style="color: var(--text-muted); font-size: 0.85rem;">
                                        <span style="color:${statusColor}; font-weight:bold;">${item.status}</span> @ ${timeStr}
                                    </td>
                                    <td style="text-align:right;">
                                        <button class="action-delete-activity" data-id="${item.id}" data-col="${item.col}" data-type="${item.type}" style="background:rgba(255,77,77,0.1); border:1px solid #ff4d4d; color:#ff4d4d; cursor:pointer; padding:4px 8px; border-radius:4px; font-size:0.75rem; display:inline-flex; align-items:center; gap:5px; transition: opacity 0.2s;" title="Remove this record">
                                            <i class="fas fa-trash"></i> Remove
                                        </button>
                                    </td>
                                `;
                                rTbody.appendChild(tr);
                            });
                        }
                    }
                    
                    // 3. Render Master Database Table
                    tbody.innerHTML = '';
                    usersList.sort((a,b) => (a.email || "").localeCompare(b.email || ""));
                    usersList.forEach(user => {
                        const tr = document.createElement('tr');
                        
                        let expiresText = "Never (Lifetime)";
                        const expiresAtMs = Number(user.expiresAt);
                        if ((user.plan === "Premium" || user.plan === "Trial") && expiresAtMs > 0) {
                            const diff = expiresAtMs - Date.now();
                            if (diff > 0) {
                                const d = Math.floor(diff / 86400000);
                                const h = Math.floor((diff % 86400000) / 3600000);
                                const m = Math.floor((diff % 3600000) / 60000);
                                expiresText = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
                            } else {
                                expiresText = "Expired!";
                            }
                        } else if (user.plan === "Free" || user.plan === "Media" || user.plan === "Owner") {
                            expiresText = "N/A";
                        }

                        const lastTrialAt = Number(user.lastTrialAt);
                        const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
                        let lastTrialText = "Never";
                        let lastTrialStyle = "color: var(--text-muted);";
                        if (lastTrialAt && lastTrialAt > 0) {
                            const timeAgoMs = Date.now() - lastTrialAt;
                            const hoursAgo = Math.floor(timeAgoMs / 3600000);
                            const minsAgo = Math.floor((timeAgoMs % 3600000) / 60000);
                            lastTrialText = hoursAgo > 0 ? `${hoursAgo}h ${minsAgo}m ago` : `${minsAgo}m ago`;
                            if (timeAgoMs < SIX_HOURS_MS) lastTrialStyle = "color: #f59e0b; font-weight: 600;";
                        }

                        const isFree = user.plan === 'Free';
                        const keyDisplay = isFree ? 
                            `<span style="color:var(--text-muted); font-size:0.75rem;">No Key (Free)</span>` :
                            (user.licenseKey ? 
                                `<div style="display:flex; flex-direction:column; gap:5px;">
                                    <code class="admin-license-mask" data-key="${user.licenseKey}" style="font-family:monospace; background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px; cursor:pointer;" title="Click to Peek">••••••••</code>
                                    <div style="display:flex; gap:5px;">
                                        <button class="action-reset-hwid" data-uid="${user.id}" data-key="${user.licenseKey}" style="padding:2px 6px; font-size:0.6rem; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:var(--text-muted); cursor:pointer; border-radius:4px;">Reset HWID</button>
                                        <button class="action-regen-key" data-uid="${user.id}" data-key="${user.licenseKey}" data-plan="${user.plan}" style="padding:2px 6px; font-size:0.6rem; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:var(--text-muted); cursor:pointer; border-radius:4px;">Regen Key</button>
                                    </div>
                                 </div>` : 
                                `<button class="btn-primary action-gen-key" data-uid="${user.id}" data-plan="${user.plan}" style="padding:4px 8px; font-size:0.7rem; background:transparent; border:1px solid var(--secondary); color:var(--secondary);">Generate</button>`);

                        const userActivity = globalActivity.filter(a => a.user === user.id).sort((a,b) => b.time - a.time);
                        let statusText = `<span style="color:var(--text-muted); font-size:0.75rem;">No activity</span>`;
                        if (userActivity.length > 0) {
                            const last = userActivity[0];
                            const timeAgo = Math.floor((Date.now() - last.time) / 60000);
                            const timeStr = timeAgo < 60 ? `${timeAgo}m ago` : `${Math.floor(timeAgo/60)}h ago`;
                            statusText = `<div style="line-height:1.2;"><span style="color:#10B981; font-weight:bold; font-size:0.8rem;">${last.status}</span><br><span style="font-size:0.7rem; color:var(--text-muted);">${timeStr}</span></div>`;
                        }

                        const inputStyle = `width:52px; padding:4px; border-radius:4px; border:1px solid var(--border-color); background:rgba(0,0,0,0.5); color:#fff; font-size:0.75rem;`;
                        const hasDuration = user.plan === 'Premium' || user.plan === 'Trial';
                        
                        tr.innerHTML = `
                            <td>${user.email}</td>
                            <td><span class="plan-badge">${user.plan}</span></td>
                            <td>${keyDisplay}</td>
                            <td style="${expiresText==='Expired!'?'color:#ff4d4d':''}">${expiresText}</td>
                            <td style="${lastTrialStyle}">${lastTrialText}</td>
                            <td>${statusText}</td>
                            <td style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; text-align:right; justify-content:flex-end;">
                                <select class="action-plan" data-uid="${user.id}">
                                    <option value="Premium" ${user.plan==='Premium'?'selected':''}>Premium</option>
                                    <option value="Trial" ${user.plan==='Trial'?'selected':''}>Trial</option>
                                    <option value="Media" ${user.plan==='Media'?'selected':''}>Media</option>
                                    <option value="Owner" ${user.plan==='Owner'?'selected':''}>Owner</option>
                                    <option value="Free" ${user.plan==='Free'?'selected':''}>Free</option>
                                </select>
                                <div class="duration-inputs" style="display:${hasDuration?'flex':'none'}; align-items:center; gap:3px;">
                                    <input type="number" class="action-days" min="0" placeholder="d" style="${inputStyle}" title="Days">
                                    <span style="color:var(--text-muted);font-size:0.7rem;">d</span>
                                    <input type="number" class="action-hours" min="0" max="23" placeholder="h" style="${inputStyle}" title="Hours">
                                    <span style="color:var(--text-muted);font-size:0.7rem;">h</span>
                                    <input type="number" class="action-minutes" min="0" max="59" placeholder="m" style="${inputStyle}" title="Mins">
                                    <span style="color:var(--text-muted);font-size:0.7rem;">m</span>
                                </div>
                                <button class="btn-primary action-save" data-uid="${user.id}" style="padding:6px 12px; font-size:0.8rem; border-radius:6px;">Save</button>
                                <button class="action-delete" data-uid="${user.id}" data-email="${user.email}" style="padding:6px 12px; font-size:0.8rem; border-radius:6px; background:rgba(255,77,77,0.1); border:1px solid #ff4d4d; color:#ff4d4d; cursor:pointer; font-weight:bold;">Delete</button>
                            </td>
                        `;
                        tbody.appendChild(tr);
                    });
                } catch (err) {
                    console.error("Dashboard Error:", err);
                    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:#ff4d4d;">Error loading dashboard: ${err.message}</td></tr>`;
                }
            };

            const rTbody = document.getElementById('recentActivityTbody');
            if (rTbody) {
                rTbody.addEventListener('click', async (e) => {
                    const deleteBtn = e.target.closest('.action-delete-activity');
                    if (!deleteBtn) return;

                    const docId = deleteBtn.getAttribute('data-id');
                    const collectionName = deleteBtn.getAttribute('data-col');
                    const type = deleteBtn.getAttribute('data-type');
                    
                    const confirmMsg = type === 'License' 
                        ? `WARNING: Deleting an active LICENSE (${docId}) will deactivate the user's software. Are you sure?`
                        : `Are you sure you want to remove this Promo Code record (${docId})? It will be permanently deleted.`;

                    if (confirm(confirmMsg)) {
                        deleteBtn.style.opacity = '0.5';
                        deleteBtn.disabled = true;
                        try {
                            await deleteDoc(doc(db, collectionName, docId));
                            refreshDashboard(); // Refresh UI
                        } catch (err) {
                            console.error("Delete Error:", err);
                            alert("Error deleting: " + err.message);
                            deleteBtn.style.opacity = '1';
                            deleteBtn.disabled = false;
                        }
                    }
                });
            }

            // Toggle Activity Log
            const activityToggle = document.getElementById('activityToggle');
            const activityContent = document.getElementById('activityContent');
            const activityChevron = document.getElementById('activityChevron');
            if (activityToggle && activityContent) {
                activityToggle.onclick = () => {
                    const isHidden = activityContent.style.display === 'none';
                    activityContent.style.display = isHidden ? '' : 'none';
                    if (activityChevron) {
                        activityChevron.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(-90deg)';
                    }
                };
            }

            
            refreshDashboard();

            // Unified Search Handler
            const userSearch = document.getElementById('userSearch');
            if (userSearch) {
                userSearch.addEventListener('input', (e) => {
                    const term = e.target.value.toLowerCase();
                    const rows = tbody.querySelectorAll('tr');
                    rows.forEach(row => {
                        const emailCell = row.cells[0];
                        if (emailCell) {
                            const email = emailCell.textContent.toLowerCase();
                            row.style.display = email.includes(term) ? '' : 'none';
                        }
                    });
                });
            }

            // Admin Event Listeners for Dynamic Table Elements
            if(tbody) {
                tbody.addEventListener('change', (e) => {
                    if (e.target.classList.contains('action-plan')) {
                        const durationInputs = e.target.parentElement.querySelector('.duration-inputs');
                        if (e.target.value === 'Premium' || e.target.value === 'Trial') {
                            durationInputs.style.display = 'flex';
                        } else {
                            durationInputs.style.display = 'none';
                        }
                    }
                });

                tbody.addEventListener('click', async (e) => {
                    // --- GENERATE KEY HANDLER ---
                    // --- ADMIN LICENSE MASK TOGGLE ---
                    if (e.target.classList.contains('admin-license-mask')) {
                        const mask = e.target;
                        const key = mask.getAttribute('data-key');
                        mask.textContent = mask.textContent.includes('•') ? key : '••••••••';
                        return;
                    }

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
                            return `${rand(4)}-${rand(4)}-${rand(4)}-${rand(4)}`;
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
                            refreshDashboard(); // Refresh UI
                        } catch(err) {
                            alert("Error generating key: " + err.message);
                            e.target.textContent = 'Generate';
                        }
                        return;
                    }

                    // --- RESET HWID HANDLER ---
                    if (e.target.classList.contains('action-reset-hwid')) {
                        const btn = e.target;
                        const parent = btn.parentElement;
                        const key = btn.getAttribute('data-key');
                        
                        // Show inline confirm
                        btn.style.display = 'none';
                        const confirmUI = document.createElement('div');
                        confirmUI.className = 'inline-confirm';
                        confirmUI.innerHTML = `
                            <span style="font-size:0.6rem; color:#f59e0b; display:block; margin-bottom:2px;">Reset HWID?</span>
                            <div style="display:flex; gap:4px;">
                                <button class="confirm-hwid-yes" style="padding:2px 6px; font-size:0.6rem; background:#10B981; color:#fff; border:none; border-radius:3px; cursor:pointer;">Yes</button>
                                <button class="confirm-hwid-no" style="padding:2px 6px; font-size:0.6rem; background:#ff4d4d; color:#fff; border:none; border-radius:3px; cursor:pointer;">No</button>
                            </div>
                        `;
                        parent.appendChild(confirmUI);

                        const cleanup = () => {
                            confirmUI.remove();
                            btn.style.display = 'inline-block';
                        };

                        confirmUI.querySelector('.confirm-hwid-no').onclick = cleanup;
                        confirmUI.querySelector('.confirm-hwid-yes').onclick = async () => {
                            confirmUI.innerHTML = '<span style="font-size:0.6rem; color:var(--text-muted);">Resetting...</span>';
                            try {
                                await setDoc(doc(db, "licenses", key), { hwid: null }, { merge: true });
                                refreshDashboard();
                            } catch(err) {
                                alert("Error resetting HWID: " + err.message);
                                cleanup();
                            }
                        };
                        return;
                    }

                    // --- REGENERATE KEY HANDLER ---
                    if (e.target.classList.contains('action-regen-key')) {
                        const btn = e.target;
                        const parent = btn.parentElement;
                        const uid = btn.getAttribute('data-uid');
                        const oldKey = btn.getAttribute('data-key');
                        const plan = btn.getAttribute('data-plan');
                        
                        // Show inline confirm
                        btn.style.display = 'none';
                        const confirmUI = document.createElement('div');
                        confirmUI.className = 'inline-confirm';
                        confirmUI.style.marginTop = '4px';
                        confirmUI.innerHTML = `
                            <span style="font-size:0.6rem; color:#ff4d4d; display:block; margin-bottom:2px;">Regen Key? (Old will stop working)</span>
                            <div style="display:flex; gap:4px;">
                                <button class="confirm-regen-yes" style="padding:2px 6px; font-size:0.6rem; background:#10B981; color:#fff; border:none; border-radius:3px; cursor:pointer;">Yes</button>
                                <button class="confirm-regen-no" style="padding:2px 6px; font-size:0.6rem; background:#ff4d4d; color:#fff; border:none; border-radius:3px; cursor:pointer;">No</button>
                            </div>
                        `;
                        parent.appendChild(confirmUI);

                        const cleanup = () => {
                            confirmUI.remove();
                            btn.style.display = 'inline-block';
                        };

                        confirmUI.querySelector('.confirm-regen-no').onclick = cleanup;
                        confirmUI.querySelector('.confirm-regen-yes').onclick = async () => {
                            confirmUI.innerHTML = '<span style="font-size:0.6rem; color:var(--text-muted);">Regenerating...</span>';
                            
                            const genKey = () => {
                                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                                const rand = (len) => Array.from({length: len}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
                                return `${rand(4)}-${rand(4)}-${rand(4)}-${rand(4)}`;
                            };

                            const newKey = genKey();
                            
                            try {
                                if (oldKey) await deleteDoc(doc(db, "licenses", oldKey));
                                await updateDoc(doc(db, "users", uid), { licenseKey: newKey });
                                await setDoc(doc(db, "licenses", newKey), {
                                    userId: uid,
                                    plan: plan,
                                    status: "active",
                                    createdAt: Date.now()
                                });
                                refreshDashboard(); // Refresh UI
                            } catch(err) {
                                alert("Error regenerating key: " + err.message);
                                cleanup();
                            }
                        };
                        return;
                    }

                    if (e.target.classList.contains('action-save')) {
                        const uid = e.target.getAttribute('data-uid');
                        const parent = e.target.parentElement;
                        const planVal = parent.querySelector('.action-plan').value;
                        const daysVal   = parseInt(parent.querySelector('.action-days')?.value)   || 0;
                        const hoursVal  = parseInt(parent.querySelector('.action-hours')?.value)  || 0;
                        const minsVal   = parseInt(parent.querySelector('.action-minutes')?.value) || 0;
                        
                        e.target.textContent = 'Saving...';
                        
                        let expiresAt = null;
                        if (planVal === 'Premium' || planVal === 'Trial') {
                            const totalMs = (daysVal * 24 * 60 * 60 * 1000)
                                         + (hoursVal * 60 * 60 * 1000)
                                         + (minsVal * 60 * 1000);
                            if (totalMs > 0) {
                                expiresAt = Date.now() + totalMs;
                            }
                            // If all fields are 0, it's treated as lifetime (expiresAt stays null)
                        }

                        try {
                            const oldDoc = await getDoc(doc(db, "users", uid));
                            const oldData = oldDoc.data();
                            const oldKey = oldData.licenseKey;
                            const oldPlan = oldData.plan;

                            let updateData = {
                                plan: planVal,
                                expiresAt: expiresAt
                            };

                            // --- AUTOMATED KEY LIFECYCLE MANAGEMENT ---
                            if (planVal === 'Free') {
                                // Downscale: Delete key if it exists
                                if (oldKey) {
                                    await deleteDoc(doc(db, "licenses", oldKey));
                                    updateData.licenseKey = null;
                                }
                            } else if (planVal !== oldPlan || !oldKey) {
                                // Plan changed OR user has no key yet: Issue new key
                                const genKey = () => {
                                    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                                    const rand = (len) => Array.from({length: len}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
                                    return `${rand(4)}-${rand(4)}-${rand(4)}-${rand(4)}`;
                                };
                                const newKey = genKey();
                                
                                // Invalidate old key
                                if (oldKey) await deleteDoc(doc(db, "licenses", oldKey));
                                
                                // Set new key
                                updateData.licenseKey = newKey;
                                await setDoc(doc(db, "licenses", newKey), {
                                    userId: uid,
                                    plan: planVal,
                                    status: "active",
                                    createdAt: Date.now()
                                });
                            }

                            await updateDoc(doc(db, "users", uid), updateData);
                            e.target.textContent = 'Saved!';
                            e.target.style.background = '#10B981';
                            setTimeout(() => {
                                e.target.textContent = 'Save';
                                e.target.style.background = '';
                                refreshDashboard();
                            }, 1200);
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
                                refreshDashboard();
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
                                refreshDashboard();
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
            
            // --- REFRESH DATABASE ---
            const refreshBtn = document.getElementById('refreshBtn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => refreshDashboard());
            }

            // --- GLOBAL ADMIN PROMO GEN HANDLER (Event Delegation) ---
            document.body.addEventListener('click', async (e) => {
                if (e.target && e.target.id === 'genPromoBtn') {
                    console.log("🎁 Giveaway Gen Triggered");
                    const genBtn = e.target;
                    const dInput = document.getElementById('promoDays');
                    const hInput = document.getElementById('promoHours');
                    const mInput = document.getElementById('promoMins');
                    
                    const days = parseInt(dInput?.value) || 0;
                    const hours = parseInt(hInput?.value) || 0;
                    const mins = parseInt(mInput?.value) || 0;
                    
                    const totalMs = (days * 24 * 60 * 60 * 1000) + (hours * 60 * 60 * 1000) + (mins * 60 * 1000);
                    if (totalMs <= 0) {
                        alert("Please enter a valid duration.");
                        return;
                    }
                    
                    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; 
                    const newCode = Array.from({length: 8}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
                    
                    genBtn.textContent = 'Generating...';
                    genBtn.disabled = true;

                    try {
                        // Ensure we are logged in
                        if (!auth.currentUser) throw new Error("Not authenticated");

                        await setDoc(doc(db, "promo_codes", newCode), {
                            durationMs: totalMs,
                            days: days,
                            hours: hours,
                            mins: mins,
                            createdAt: Date.now(),
                            createdBy: auth.currentUser.email
                        });
                        
                        console.log("✅ Code Saved:", newCode);
                        
                        // --- SHOW PREMIUM MODAL ---
                        const promoResModal = document.getElementById('promoResultModal');
                        const codeDisplay = document.getElementById('generatedCodeDisplay');
                        const durationDisplay = document.getElementById('generatedDurationDisplay');
                        
                        if (promoResModal && codeDisplay && durationDisplay) {
                            codeDisplay.textContent = newCode;
                            durationDisplay.textContent = `Duration: ${days}d ${hours}h ${mins}m`;
                            promoResModal.classList.add('active');
                            document.body.style.overflow = 'hidden';
                        } else {
                            // Fallback if modal isn't injected for some reason
                            alert(`🎁 Code Generated: ${newCode}\nDuration: ${days} Days`);
                        }

                        genBtn.textContent = 'Generate One-Time Code';
                        genBtn.disabled = false;
                    } catch (err) {
                        console.error("❌ Giveaway Gen Error:", err);
                        alert("Error generating code: " + err.message);
                        genBtn.textContent = 'Generate One-Time Code';
                        genBtn.disabled = false;
                    }
                }

                // --- COPY PROMO CODE HANDLER ---
                if (e.target && e.target.id === 'copyPromoBtn') {
                    const codeDisplay = document.getElementById('generatedCodeDisplay');
                    if (codeDisplay) {
                        const code = codeDisplay.textContent;
                        navigator.clipboard.writeText(code).then(() => {
                            const originalBtnContent = e.target.innerHTML;
                            e.target.innerHTML = '<i class="fas fa-check"></i> Copied!';
                            e.target.style.background = '#10B981';
                            setTimeout(() => {
                                e.target.innerHTML = originalBtnContent;
                                e.target.style.background = '#5865F2';
                            }, 2000);
                        });
                    }
                }
            });
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

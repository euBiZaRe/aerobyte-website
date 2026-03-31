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

const STRIPE_PK = 'pk_test_51TFKE1IlExQEZUkSBzHPPiTVBWXwQRvpmW3HlVK7wT35MrB0FDyu2dEzLKvNIre6E70huYkcX5mdgRZtmen2D20700hv4OukTE';
const BACKEND_URL = 'https://aerobyte-website.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
    let stripe = null;

    // PRE-WARM BACKEND (Wake up Render free instance immediately)
    fetch(BACKEND_URL).catch(() => {}); 

    // Helper to generate a standardized license key
    const generateLicenseKey = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const rand = (len) => Array.from({length: len}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        return `${rand(4)}-${rand(4)}-${rand(4)}-${rand(4)}`;
    };

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
    injectModals();

    const modal = document.getElementById('checkoutModal');
    const promoResModal = document.getElementById('promoResultModal');
    const checkoutTriggers = document.querySelectorAll('.checkout-trigger');
    const closeModalBtns = document.querySelectorAll('.close-modal');
    const checkoutForm = document.getElementById('checkoutForm');
    const payBtn = document.querySelector('.stripe-pay-btn');
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
                const newKey = generateLicenseKey();

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
    onAuthStateChanged(auth, (user) => {
        const hasDiscordHash = window.location.hash.includes('access_token=');
        const ssoInProgress = sessionStorage.getItem('discordSSOInProgress') === 'true';

        // Redirect if on profile page and not logged in (UNLESS we are currently processing a Discord SSO)
        if (isProfilePage && !user) {
            if (hasDiscordHash || ssoInProgress) {
                console.log("⏳ Profile: Delaying guest redirect (Discord SSO active)...");
                return; 
            }
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

                    // 2. License Key UI Setup (Always visible now)
                    const licenseKeyContainer = document.getElementById('licenseKeyContainer');
                    const licenseKeyDisplay = document.getElementById('licenseKeyDisplay');
                    if (licenseKeyContainer && licenseKeyDisplay) {
                        licenseKeyContainer.style.display = "block";
                        const actualKey = userData.licenseKey || "AB-WAIT-FOR-ADMIN-2026";
                        licenseKeyDisplay.setAttribute('data-key', actualKey);
                        licenseKeyDisplay.textContent = '••••••••'; 
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
                                        <div style="font-weight: 700; color: #fff; font-size: 0.95rem;">${userData.discordUsername || "Verified Account"}</div>
                                        <div style="font-size: 0.75rem; color: #10B981;">● Account Connected</div>
                                    </div>
                                </div>
                            `;
                            discordStatusMsg.style.display = 'block';
                            discordStatusMsg.style.color = 'inherit';
                        }
                    }

                    // (OAuth handling moved to top-level for guest support)
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

            if (!user || (user.email !== 'aerobytebot@gmail.com' && user.email !== 'adamfrawi@gmail.com')) {
                window.location.href = 'index.html';
                return;
            }

            const tbody = document.getElementById('adminUsersTbody');
                     const refreshDashboard = async () => {
                if (!tbody) return;
                const rTbody = document.getElementById('recentActivityTbody');
                
                console.log("🔄 Starting Dashboard Sync...");
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 40px; color: var(--text-muted);">🔄 Securely syncing with Firestore...</td></tr>';
                if (rTbody) rTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px; color: var(--text-muted);">🔄 Syncing activity...</td></tr>';
                
                try {
                    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
                    
                    // Fetch with individual catch blocks to prevent total failure
                    const fetchWithLog = async (name, query) => {
                        console.log(`📡 Fetching ${name}...`);
                        try {
                            const snap = await getDocs(query);
                            console.log(`✅ Fetched ${snap.size} ${name}.`);
                            return snap;
                        } catch (e) {
                            console.warn(`⚠️ Failed to fetch ${name}:`, e.message);
                            if (name === "users") alert(`🛠️ Admin Diagnostic - Error fetching users: ${e.message}`);
                            return { forEach: () => {}, size: 0 }; // Return empty mock
                        }
                    };

                    const [userSnap, licSnap, promoSnap] = await Promise.all([
                        fetchWithLog("users", collection(db, "users")),
                        fetchWithLog("licenses", collection(db, "licenses")),
                        fetchWithLog("promo_codes", collection(db, "promo_codes"))
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
                    
                    let globalActivity = activity;
                    console.log("📊 Sync Complete. Rendering tables...");

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
                                    <td><span class="plan-badge">${item.type}: ${item.plan}</span></td>
                                    <td style="color: var(--text-muted); font-size: 0.85rem;">
                                        <span style="color:${statusColor}; font-weight:bold;">${item.status}</span> @ ${timeStr}
                                    </td>
                                    <td style="text-align:right;">
                                        <div style="display:inline-flex; gap:8px; align-items:center; justify-content:flex-end;">
                                            <button class="action-delete-activity" data-id="${item.id}" data-col="${item.col}" data-type="${item.type}" style="background:rgba(255,77,77,0.1); border:1px solid #ff4d4d; color:#ff4d4d; cursor:pointer; padding:8px 12px; border-radius:6px; font-size:0.75rem; font-weight:800; text-transform:uppercase; letter-spacing:1px; display:inline-flex; align-items:center; gap:5px; transition: opacity 0.2s;" title="Remove this record">
                                                <i class="fas fa-trash"></i> Remove
                                            </button>
                                        </div>
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

                        const keyDisplay = user.licenseKey ? 
                            `<div style="display:flex; flex-direction:column; gap:8px; width:100%;">
                                <code class="admin-license-mask" data-key="${user.licenseKey}" style="font-family:monospace; background:rgba(255,255,255,0.05); padding:4px 8px; border-radius:6px; cursor:pointer; font-size:0.85rem; border:1px solid rgba(255,255,255,0.1); width:fit-content; word-break:break-all;" title="Click to Peek/Hide">••••-••••-••••-••••</code>
                                <div style="display:flex; gap:6px;">
                                    <button class="action-reset-hwid" data-uid="${user.id}" data-key="${user.licenseKey}" style="padding:4px 8px; font-size:0.65rem; background:rgba(88, 101, 242, 0.1); border:1px solid #5865F2; color:#5865F2; cursor:pointer; border-radius:4px; font-weight:700; text-transform:uppercase;">HWID Reset</button>
                                    <button class="action-regen-key" data-uid="${user.id}" data-key="${user.licenseKey}" data-plan="${user.plan}" style="padding:4px 8px; font-size:0.65rem; background:rgba(16, 185, 129, 0.1); border:1px solid #10B981; color:#10B981; cursor:pointer; border-radius:4px; font-weight:700; text-transform:uppercase;">Regen Key</button>
                                </div>
                             </div>` : 
                            `<button class="btn-primary action-gen-key" data-uid="${user.id}" data-plan="${user.plan}" style="padding:6px 12px; font-size:0.7rem; background:#5865F2; color:#fff; border:none; border-radius:6px; font-weight:700;">Generate License</button>`;

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
                            <td style="overflow:visible;">${keyDisplay}</td>
                            <td style="${expiresText==='Expired!'?'color:#ff4d4d':''}">${expiresText}</td>
                            <td style="${lastTrialStyle}">${lastTrialText}</td>
                            <td>${statusText}</td>
                            <td style="text-align:right;">
                                <div style="display:flex; gap:8px; align-items:center; justify-content:flex-end; white-space:nowrap;">
                                    <select class="action-plan" data-uid="${user.id}" style="padding:6px; border-radius:6px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); color:#fff; font-size:0.8rem;">
                                        <option value="Premium" ${user.plan==='Premium'?'selected':''}>Premium</option>
                                        <option value="Trial" ${user.plan==='Trial'?'selected':''}>Trial</option>
                                        <option value="Media" ${user.plan==='Media'?'selected':''}>Media</option>
                                        <option value="Owner" ${user.plan==='Owner'?'selected':''}>Owner</option>
                                        <option value="Free" ${user.plan==='Free'?'selected':''}>Free</option>
                                    </select>
                                    <div class="duration-inputs" style="display:${hasDuration?'flex':'none'}; align-items:center; gap:2px;">
                                        <input type="number" class="action-days" min="0" placeholder="d" style="${inputStyle}" title="Days">
                                        <input type="number" class="action-hours" min="0" max="23" placeholder="h" style="${inputStyle}" title="Hours">
                                        <input type="number" class="action-minutes" min="0" max="59" placeholder="m" style="${inputStyle}" title="Mins">
                                    </div>
                                    <button class="btn-primary action-save" data-uid="${user.id}" style="padding:8px 12px; font-size:0.75rem; border-radius:6px; font-weight:800; text-transform:uppercase; letter-spacing:1px; background:#5865F2;">Save</button>
                                    <button class="action-delete" data-uid="${user.id}" data-email="${user.email}" style="padding:8px 12px; font-size:0.75rem; border-radius:6px; background:rgba(255,77,77,0.1); border:1px solid #ff4d4d; color:#ff4d4d; cursor:pointer; font-weight:800; text-transform:uppercase; letter-spacing:1px;">Delete</button>
                                </div>
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
                    const isHidden = activityContent.classList.toggle('hidden');
                    if (activityChevron) {
                        activityChevron.style.transform = isHidden ? 'rotate(-90deg)' : 'rotate(0deg)';
                    }
                };
            }

            /* --- ADMIN SIDEBAR DRAWER LOGIC --- */
            const sidebar = document.getElementById('adminSidebar');
            const sidebarToggle = document.getElementById('sidebarToggle');
            const sidebarClose = document.getElementById('sidebarClose');

            if (sidebar && sidebarToggle) {
                sidebarToggle.onclick = () => {
                    sidebar.classList.add('active');
                    sidebarToggle.style.display = 'none';
                };
            }
            if (sidebar && sidebarClose) {
                sidebarClose.onclick = () => {
                    sidebar.classList.remove('active');
                    if (sidebarToggle) sidebarToggle.style.display = 'flex';
                };
            }

            // Force Resync Button
            const resyncBtn = document.getElementById('resyncDashboard');
            if (resyncBtn) {
                resyncBtn.onclick = () => {
                    console.log("🔄 Manual Sync Triggered...");
                    resyncBtn.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Syncing...';
                    resyncBtn.disabled = true;
                    refreshDashboard().then(() => {
                        resyncBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Force Resync';
                        resyncBtn.disabled = false;
                    });
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

            // --- Admin Event Listeners ---
            if(tbody) {
                // 1. Change listener for plan/duration selection
                tbody.addEventListener('change', (e) => {
                    const planSelect = e.target.closest('.action-plan');
                    if (planSelect) {
                        const durationInputs = planSelect.parentElement.querySelector('.duration-inputs');
                        if (planSelect.value === 'Premium' || planSelect.value === 'Trial') {
                            durationInputs.style.display = 'flex';
                        } else {
                            durationInputs.style.display = 'none';
                        }
                    }
                });

                // 2. Click listener for all row actions
                tbody.addEventListener('click', async (e) => {
                    // MASK TOGGLE
                    const mask = e.target.closest('.admin-license-mask');
                    if (mask) {
                        const key = mask.getAttribute('data-key');
                        mask.textContent = mask.textContent.includes('•') ? key : '••••-••••-••••-••••';
                        return;
                    }

                    // REGEN KEY (Inline Confirm)
                    const regenBtn = e.target.closest('.action-gen-key') || e.target.closest('.action-regen-key');
                    if (regenBtn) {
                        const parent = regenBtn.parentElement;
                        const uid = regenBtn.getAttribute('data-uid');
                        const plan = regenBtn.getAttribute('data-plan');
                        const oldKey = regenBtn.getAttribute('data-key');


                        if (oldKey) {
                            regenBtn.style.display = 'none';
                            const confirmUI = document.createElement('div');
                            confirmUI.className = 'inline-confirm';
                            confirmUI.innerHTML = `
                                <span style="font-size:0.6rem; color:#f59e0b; display:block; margin-bottom:2px;">Regen Key?</span>
                                <div style="display:flex; gap:4px;">
                                    <button class="confirm-regen-yes" style="padding:4px 8px; font-size:0.6rem; background:#10B981; color:#fff; border:none; border-radius:3px; cursor:pointer; font-weight:800;">Confirm</button>
                                    <button class="confirm-regen-no" style="padding:4px 8px; font-size:0.6rem; background:#ff4d4d; color:#fff; border:none; border-radius:3px; cursor:pointer; font-weight:800;">Cancel</button>
                                </div>
                            `;
                            parent.appendChild(confirmUI);
                            
                            const cleanup = () => { confirmUI.remove(); regenBtn.style.display = 'inline-block'; };
                            confirmUI.querySelector('.confirm-regen-no').onclick = cleanup;
                            confirmUI.querySelector('.confirm-regen-yes').onclick = async () => {
                                confirmUI.innerHTML = '<span style="font-size:0.6rem; color:var(--text-muted);">Generating...</span>';
                                try {
                                    const newKey = generateLicenseKey();
                                    
                                    await updateDoc(doc(db, "users", uid), { licenseKey: newKey });
                                    if (oldKey) await deleteDoc(doc(db, "licenses", oldKey));
                                    await setDoc(doc(db, "licenses", newKey), {
                                        userId: uid, plan: plan, status: "active", hwid: null, createdAt: Date.now()
                                    });
                                    refreshDashboard();
                                } catch(err) { alert("Error: " + err.message); cleanup(); }
                            };
                            return;
                        }

                        // Just Generate (No old key)
                        regenBtn.textContent = 'Updating...'; regenBtn.disabled = true;
                        try {
                        const newKey = generateLicenseKey();
                            await updateDoc(doc(db, "users", uid), { licenseKey: newKey });
                            await setDoc(doc(db, "licenses", newKey), {
                                userId: uid, plan: plan, status: "active", hwid: null, createdAt: Date.now()
                            });
                            refreshDashboard(); 
                        } catch(err) { alert("Error: " + err.message); regenBtn.textContent = 'Generate'; regenBtn.disabled = false; }
                        return;
                    }

                    // RESET HWID (Inline Confirm)
                    const hwidBtn = e.target.closest('.action-reset-hwid');
                    if (hwidBtn) {
                        const parent = hwidBtn.parentElement;
                        const key = hwidBtn.getAttribute('data-key');
                        hwidBtn.style.display = 'none';
                        const confirmUI = document.createElement('div');
                        confirmUI.className = 'inline-confirm';
                        confirmUI.innerHTML = `
                            <span style="font-size:0.6rem; color:#f59e0b; display:block; margin-bottom:2px;">Reset HWID?</span>
                            <div style="display:flex; gap:4px;">
                                <button class="confirm-hwid-yes" style="padding:4px 8px; font-size:0.6rem; background:#10B981; color:#fff; border:none; border-radius:3px; cursor:pointer; font-weight:800;">Confirm</button>
                                <button class="confirm-hwid-no" style="padding:4px 8px; font-size:0.6rem; background:#ff4d4d; color:#fff; border:none; border-radius:3px; cursor:pointer; font-weight:800;">Cancel</button>
                            </div>
                        `;
                        parent.appendChild(confirmUI);
                        const cleanup = () => { confirmUI.remove(); hwidBtn.style.display = 'inline-block'; };
                        confirmUI.querySelector('.confirm-hwid-no').onclick = cleanup;
                        confirmUI.querySelector('.confirm-hwid-yes').onclick = async () => {
                            confirmUI.innerHTML = '<span style="font-size:0.6rem; color:var(--text-muted);">Resetting...</span>';
                            try {
                                await setDoc(doc(db, "licenses", key), { hwid: null }, { merge: true });
                                refreshDashboard();
                            } catch(err) { alert("Error: " + err.message); cleanup(); }
                        };
                        return;
                    }

                    // SAVE USER
                    const saveBtn = e.target.closest('.action-save');
                    if (saveBtn) {
                        const uid = saveBtn.getAttribute('data-uid');
                        const parent = saveBtn.parentElement;
                        const planVal = parent.querySelector('.action-plan').value;
                        const daysVal = parseInt(parent.querySelector('.action-days')?.value) || 0;
                        const hoursVal = parseInt(parent.querySelector('.action-hours')?.value) || 0;
                        const minsVal = parseInt(parent.querySelector('.action-minutes')?.value) || 0;
                        
                        saveBtn.textContent = 'Saving...';
                        let expiresAt = null;
                        if (planVal === 'Premium' || planVal === 'Trial') {
                            const totalMs = (daysVal * 24 * 60 * 60 * 1000) + (hoursVal * 60 * 60 * 1000) + (minsVal * 60 * 1000);
                            if (totalMs > 0) expiresAt = Date.now() + totalMs;
                        }

                        try {
                            const oldDoc = await getDoc(doc(db, "users", uid));
                            const oldData = oldDoc.data();
                            const oldKey = oldData.licenseKey;
                            const oldPlan = oldData.plan;
                            let updateData = { plan: planVal, expiresAt: expiresAt };

                            if (planVal === 'Free') {
                                if (oldKey) { await updateDoc(doc(db, "licenses", oldKey), { plan: "Free" }); }
                                updateData.expiresAt = null;
                            } else if (planVal !== oldPlan || !oldKey) {
                                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                                const rand = (len) => Array.from({length: len}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
                                const newKey = `${rand(4)}-${rand(4)}-${rand(4)}-${rand(4)}`;
                                if (oldKey) await deleteDoc(doc(db, "licenses", oldKey));
                                updateData.licenseKey = newKey;
                                await setDoc(doc(db, "licenses", newKey), { userId: uid, plan: planVal, status: "active", createdAt: Date.now() });
                            }

                            await updateDoc(doc(db, "users", uid), updateData);
                            saveBtn.textContent = 'Saved!'; saveBtn.style.background = '#10B981';
                            setTimeout(() => { saveBtn.textContent = 'Save'; saveBtn.style.background = ''; refreshDashboard(); }, 1200);
                        } catch(err) { alert("Error: " + err.message); saveBtn.textContent = 'Save'; }
                        return;
                    }

                    // DELETE USER
                    const deleteBtn = e.target.closest('.action-delete');
                    if (deleteBtn) {
                        const uid = deleteBtn.getAttribute('data-uid');
                        const email = deleteBtn.getAttribute('data-email');
                        if (confirm(`Remove ${email}?`)) {
                            deleteBtn.textContent = 'Deleting...'; deleteBtn.disabled = true;
                            try { await deleteDoc(doc(db, "users", uid)); refreshDashboard(); }
                            catch (err) { alert("Error: " + err.message); deleteBtn.textContent = 'Delete'; deleteBtn.disabled = false; }
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
    
    // Force a strict Redirect URI to match Discord Developer Portal exactly (Option A).
    // Using profile.html as the universal callback destination.
    let REDIRECT_URI = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:3000/profile.html' 
        : 'https://aerobyte.shop/profile.html';

    const handleDiscordOAuth = () => {
        localStorage.setItem('waitingForDiscord', 'true');
        console.log("🔗 Discord Redirect URI:", REDIRECT_URI);
        const oauthUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token&scope=identify`;
        window.location.href = oauthUrl;
    };

    // Global listener for Discord buttons (Delegate to body for dynamic modals)
    document.body.addEventListener('click', (e) => {
        const discordBtn = e.target.closest('#linkDiscordBtn') || e.target.closest('#discordLoginBtn');
        if (discordBtn) {
            handleDiscordOAuth();
        }
    });

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

    // Manual Retry Listener
    document.body.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'manualRetryStripe') {
            const statusText = document.getElementById('stripe-status-text');
            if (statusText) statusText.textContent = "Manual Override Triggered. Initializing...";
            loadStripeElements();
        }
    });

    // --- GLOBAL DISCORD OAUTH HANDLER (v3.4) ---
    const handleDiscordHash = () => {
        const hash = window.location.hash;
        if (!hash.includes('access_token=')) return;
        
        // Use 'waitingForDiscord' or being on profile as a trigger
        const isLinkingAction = window.location.pathname.includes('profile.html') || localStorage.getItem('waitingForDiscord') === 'true';
        if (!isLinkingAction) return;

        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        if (!accessToken) return;

        // --- NEW: SECURE PROCESSING STATE ---
        sessionStorage.setItem('discordSSOInProgress', 'true');
        console.log("🔄 Starting Secure Discord Handshake...");

        // Show a temporary status if on profile
        const discordStatusMsg = document.getElementById('discordStatusMsg');
        const loginBanner = document.getElementById('loginStatusBanner');
        const loginText = document.getElementById('loginStatusText');

        const updateStatus = (msg, color = '#fff') => {
            if (discordStatusMsg) { discordStatusMsg.textContent = msg; discordStatusMsg.style.display = 'block'; discordStatusMsg.style.color = color; }
            if (loginBanner) loginBanner.style.display = 'block';
            if (loginText) loginText.textContent = msg;
        };

        updateStatus('Verifying Discord Identity...');

        fetch('https://discord.com/api/users/@me', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        })
        .then(res => res.json())
        .then(async discordUser => {
            if (!discordUser.id) throw new Error("Discord API error: Handshake failed.");
            
            const currentUser = auth.currentUser;
            if (currentUser) {
                updateStatus(`Linking ${discordUser.username}...`);
                // Case A: User is already logged in - Link immediately
                await updateDoc(doc(db, "users", currentUser.uid), {
                    discordId: String(discordUser.id),
                    discordUsername: discordUser.username,
                    discordAvatar: discordUser.avatar || null
                });
                console.log("✅ Discord Linked Successfully!");
                
                updateStatus(`Successfully Linked: ${discordUser.username}`, '#10B981');
                
                // Cleanup and Reload
                sessionStorage.removeItem('discordSSOInProgress');
                window.history.replaceState({}, document.title, window.location.pathname);
                setTimeout(() => window.location.reload(), 1000);
            } else {
                // Case B: Guest - 1-Click Discord SSO!
                updateStatus(`Authenticating via Discord...`);
                console.log("🛠️ Initializing 1-Click Discord Sign On for:", discordUser.username);
                
                const synthEmail = `discord_${discordUser.id}@aerobyte.shop`;
                const synthPass = `Aero!Discord!${discordUser.id}`; // Deterministic, secure key
                
                try {
                    // Try to Log In first
                    await signInWithEmailAndPassword(auth, synthEmail, synthPass);
                    updateStatus(`Welcome back, ${discordUser.username}!`, '#10B981');
                    console.log("✅ Discord SSO Login Successful!");
                    
                    // Finalize and Clean Up
                    sessionStorage.removeItem('discordSSOInProgress');
                    window.history.replaceState({}, document.title, window.location.pathname);
                } catch (loginErr) {
                    // If login fails, account doesn't exist. Create it!
                    const isNewUser = loginErr.code === 'auth/user-not-found' || 
                                     loginErr.code === 'auth/invalid-credential' || 
                                     loginErr.code === 'auth/invalid-login-credentials' ||
                                     loginErr.code === 'auth/id-token-expired';

                    if (isNewUser) {
                        updateStatus(`Provisioning License for ${discordUser.username}...`);
                        console.log("🛠️ First time Discord user. Provisioning account...");
                        
                        const newCreds = await createUserWithEmailAndPassword(auth, synthEmail, synthPass);
                        const newUser = newCreds.user;
                        const newKey = generateLicenseKey();
                        
                        await setDoc(doc(db, "users", newUser.uid), {
                            email: synthEmail,
                            plan: "Free",
                            licenseKey: newKey,
                            discordId: String(discordUser.id),
                            discordUsername: discordUser.username,
                            discordAvatar: discordUser.avatar || null,
                            createdAt: Date.now()
                        });
                        
                        await setDoc(doc(db, "licenses", newKey), {
                            userId: newUser.uid,
                            plan: "Free",
                            status: "active",
                            hwid: null,
                            createdAt: Date.now()
                        });
                        
                        updateStatus(`Account Created! Syncing profile...`, '#10B981');
                        console.log("✅ Discord SSO Provisioning Complete!");
                        
                        // Finalize and Clean Up
                        sessionStorage.removeItem('discordSSOInProgress');
                        window.history.replaceState({}, document.title, window.location.pathname);
                    } else {
                        throw loginErr;
                    }
                }
            }
        }).catch(err => {
            console.error("❌ Discord OAuth Error:", err);
            updateStatus("Authentication Failed: " + err.message, "#ff4d4d");
            
            // Critical: If we failed, we MUST clear the blocker so the redirect can happen (or user can retry)
            sessionStorage.removeItem('discordSSOInProgress');
            window.history.replaceState({}, document.title, window.location.pathname);

            // If it failed and we are on profile page as a guest, we MUST redirect now
            if (isProfilePage && !auth.currentUser) {
                setTimeout(() => { window.location.href = 'index.html'; }, 3000);
            }
        });
    };
    handleDiscordHash();
});

document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('checkoutModal');
    const checkoutTriggers = document.querySelectorAll('.checkout-trigger');
    const closeModalBtn = document.querySelector('.close-modal');
    const checkoutForm = document.getElementById('checkoutForm');
    const payBtn = document.querySelector('.pay-btn');

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
    closeModalBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // Handle Form Submission (Simulated Checkout)
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

    // Smooth Scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if(targetId === '#') return;
            
            e.preventDefault();
            const targetElement = document.querySelector(targetId);
            if(targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
});

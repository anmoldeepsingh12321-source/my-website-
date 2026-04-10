// script.js - JavaScript for Ludhiana Water Complaint Portal

document.addEventListener('DOMContentLoaded', function() {
    // Form validation and submission
    const form = document.querySelector('form');
    const contactInput = document.getElementById('contact');
    const contactError = document.getElementById('contact-error');
    const photoInput = document.getElementById('photo');
    const photoName = document.getElementById('photo-name');

    // Mobile number validation
    contactInput.addEventListener('input', function() {
        const value = this.value.replace(/\D/g, '');
        this.value = value;

        if (value.length !== 10) {
            contactError.style.display = 'block';
        } else {
            contactError.style.display = 'none';
        }
    });

    // Photo upload display
    photoInput.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            photoName.textContent = `Selected: ${this.files[0].name}`;
        } else {
            photoName.textContent = '';
        }
    });

    // Form submission
    form.addEventListener('submit', function(e) {
        e.preventDefault();

        // Basic validation
        const name = document.getElementById('name').value.trim();
        const contact = contactInput.value;
        const area = document.getElementById('area').value;
        const street = document.getElementById('street').value.trim();
        const issueType = document.getElementById('issue_type').value;
        const description = document.getElementById('description').value.trim();

        if (!name || contact.length !== 10 || !area || !street || !issueType || !description) {
            alert('Please fill in all required fields correctly.');
            return;
        }

        // Simulate form submission
        alert('Thank you for your complaint! We will respond within 24 hours. Your complaint ID is: LW' + Date.now());

        // Reset form
        form.reset();
        photoName.textContent = '';
        contactError.style.display = 'none';
    });

    // Smooth scrolling for navigation
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Animation on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Observe elements for animation
    document.querySelectorAll('.side-photo, .info-card').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
});
// Configure Tailwind
tailwind.config = {
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                "primary": "#0D47A1",
                "primary-hover": "#0a3880",
                "secondary": "#FFC107",
                "background-light": "#F8F9FA",
                "background-dark": "#111921",
                "text-light": "#212529",
                "text-dark": "#E9ECEF",
                "card-light": "#FFFFFF",
                "card-dark": "#1a2632",
                "border-light": "#E9ECEF",
                "border-dark": "#374151"
            },
            fontFamily: {
                "display": ["Public Sans", "sans-serif"]
            },
            borderRadius: {
                "DEFAULT": "0.5rem",
                "lg": "0.75rem",
                "xl": "1rem",
                "full": "9999px"
            },
        },
    },
};

document.addEventListener('DOMContentLoaded', () => {
    // Mobile Menu Toggle Logic (if we were to add a hamburger menu later)
    // Currently ensuring smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // Accordion interaction for Technical Page
    const detailsElements = document.querySelectorAll('details');
    
    detailsElements.forEach((detail) => {
        detail.addEventListener('toggle', () => {
            if (detail.open) {
                // Optional: Close others when one is opened
                // detailsElements.forEach((otherDetail) => {
                //     if (otherDetail !== detail && otherDetail.open) {
                //         otherDetail.open = false;
                //     }
                // });
                
                // Rotate icon
                const icon = detail.querySelector('.material-symbols-outlined');
                if(icon) icon.style.transform = 'rotate(180deg)';
            } else {
                const icon = detail.querySelector('.material-symbols-outlined');
                if(icon) icon.style.transform = 'rotate(0deg)';
            }
        });
    });
});
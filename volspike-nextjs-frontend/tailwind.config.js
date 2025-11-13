/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
        './src/**/*.{ts,tsx}',
    ],
    theme: {
        container: {
            center: true,
            padding: "2rem",
            screens: {
                "2xl": "1400px",
            },
        },
        extend: {
            colors: {
                /* Shadcn-compatible tokens */
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },

                /* Extended Design System Tokens */
                brand: {
                    50: "hsl(var(--brand-50))",
                    100: "hsl(var(--brand-100))",
                    200: "hsl(var(--brand-200))",
                    300: "hsl(var(--brand-300))",
                    400: "hsl(var(--brand-400))",
                    500: "hsl(var(--brand-500))",
                    600: "hsl(var(--brand-600))",
                    700: "hsl(var(--brand-700))",
                    800: "hsl(var(--brand-800))",
                    900: "hsl(var(--brand-900))",
                    950: "hsl(var(--brand-950))",
                    DEFAULT: "hsl(var(--brand-500))",
                    glow: "hsl(var(--brand-glow))",
                },
                sec: {
                    50: "hsl(var(--secondary-50))",
                    100: "hsl(var(--secondary-100))",
                    200: "hsl(var(--secondary-200))",
                    300: "hsl(var(--secondary-300))",
                    400: "hsl(var(--secondary-400))",
                    500: "hsl(var(--secondary-500))",
                    600: "hsl(var(--secondary-600))",
                    700: "hsl(var(--secondary-700))",
                    800: "hsl(var(--secondary-800))",
                    900: "hsl(var(--secondary-900))",
                    950: "hsl(var(--secondary-950))",
                    DEFAULT: "hsl(var(--secondary-500))",
                },
                elite: {
                    50: "hsl(var(--tertiary-50))",
                    100: "hsl(var(--tertiary-100))",
                    200: "hsl(var(--tertiary-200))",
                    300: "hsl(var(--tertiary-300))",
                    400: "hsl(var(--tertiary-400))",
                    500: "hsl(var(--tertiary-500))",
                    600: "hsl(var(--tertiary-600))",
                    700: "hsl(var(--tertiary-700))",
                    800: "hsl(var(--tertiary-800))",
                    900: "hsl(var(--tertiary-900))",
                    950: "hsl(var(--tertiary-950))",
                    DEFAULT: "hsl(var(--tertiary-500))",
                },
                warning: {
                    50: "hsl(var(--warning-50))",
                    100: "hsl(var(--warning-100))",
                    200: "hsl(var(--warning-200))",
                    300: "hsl(var(--warning-300))",
                    400: "hsl(var(--warning-400))",
                    500: "hsl(var(--warning-500))",
                    600: "hsl(var(--warning-600))",
                    700: "hsl(var(--warning-700))",
                    800: "hsl(var(--warning-800))",
                    900: "hsl(var(--warning-900))",
                    950: "hsl(var(--warning-950))",
                    DEFAULT: "hsl(var(--warning-500))",
                },
                danger: {
                    50: "hsl(var(--danger-50))",
                    100: "hsl(var(--danger-100))",
                    200: "hsl(var(--danger-200))",
                    300: "hsl(var(--danger-300))",
                    400: "hsl(var(--danger-400))",
                    500: "hsl(var(--danger-500))",
                    600: "hsl(var(--danger-600))",
                    700: "hsl(var(--danger-700))",
                    800: "hsl(var(--danger-800))",
                    900: "hsl(var(--danger-900))",
                    950: "hsl(var(--danger-950))",
                    DEFAULT: "hsl(var(--danger-500))",
                },
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
                xl: "1rem",
                "2xl": "1.5rem",
            },
            spacing: {
                '18': '4.5rem',
                '88': '22rem',
                '112': '28rem',
                '128': '32rem',
            },
            fontSize: {
                'display': ['3rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
                'h1': ['2rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
                'h2': ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
                'h3': ['1.25rem', { lineHeight: '1.4' }],
            },
            boxShadow: {
                'sm-light': '0 1px 3px rgba(0, 0, 0, 0.08)',
                'md-light': '0 4px 12px rgba(0, 0, 0, 0.10)',
                'lg-light': '0 8px 24px rgba(0, 0, 0, 0.12)',
                'sm-dark': '0 1px 3px rgba(0, 0, 0, 0.30)',
                'md-dark': '0 4px 12px rgba(0, 0, 0, 0.40)',
                'lg-dark': '0 8px 24px rgba(0, 0, 0, 0.50)',
                'brand': '0 4px 16px hsl(var(--brand-glow))',
                'brand-lg': '0 8px 32px hsl(var(--brand-glow))',
                'sec': '0 4px 16px rgba(25, 181, 255, 0.20)',
            },
            transitionDuration: {
                '150': '150ms',
                '250': '250ms',
                '400': '400ms',
            },
            transitionTimingFunction: {
                'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
            },
            backdropBlur: {
                xs: '2px',
            },
            keyframes: {
                "accordion-down": {
                    from: { height: 0 },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: 0 },
                },
                "shimmer": {
                    '0%': { transform: 'translateX(-100%)' },
                    '100%': { transform: 'translateX(100%)' },
                },
                "pulse-glow": {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.7 },
                },
                "confetti": {
                    '0%': { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
                    '100%': { transform: 'translateY(100vh) rotate(360deg)', opacity: 0 },
                },
                // 🎯 SPIKE ALERTS - Maximum Drama
                "lightning-strike-green": {
                    '0%': { 
                        transform: 'translateY(-100%) translateX(50%) scale(0.3) rotateX(90deg)', 
                        opacity: 0,
                        filter: 'brightness(3) blur(10px)',
                    },
                    '30%': {
                        transform: 'translateY(-20%) translateX(10%) scale(0.9) rotateX(45deg)',
                        opacity: 1,
                        filter: 'brightness(2) blur(5px)',
                    },
                    '50%': {
                        transform: 'translateY(0) translateX(0) scale(1.05) rotateX(0deg)',
                        opacity: 1,
                        filter: 'brightness(1.5) blur(0px)',
                    },
                    '70%': {
                        transform: 'translateY(0) translateX(0) scale(0.98) rotateX(0deg)',
                        opacity: 1,
                        filter: 'brightness(1.2) blur(0px)',
                    },
                    '100%': { 
                        transform: 'translateY(0) translateX(0) scale(1) rotateX(0deg)', 
                        opacity: 1,
                        filter: 'brightness(1) blur(0px)',
                    },
                },
                "electric-charge-green": {
                    '0%, 100%': { 
                        boxShadow: '0 0 0 rgba(16, 185, 129, 0), inset 0 0 0 rgba(16, 185, 129, 0)' 
                    },
                    '20%': { 
                        boxShadow: '0 0 40px rgba(16, 185, 129, 0.8), 0 0 80px rgba(16, 185, 129, 0.4), inset 0 0 20px rgba(16, 185, 129, 0.3)' 
                    },
                    '40%': { 
                        boxShadow: '0 0 20px rgba(16, 185, 129, 0.6), 0 0 40px rgba(16, 185, 129, 0.3), inset 0 0 10px rgba(16, 185, 129, 0.2)' 
                    },
                    '60%': { 
                        boxShadow: '0 0 30px rgba(16, 185, 129, 0.7), 0 0 60px rgba(16, 185, 129, 0.35), inset 0 0 15px rgba(16, 185, 129, 0.25)' 
                    },
                },
                "meteor-impact-red": {
                    '0%': { 
                        transform: 'translate(100%, -100%) scale(0.3) rotate(45deg)', 
                        opacity: 0,
                        filter: 'brightness(3) blur(10px)',
                    },
                    '40%': {
                        transform: 'translate(20%, -20%) scale(0.9) rotate(20deg)',
                        opacity: 1,
                        filter: 'brightness(2) blur(5px)',
                    },
                    '60%': {
                        transform: 'translate(0, 0) scale(1.08) rotate(0deg)',
                        opacity: 1,
                        filter: 'brightness(1.5) blur(0px)',
                    },
                    '80%': {
                        transform: 'translate(0, 0) scale(0.96) rotate(0deg)',
                        opacity: 1,
                        filter: 'brightness(1.2) blur(0px)',
                    },
                    '100%': { 
                        transform: 'translate(0, 0) scale(1) rotate(0deg)', 
                        opacity: 1,
                        filter: 'brightness(1) blur(0px)',
                    },
                },
                "shockwave-red": {
                    '0%, 100%': { 
                        boxShadow: '0 0 0 rgba(239, 68, 68, 0), 0 0 0 rgba(239, 68, 68, 0), inset 0 0 0 rgba(239, 68, 68, 0)' 
                    },
                    '25%': { 
                        boxShadow: '0 0 50px rgba(239, 68, 68, 0.9), 0 0 100px rgba(239, 68, 68, 0.5), inset 0 0 25px rgba(239, 68, 68, 0.4)' 
                    },
                    '50%': { 
                        boxShadow: '0 0 30px rgba(239, 68, 68, 0.7), 0 0 60px rgba(239, 68, 68, 0.4), inset 0 0 15px rgba(239, 68, 68, 0.3)' 
                    },
                    '75%': { 
                        boxShadow: '0 0 40px rgba(239, 68, 68, 0.8), 0 0 80px rgba(239, 68, 68, 0.45), inset 0 0 20px rgba(239, 68, 68, 0.35)' 
                    },
                },
                // ⚡ 30M UPDATES - Medium Drama
                "quantum-shimmer-green": {
                    '0%': { 
                        transform: 'scale(0.5) rotateY(90deg)',
                        opacity: 0,
                        filter: 'blur(20px) hue-rotate(0deg)',
                    },
                    '25%': {
                        transform: 'scale(0.7) rotateY(45deg)',
                        opacity: 0.5,
                        filter: 'blur(10px) hue-rotate(90deg)',
                    },
                    '50%': {
                        transform: 'scale(0.9) rotateY(15deg)',
                        opacity: 0.8,
                        filter: 'blur(5px) hue-rotate(180deg)',
                    },
                    '75%': {
                        transform: 'scale(1.03) rotateY(-5deg)',
                        opacity: 1,
                        filter: 'blur(2px) hue-rotate(90deg)',
                    },
                    '100%': { 
                        transform: 'scale(1) rotateY(0deg)',
                        opacity: 1,
                        filter: 'blur(0px) hue-rotate(0deg)',
                    },
                },
                "energy-wave-green": {
                    '0%, 100%': { 
                        boxShadow: '0 0 0 rgba(16, 185, 129, 0), 0 0 0 rgba(16, 185, 129, 0)' 
                    },
                    '33%': { 
                        boxShadow: '0 0 25px rgba(16, 185, 129, 0.6), 0 0 50px rgba(16, 185, 129, 0.3), inset 0 0 15px rgba(16, 185, 129, 0.2)' 
                    },
                    '66%': { 
                        boxShadow: '0 0 15px rgba(16, 185, 129, 0.5), 0 0 30px rgba(16, 185, 129, 0.25), inset 0 0 10px rgba(16, 185, 129, 0.15)' 
                    },
                },
                "warning-pulse-red": {
                    '0%': { 
                        transform: 'scale(0.8)',
                        opacity: 0,
                        filter: 'brightness(2)',
                    },
                    '20%': {
                        transform: 'scale(1.1)',
                        opacity: 1,
                        filter: 'brightness(1.8)',
                    },
                    '40%': {
                        transform: 'scale(0.95)',
                        opacity: 1,
                        filter: 'brightness(1.3)',
                    },
                    '60%': {
                        transform: 'scale(1.05)',
                        opacity: 1,
                        filter: 'brightness(1.5)',
                    },
                    '80%': {
                        transform: 'scale(0.98)',
                        opacity: 1,
                        filter: 'brightness(1.2)',
                    },
                    '100%': { 
                        transform: 'scale(1)',
                        opacity: 1,
                        filter: 'brightness(1)',
                    },
                },
                "alert-beacon-red": {
                    '0%, 100%': { 
                        boxShadow: '0 0 0 rgba(239, 68, 68, 0), inset 0 0 0 rgba(239, 68, 68, 0)' 
                    },
                    '25%': { 
                        boxShadow: '0 0 30px rgba(239, 68, 68, 0.7), 0 0 60px rgba(239, 68, 68, 0.35), inset 0 0 20px rgba(239, 68, 68, 0.25)' 
                    },
                    '50%': { 
                        boxShadow: '0 0 15px rgba(239, 68, 68, 0.5), 0 0 30px rgba(239, 68, 68, 0.25), inset 0 0 10px rgba(239, 68, 68, 0.15)' 
                    },
                    '75%': { 
                        boxShadow: '0 0 25px rgba(239, 68, 68, 0.65), 0 0 50px rgba(239, 68, 68, 0.3), inset 0 0 15px rgba(239, 68, 68, 0.2)' 
                    },
                },
                // 🌅 HOURLY UPDATES - Elegant Subtlety
                "aurora-wave-green": {
                    '0%': { 
                        transform: 'translateX(-50%) scale(0.95)',
                        opacity: 0,
                        filter: 'blur(15px) saturate(0)',
                    },
                    '30%': {
                        transform: 'translateX(-10%) scale(0.98)',
                        opacity: 0.5,
                        filter: 'blur(8px) saturate(0.5)',
                    },
                    '60%': {
                        transform: 'translateX(5%) scale(1.01)',
                        opacity: 0.9,
                        filter: 'blur(3px) saturate(1.2)',
                    },
                    '100%': { 
                        transform: 'translateX(0) scale(1)',
                        opacity: 1,
                        filter: 'blur(0px) saturate(1)',
                    },
                },
                "gentle-glow-green": {
                    '0%, 100%': { 
                        boxShadow: '0 0 0 rgba(16, 185, 129, 0)' 
                    },
                    '50%': { 
                        boxShadow: '0 0 15px rgba(16, 185, 129, 0.4), 0 0 30px rgba(16, 185, 129, 0.2), inset 0 0 10px rgba(16, 185, 129, 0.1)' 
                    },
                },
                "ember-glow-red": {
                    '0%': { 
                        transform: 'translateY(-20px) scale(0.9)',
                        opacity: 0,
                        filter: 'blur(10px) brightness(2)',
                    },
                    '40%': {
                        transform: 'translateY(-5px) scale(0.97)',
                        opacity: 0.7,
                        filter: 'blur(5px) brightness(1.5)',
                    },
                    '70%': {
                        transform: 'translateY(2px) scale(1.01)',
                        opacity: 0.95,
                        filter: 'blur(2px) brightness(1.2)',
                    },
                    '100%': { 
                        transform: 'translateY(0) scale(1)',
                        opacity: 1,
                        filter: 'blur(0px) brightness(1)',
                    },
                },
                "soft-pulse-red": {
                    '0%, 100%': { 
                        boxShadow: '0 0 0 rgba(239, 68, 68, 0)' 
                    },
                    '50%': { 
                        boxShadow: '0 0 18px rgba(239, 68, 68, 0.45), 0 0 35px rgba(239, 68, 68, 0.22), inset 0 0 12px rgba(239, 68, 68, 0.12)' 
                    },
                },
                // 🔴 Badge Scale Pulse - Beautiful breathing effect for unread count
                "badge-scale-pulse": {
                    '0%, 100%': {
                        transform: 'scale(1)',
                        boxShadow: '0 0 0 rgba(239, 68, 68, 0.5)',
                    },
                    '50%': {
                        transform: 'scale(1.2)',
                        boxShadow: '0 0 20px rgba(239, 68, 68, 0.8)',
                    },
                },
                // 📜 Scroll Hint Animations - Subtle indicators for horizontal scrolling
                "bounce-subtle": {
                    '0%, 100%': {
                        transform: 'translateX(0)',
                        opacity: 0.8,
                    },
                    '50%': {
                        transform: 'translateX(-4px)',
                        opacity: 1,
                    },
                },
                "pulse-subtle": {
                    '0%, 100%': {
                        transform: 'scale(1)',
                        opacity: 1,
                    },
                    '50%': {
                        transform: 'scale(1.05)',
                        opacity: 0.9,
                    },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
                "shimmer": "shimmer 2s infinite",
                "pulse-glow": "pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                "confetti": "confetti 1s ease-out forwards",
                // 🎯 SPIKE ALERTS - Maximum Drama
                "lightning-strike-green": "lightning-strike-green 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
                "electric-charge-green": "electric-charge-green 2s ease-in-out 2",
                "meteor-impact-red": "meteor-impact-red 0.9s cubic-bezier(0.16, 1, 0.3, 1)",
                "shockwave-red": "shockwave-red 2.2s ease-in-out 2",
                // ⚡ 30M UPDATES - Medium Drama
                "quantum-shimmer-green": "quantum-shimmer-green 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)",
                "energy-wave-green": "energy-wave-green 1.8s ease-in-out 3",
                "warning-pulse-red": "warning-pulse-red 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
                "alert-beacon-red": "alert-beacon-red 2s ease-in-out 3",
                // 🌅 HOURLY UPDATES - Elegant Subtlety
                "aurora-wave-green": "aurora-wave-green 0.9s ease-out",
                "gentle-glow-green": "gentle-glow-green 2.5s ease-in-out 2",
                "ember-glow-red": "ember-glow-red 0.8s ease-out",
                "soft-pulse-red": "soft-pulse-red 2.5s ease-in-out 2",
                // 🔴 Badge Pulse - Breathing scale effect for unread notifications
                "badge-scale-pulse": "badge-scale-pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                // 📜 Scroll Hint Animations - Subtle indicators for horizontal scrolling
                "bounce-subtle": "bounce-subtle 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                "pulse-subtle": "pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
}

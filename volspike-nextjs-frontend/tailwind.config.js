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
                "slide-in-right": {
                    '0%': { 
                        transform: 'translateX(100%) scale(0.95)', 
                        opacity: 0 
                    },
                    '60%': { 
                        transform: 'translateX(-2%) scale(1.01)', 
                        opacity: 1 
                    },
                    '100%': { 
                        transform: 'translateX(0) scale(1)', 
                        opacity: 1 
                    },
                },
                "fade-in": {
                    '0%': { 
                        opacity: 0,
                        transform: 'translateY(-5px)'
                    },
                    '100%': { 
                        opacity: 1,
                        transform: 'translateY(0)'
                    },
                },
                "scale-in": {
                    '0%': { 
                        transform: 'scale(0.98) translateY(-10px)', 
                        opacity: 0 
                    },
                    '100%': { 
                        transform: 'scale(1) translateY(0)', 
                        opacity: 1 
                    },
                },
                "glow-pulse-green": {
                    '0%, 100%': { 
                        boxShadow: '0 0 0 rgba(16, 185, 129, 0)' 
                    },
                    '50%': { 
                        boxShadow: '0 0 20px rgba(16, 185, 129, 0.5), 0 0 40px rgba(16, 185, 129, 0.3)' 
                    },
                },
                "glow-pulse-red": {
                    '0%, 100%': { 
                        boxShadow: '0 0 0 rgba(239, 68, 68, 0)' 
                    },
                    '50%': { 
                        boxShadow: '0 0 20px rgba(239, 68, 68, 0.5), 0 0 40px rgba(239, 68, 68, 0.3)' 
                    },
                },
                "confetti": {
                    '0%': { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
                    '100%': { transform: 'translateY(100vh) rotate(360deg)', opacity: 0 },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
                "shimmer": "shimmer 2s infinite",
                "pulse-glow": "pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                "slide-in-right": "slide-in-right 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
                "fade-in": "fade-in 0.3s ease-out",
                "scale-in": "scale-in 0.4s ease-out",
                "glow-pulse-green": "glow-pulse-green 1.5s ease-in-out 3",
                "glow-pulse-red": "glow-pulse-red 1.5s ease-in-out 3",
                "confetti": "confetti 1s ease-out forwards",
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
}

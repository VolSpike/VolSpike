/**
 * Animation variants for different alert types
 * Used with Framer Motion for smooth, professional animations
 */

export const alertAnimations = {
  // New Volume Spike: Exciting slide-in from right with pulse
  spike: {
    initial: { 
      opacity: 0, 
      x: 100, 
      scale: 0.9,
    },
    animate: { 
      opacity: 1, 
      x: 0, 
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 25,
        duration: 0.4,
      }
    },
    glow: {
      boxShadow: [
        '0 0 0px rgba(16, 185, 129, 0)',
        '0 0 20px rgba(16, 185, 129, 0.4)',
        '0 0 0px rgba(16, 185, 129, 0)',
      ],
      transition: {
        duration: 1.5,
        repeat: 2,
        ease: 'easeInOut',
      }
    }
  },

  // 30m Update: Gentle fade with scale
  half_update: {
    initial: { 
      opacity: 0, 
      scale: 0.95,
      y: -20,
    },
    animate: { 
      opacity: 1, 
      scale: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 200,
        damping: 20,
        duration: 0.3,
      }
    },
    pulse: {
      scale: [1, 1.02, 1],
      transition: {
        duration: 0.5,
        ease: 'easeInOut',
      }
    }
  },

  // Hourly Update: Slide from top with subtle highlight
  full_update: {
    initial: { 
      opacity: 0, 
      y: -30,
      scale: 0.98,
    },
    animate: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 250,
        damping: 22,
        duration: 0.35,
      }
    },
    highlight: {
      backgroundColor: [
        'rgba(59, 130, 246, 0)',
        'rgba(59, 130, 246, 0.1)',
        'rgba(59, 130, 246, 0)',
      ],
      transition: {
        duration: 1,
        ease: 'easeInOut',
      }
    }
  },
}

// CSS classes for animation (fallback if Framer Motion not used)
export const alertAnimationClasses = {
  spike: 'animate-slide-in-right',
  half_update: 'animate-scale-in',
  full_update: 'animate-fade-in',
}


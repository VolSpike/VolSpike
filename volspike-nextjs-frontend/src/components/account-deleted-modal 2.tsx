'use client'

import { useEffect } from 'react'
import { X, AlertTriangle, Ban, UserX } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { UserDeletionEvent } from '@/hooks/use-user-deletion-listener'

interface AccountDeletedModalProps {
  event: UserDeletionEvent
  onClose: () => void
}

export function AccountDeletedModal({ event, onClose }: AccountDeletedModalProps) {
  const getIcon = () => {
    switch (event.reason) {
      case 'deleted':
        return <UserX className="h-12 w-12 text-red-500" />
      case 'banned':
        return <Ban className="h-12 w-12 text-orange-500" />
      case 'suspended':
        return <AlertTriangle className="h-12 w-12 text-yellow-500" />
      default:
        return <AlertTriangle className="h-12 w-12 text-gray-500" />
    }
  }

  const getTitle = () => {
    switch (event.reason) {
      case 'deleted':
        return 'Account Deleted'
      case 'banned':
        return 'Account Banned'
      case 'suspended':
        return 'Account Suspended'
      default:
        return 'Account Status Changed'
    }
  }

  const getColorScheme = () => {
    switch (event.reason) {
      case 'deleted':
        return {
          bg: 'bg-red-50 dark:bg-red-950/20',
          border: 'border-red-200 dark:border-red-800',
          text: 'text-red-900 dark:text-red-100',
          accent: 'text-red-600 dark:text-red-400'
        }
      case 'banned':
        return {
          bg: 'bg-orange-50 dark:bg-orange-950/20',
          border: 'border-orange-200 dark:border-orange-800',
          text: 'text-orange-900 dark:text-orange-100',
          accent: 'text-orange-600 dark:text-orange-400'
        }
      case 'suspended':
        return {
          bg: 'bg-yellow-50 dark:bg-yellow-950/20',
          border: 'border-yellow-200 dark:border-yellow-800',
          text: 'text-yellow-900 dark:text-yellow-100',
          accent: 'text-yellow-600 dark:text-yellow-400'
        }
      default:
        return {
          bg: 'bg-gray-50 dark:bg-gray-900/50',
          border: 'border-gray-200 dark:border-gray-800',
          text: 'text-gray-900 dark:text-gray-100',
          accent: 'text-gray-600 dark:text-gray-400'
        }
    }
  }

  const colors = getColorScheme()

  // Auto-close after showing for 2 seconds (logout will happen anyway)
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, 2000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={`relative w-full max-w-md ${colors.bg} ${colors.border} border-2 rounded-2xl shadow-2xl overflow-hidden`}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Content */}
          <div className="p-8">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', damping: 15 }}
                className="p-4 rounded-full bg-white dark:bg-gray-800 shadow-lg"
              >
                {getIcon()}
              </motion.div>
            </div>

            {/* Title */}
            <motion.h2
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`text-2xl font-bold text-center mb-4 ${colors.text}`}
            >
              {getTitle()}
            </motion.h2>

            {/* Message */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className={`text-center mb-6 ${colors.text} leading-relaxed`}
            >
              {event.message}
            </motion.p>

            {/* Additional info */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className={`text-sm text-center ${colors.accent} mb-6`}
            >
              You will be logged out automatically...
            </motion.div>

            {/* Loading indicator */}
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 2, ease: 'linear' }}
              className={`h-1 ${colors.accent.replace('text-', 'bg-')} rounded-full`}
            />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}


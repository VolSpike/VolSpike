'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface PasswordInputProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoComplete?: string
  showStrength?: boolean
  showRules?: boolean
  className?: string
  error?: string
  required?: boolean
}

function passwordStrength(pw: string): number {
  let score = 0
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score
}

function getPasswordStrengthLabel(score: number): { text: string; color: string } {
  switch (score) {
    case 0:
    case 1:
      return { text: 'Weak', color: 'text-red-400' }
    case 2:
      return { text: 'Fair', color: 'text-yellow-400' }
    case 3:
      return { text: 'Good', color: 'text-blue-400' }
    case 4:
      return { text: 'Strong', color: 'text-green-400' }
    default:
      return { text: '', color: '' }
  }
}

export function PasswordInput({
  id,
  label,
  value,
  onChange,
  placeholder = '••••••••',
  autoComplete,
  showStrength = false,
  showRules = false,
  className = '',
  error,
  required = false,
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false)
  const pwStrength = passwordStrength(value || '')
  const pwStrengthLabel = getPasswordStrengthLabel(pwStrength)

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`bg-background pr-10 ${className}`}
          required={required}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>

      {/* Password strength indicator */}
      {showStrength && value && (
        <div className="space-y-1">
          <div className="flex gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  pwStrength > i
                    ? i === 0
                      ? 'bg-red-400'
                      : i === 1
                        ? 'bg-yellow-400'
                        : i === 2
                          ? 'bg-blue-400'
                          : 'bg-green-400'
                    : 'bg-muted'
                }`}
              />
            ))}
          </div>
          <p className={`text-xs font-medium ${pwStrengthLabel.color}`}>
            Password strength: {pwStrengthLabel.text}
          </p>
        </div>
      )}

      {/* Password complexity rules */}
      {showRules && (
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium">Password must contain:</p>
          <ul className="space-y-0.5 ml-4">
            <li className={value?.length >= 12 ? 'text-green-500 dark:text-green-400' : ''}>
              ✓ At least 12 characters
            </li>
            <li className={/[A-Z]/.test(value || '') ? 'text-green-500 dark:text-green-400' : ''}>
              ✓ One uppercase letter
            </li>
            <li className={/[0-9]/.test(value || '') ? 'text-green-500 dark:text-green-400' : ''}>
              ✓ One number
            </li>
            <li className={/[^A-Za-z0-9]/.test(value || '') ? 'text-green-500 dark:text-green-400' : ''}>
              ✓ One special character
            </li>
          </ul>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </p>
      )}
    </div>
  )
}


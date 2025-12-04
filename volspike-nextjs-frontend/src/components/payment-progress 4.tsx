'use client'

import { Check, Clock, QrCode } from 'lucide-react'
import { cn } from '@/lib/utils'

type ProgressStage = 'scan' | 'confirm' | 'upgrade' | 'expired'

interface PaymentProgressProps {
    status?: string | null
    isExpired?: boolean
}

function deriveStage(status?: string | null, isExpired?: boolean): ProgressStage {
    if (isExpired) return 'expired'
    if (!status) return 'scan'

    const normalized = status.toLowerCase()

    if (normalized === 'finished' || normalized === 'confirmed') {
        return 'upgrade'
    }

    if (
        normalized === 'confirming' ||
        normalized === 'sending' ||
        normalized === 'partially_paid' ||
        normalized === 'waiting' ||
        normalized === 'waiting_for_confirmations'
    ) {
        return 'confirm'
    }

    return 'scan'
}

export function PaymentProgress({ status, isExpired }: PaymentProgressProps) {
    const stage = deriveStage(status, isExpired)

    const steps: Array<{
        id: ProgressStage
        label: string
        description: string
    }> = [
        {
            id: 'scan',
            label: 'Scan QR',
            description: 'Open Phantom and scan',
        },
        {
            id: 'confirm',
            label: 'Confirm',
            description: 'Approve in your wallet',
        },
        {
            id: 'upgrade',
            label: 'Upgrade',
            description: 'Tier unlocks on-chain',
        },
    ]

    const isCompleted = (id: ProgressStage) => {
        if (stage === 'expired') return false
        if (id === 'scan') return stage === 'confirm' || stage === 'upgrade'
        if (id === 'confirm') return stage === 'upgrade'
        if (id === 'upgrade') return stage === 'upgrade'
        return false
    }

    const isActive = (id: ProgressStage) => stage === id

    const getIcon = (id: ProgressStage, completed: boolean, active: boolean) => {
        const baseClasses = 'h-3.5 w-3.5'
        if (completed) {
            return <Check className={cn(baseClasses, 'text-emerald-400')} />
        }
        if (id === 'scan') {
            return <QrCode className={cn(baseClasses, active ? 'text-sec-400' : 'text-muted-foreground')} />
        }
        if (id === 'confirm') {
            return <Clock className={cn(baseClasses, active ? 'text-sec-400' : 'text-muted-foreground')} />
        }
        return <Check className={cn(baseClasses, active ? 'text-sec-400' : 'text-muted-foreground')} />
    }

    return (
        <div className="mb-5 rounded-xl border border-border/60 bg-muted/15 px-3 py-2.5 text-xs sm:px-4 sm:py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Payment progress
                    </span>
                    {stage === 'expired' && (
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                            Window expired
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Updates in real time</span>
                </div>
            </div>
            <div className="mt-2 flex items-center gap-2 sm:gap-3">
                {steps.map((step, index) => {
                    const completed = isCompleted(step.id)
                    const active = isActive(step.id)
                    const last = index === steps.length - 1

                    return (
                        <div key={step.id} className="flex flex-1 items-center gap-2">
                            <div className="flex items-center gap-2">
                                <div
                                    className={cn(
                                        'flex h-6 w-6 items-center justify-center rounded-full border text-[11px]',
                                        completed && 'border-emerald-400 bg-emerald-500/10',
                                        active && !completed && 'border-sec-400 bg-sec-500/10',
                                        !completed && !active && 'border-border/80 bg-background/80'
                                    )}
                                >
                                    {getIcon(step.id, completed, active)}
                                </div>
                                <div className="hidden min-w-0 sm:block">
                                    <p
                                        className={cn(
                                            'truncate text-[12px] font-medium',
                                            completed && 'text-emerald-400',
                                            active && !completed && 'text-sec-300',
                                            !completed && !active && 'text-muted-foreground'
                                        )}
                                    >
                                        {step.label}
                                    </p>
                                    <p className="truncate text-[11px] text-muted-foreground/80">
                                        {step.description}
                                    </p>
                                </div>
                            </div>
                            {!last && (
                                <div className="flex-1">
                                    <div
                                        className={cn(
                                            'h-px w-full rounded-full bg-border/70',
                                            completed && 'bg-gradient-to-r from-emerald-400/70 via-emerald-400/40 to-border/60',
                                            active && !completed && 'bg-gradient-to-r from-sec-400/70 via-sec-400/40 to-border/60'
                                        )}
                                    />
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}


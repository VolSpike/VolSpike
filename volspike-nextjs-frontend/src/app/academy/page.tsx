export const dynamic = 'force-dynamic'
export const revalidate = 0

import { Header } from '@/components/header'
import { BackgroundPattern } from '@/components/ui/background-pattern'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { GraduationCap, BookOpen, Video, Award, Sparkles } from 'lucide-react'

export default function AcademyPage() {
    return (
        <div className="min-h-screen flex flex-col bg-background">
            <BackgroundPattern />

            {/* Vibrant multi-layered gradient overlays */}
            <div className="absolute inset-0 bg-gradient-to-br from-brand-500/8 via-secondary-500/5 to-tertiary-500/6 dark:from-brand-500/12 dark:via-secondary-500/8 dark:to-tertiary-500/10 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-brand-500/3 to-transparent dark:via-brand-500/6 pointer-events-none animate-pulse-glow" />

            <Header />

            <main className="flex-1 container mx-auto px-4 py-12 relative z-10">
                <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
                    {/* Hero Section */}
                    <div className="text-center space-y-4">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500/20 to-sec-500/20 border border-brand-500/30 mb-4">
                            <GraduationCap className="w-10 h-10 text-brand-600 dark:text-brand-400" />
                        </div>

                        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight bg-gradient-to-br from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent">
                            VolSpike Academy
                        </h1>

                        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
                            Master crypto trading with expert-led courses, tutorials, and strategies
                        </p>
                    </div>

                    {/* Coming Soon Card */}
                    <Card className="border-2 border-brand-500/30 bg-gradient-to-br from-brand-500/5 to-sec-500/5 shadow-xl">
                        <CardHeader className="text-center pb-4">
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <Sparkles className="w-5 h-5 text-brand-600 dark:text-brand-400 animate-pulse" />
                                <CardTitle className="text-2xl sm:text-3xl bg-gradient-to-r from-brand-600 to-sec-600 dark:from-brand-400 dark:to-sec-400 bg-clip-text text-transparent">
                                    Coming Soon
                                </CardTitle>
                                <Sparkles className="w-5 h-5 text-brand-600 dark:text-brand-400 animate-pulse" />
                            </div>
                            <CardDescription className="text-base">
                                We're building something special for you
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <p className="text-center text-muted-foreground">
                                The VolSpike Academy is currently under development. Soon you'll have access to:
                            </p>

                            {/* Feature Grid */}
                            <div className="grid sm:grid-cols-2 gap-4 mt-6">
                                <div className="flex items-start gap-3 p-4 rounded-lg bg-background/50 border border-border/50">
                                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center">
                                        <BookOpen className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold mb-1">Expert Courses</h3>
                                        <p className="text-sm text-muted-foreground">
                                            Comprehensive trading courses from beginner to advanced
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 p-4 rounded-lg bg-background/50 border border-border/50">
                                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-sec-500/10 flex items-center justify-center">
                                        <Video className="w-5 h-5 text-sec-600 dark:text-sec-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold mb-1">Video Tutorials</h3>
                                        <p className="text-sm text-muted-foreground">
                                            Step-by-step guides on using VolSpike features
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 p-4 rounded-lg bg-background/50 border border-border/50">
                                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-tertiary-500/10 flex items-center justify-center">
                                        <Award className="w-5 h-5 text-tertiary-600 dark:text-tertiary-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold mb-1">Trading Strategies</h3>
                                        <p className="text-sm text-muted-foreground">
                                            Proven strategies for volume spike trading
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 p-4 rounded-lg bg-background/50 border border-border/50">
                                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-elite-500/10 flex items-center justify-center">
                                        <Sparkles className="w-5 h-5 text-elite-600 dark:text-elite-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold mb-1">Live Workshops</h3>
                                        <p className="text-sm text-muted-foreground">
                                            Interactive sessions with trading experts
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* CTA Section */}
                            <div className="mt-8 p-6 rounded-lg bg-gradient-to-r from-brand-500/10 to-sec-500/10 border border-brand-500/20 text-center">
                                <p className="text-sm text-muted-foreground mb-3">
                                    Want to be notified when we launch?
                                </p>
                                <a
                                    href="/auth?tab=signup"
                                    className="inline-flex items-center justify-center px-6 py-3 text-sm font-medium rounded-lg bg-gradient-to-r from-brand-600 to-sec-600 hover:from-brand-700 hover:to-sec-700 text-white shadow-lg shadow-brand-500/20 ring-1 ring-brand-500/20 transition-all duration-200"
                                >
                                    <GraduationCap className="w-4 h-4 mr-2" />
                                    Join VolSpike Today
                                </a>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Additional Info */}
                    <div className="text-center text-sm text-muted-foreground">
                        <p>
                            In the meantime, explore our{' '}
                            <a href="/dashboard" className="text-brand-600 dark:text-brand-400 hover:underline font-medium">
                                Dashboard
                            </a>
                            {' '}to start tracking volume spikes and market opportunities
                        </p>
                    </div>
                </div>
            </main>
        </div>
    )
}

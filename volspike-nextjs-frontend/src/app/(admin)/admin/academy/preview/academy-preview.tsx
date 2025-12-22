'use client'

import { useEffect, useState, useCallback } from 'react'
import { adminAPI } from '@/lib/admin/api-client'
import {
    BookOpen,
    Loader2,
    GraduationCap,
    ChevronRight,
    ChevronLeft,
    Clock,
    CheckCircle2,
    Lock,
    Play,
    ArrowLeft,
    Home,
    Menu,
    X,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface LearningPath {
    id: string
    title: string
    slug: string
    description: string
    difficulty: string
    order: number
    isPublished: boolean
    introduction?: string
    whatYoullLearn: string[]
    modules: Module[]
}

interface Module {
    id: string
    title: string
    slug: string
    description: string
    order: number
    introduction?: string
    lessons: Lesson[]
}

interface Lesson {
    id: string
    title: string
    slug: string
    order: number
    isFree: boolean
    difficulty: string
    summary?: string
    content?: string
    transformedContent?: string
    lessonIntro?: string
    lessonSummary?: string
    topics: string[]
    keyTakeaways?: string[]
    quizQuestions?: QuizQuestion[]
}

interface QuizQuestion {
    id: string
    question: string
    options: string[]
    correctAnswer: string
    explanation?: string
    order: number
}

type View = 'home' | 'path' | 'lesson'

interface AcademyPreviewProps {
    accessToken: string
}

export function AcademyPreview({ accessToken }: AcademyPreviewProps) {
    const [paths, setPaths] = useState<LearningPath[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [view, setView] = useState<View>('home')
    const [selectedPath, setSelectedPath] = useState<LearningPath | null>(null)
    const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null)
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({})
    const [quizSubmitted, setQuizSubmitted] = useState(false)

    const fetchData = useCallback(async () => {
        try {
            adminAPI.setAccessToken(accessToken)
            const { paths: pathsData } = await adminAPI.getAcademyPaths()
            setPaths(pathsData)
        } catch (err: any) {
            setError(err.message || 'Failed to load academy data')
        } finally {
            setLoading(false)
        }
    }, [accessToken])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const selectPath = (path: LearningPath) => {
        setSelectedPath(path)
        setSelectedLesson(null)
        setView('path')
    }

    const selectLesson = async (lessonId: string) => {
        try {
            adminAPI.setAccessToken(accessToken)
            const { lesson } = await adminAPI.getAcademyLesson(lessonId)
            setSelectedLesson(lesson)
            setView('lesson')
            setQuizAnswers({})
            setQuizSubmitted(false)
        } catch (err: any) {
            setError(err.message || 'Failed to load lesson')
        }
    }

    const goHome = () => {
        setView('home')
        setSelectedPath(null)
        setSelectedLesson(null)
    }

    const goToPath = () => {
        setView('path')
        setSelectedLesson(null)
    }

    const handleQuizAnswer = (questionId: string, answer: string) => {
        if (!quizSubmitted) {
            setQuizAnswers(prev => ({ ...prev, [questionId]: answer }))
        }
    }

    const submitQuiz = () => {
        setQuizSubmitted(true)
    }

    const getQuizScore = () => {
        if (!selectedLesson?.quizQuestions) return { correct: 0, total: 0 }
        let correct = 0
        for (const q of selectedLesson.quizQuestions) {
            if (quizAnswers[q.id] === q.correctAnswer) {
                correct++
            }
        }
        return { correct, total: selectedLesson.quizQuestions.length }
    }

    // Find next/previous lesson
    const getAdjacentLessons = () => {
        if (!selectedPath || !selectedLesson) return { prev: null, next: null }

        const allLessons: { lesson: Lesson; parentModule: Module }[] = []
        for (const mod of selectedPath.modules) {
            for (const les of mod.lessons) {
                allLessons.push({ lesson: les, parentModule: mod })
            }
        }

        const currentIndex = allLessons.findIndex(l => l.lesson.id === selectedLesson.id)
        return {
            prev: currentIndex > 0 ? allLessons[currentIndex - 1] : null,
            next: currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null,
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="flex flex-col items-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <p className="text-muted-foreground">Loading Academy...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center text-red-500">{error}</div>
            </div>
        )
    }

    // HOME VIEW - All Learning Paths
    if (view === 'home') {
        return (
            <div className="min-h-screen bg-gradient-to-b from-background to-accent/20">
                {/* Admin Preview Banner */}
                <div className="bg-yellow-500/10 border-b border-yellow-500/30 px-4 py-2">
                    <div className="max-w-6xl mx-auto flex items-center justify-between">
                        <span className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
                            Admin Preview Mode - This is how users will see the Academy
                        </span>
                        <a href="/admin/academy" className="text-sm text-yellow-600 dark:text-yellow-400 hover:underline">
                            Back to Admin
                        </a>
                    </div>
                </div>

                {/* Header */}
                <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
                    <div className="max-w-6xl mx-auto px-4 py-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                                <GraduationCap className="h-6 w-6 text-blue-500" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold">VolSpike Academy</h1>
                                <p className="text-sm text-muted-foreground">Master the art of trading</p>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Hero Section */}
                <div className="max-w-6xl mx-auto px-4 py-12">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">
                            Learn Trading from the Experts
                        </h2>
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                            Comprehensive courses covering everything from trading psychology to advanced market structure analysis.
                        </p>
                    </div>

                    {/* Learning Paths Grid */}
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {paths.map(path => {
                            const totalLessons = path.modules.reduce((sum, m) => sum + m.lessons.length, 0)
                            return (
                                <div
                                    key={path.id}
                                    onClick={() => selectPath(path)}
                                    className="group cursor-pointer rounded-2xl border border-border bg-card hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300"
                                >
                                    <div className="p-6">
                                        {/* Difficulty Badge */}
                                        <div className="flex items-center justify-between mb-4">
                                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                                                path.difficulty === 'beginner'
                                                    ? 'bg-green-500/10 text-green-500'
                                                    : path.difficulty === 'intermediate'
                                                    ? 'bg-yellow-500/10 text-yellow-500'
                                                    : 'bg-red-500/10 text-red-500'
                                            }`}>
                                                {path.difficulty.charAt(0).toUpperCase() + path.difficulty.slice(1)}
                                            </span>
                                            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-blue-500 transition-colors" />
                                        </div>

                                        {/* Title & Description */}
                                        <h3 className="text-lg font-semibold mb-2 group-hover:text-blue-500 transition-colors">
                                            {path.title}
                                        </h3>
                                        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                                            {path.description}
                                        </p>

                                        {/* Stats */}
                                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                            <div className="flex items-center gap-1.5">
                                                <BookOpen className="h-4 w-4" />
                                                <span>{path.modules.length} modules</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Play className="h-4 w-4" />
                                                <span>{totalLessons} lessons</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        )
    }

    // PATH VIEW - Single Learning Path
    if (view === 'path' && selectedPath) {
        const totalLessons = selectedPath.modules.reduce((sum, m) => sum + m.lessons.length, 0)

        return (
            <div className="min-h-screen bg-background">
                {/* Admin Preview Banner */}
                <div className="bg-yellow-500/10 border-b border-yellow-500/30 px-4 py-2">
                    <div className="max-w-6xl mx-auto flex items-center justify-between">
                        <span className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
                            Admin Preview Mode
                        </span>
                        <a href="/admin/academy" className="text-sm text-yellow-600 dark:text-yellow-400 hover:underline">
                            Back to Admin
                        </a>
                    </div>
                </div>

                {/* Header */}
                <header className="border-b border-border bg-background sticky top-0 z-10">
                    <div className="max-w-6xl mx-auto px-4 py-4">
                        <button onClick={goHome} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                            <ArrowLeft className="h-4 w-4" />
                            <span>All Courses</span>
                        </button>
                    </div>
                </header>

                {/* Path Header */}
                <div className="bg-gradient-to-b from-accent/50 to-background border-b border-border">
                    <div className="max-w-6xl mx-auto px-4 py-12">
                        <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full mb-4 ${
                            selectedPath.difficulty === 'beginner'
                                ? 'bg-green-500/10 text-green-500'
                                : selectedPath.difficulty === 'intermediate'
                                ? 'bg-yellow-500/10 text-yellow-500'
                                : 'bg-red-500/10 text-red-500'
                        }`}>
                            {selectedPath.difficulty.charAt(0).toUpperCase() + selectedPath.difficulty.slice(1)}
                        </span>
                        <h1 className="text-3xl font-bold mb-4">{selectedPath.title}</h1>
                        <p className="text-lg text-muted-foreground max-w-3xl mb-6">
                            {selectedPath.description}
                        </p>
                        <div className="flex items-center gap-6 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <BookOpen className="h-4 w-4" />
                                <span>{selectedPath.modules.length} modules</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Play className="h-4 w-4" />
                                <span>{totalLessons} lessons</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Path Introduction */}
                {selectedPath.introduction && (
                    <div className="max-w-6xl mx-auto px-4 py-8">
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                            <p className="text-muted-foreground leading-relaxed">
                                {selectedPath.introduction}
                            </p>
                        </div>
                    </div>
                )}

                {/* What You'll Learn */}
                {selectedPath.whatYoullLearn && selectedPath.whatYoullLearn.length > 0 && (
                    <div className="max-w-6xl mx-auto px-4 pb-8">
                        <h2 className="text-xl font-semibold mb-4">What you&apos;ll learn</h2>
                        <div className="grid md:grid-cols-2 gap-3">
                            {selectedPath.whatYoullLearn.map((item, i) => (
                                <div key={i} className="flex items-start gap-3">
                                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                                    <span className="text-sm">{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Modules */}
                <div className="max-w-6xl mx-auto px-4 py-8">
                    <h2 className="text-xl font-semibold mb-6">Course Content</h2>
                    <div className="space-y-4">
                        {selectedPath.modules.map((module, moduleIndex) => (
                            <div key={module.id} className="border border-border rounded-xl overflow-hidden">
                                <div className="bg-accent/30 px-4 py-3 border-b border-border">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-medium">
                                            Module {moduleIndex + 1}: {module.title}
                                        </h3>
                                        <span className="text-sm text-muted-foreground">
                                            {module.lessons.length} lessons
                                        </span>
                                    </div>
                                    {module.introduction && (
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {module.introduction}
                                        </p>
                                    )}
                                </div>
                                <div className="divide-y divide-border">
                                    {module.lessons.map((lesson, lessonIndex) => (
                                        <div
                                            key={lesson.id}
                                            onClick={() => selectLesson(lesson.id)}
                                            className="flex items-center gap-4 px-4 py-3 hover:bg-accent/30 cursor-pointer transition-colors"
                                        >
                                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent text-sm font-medium">
                                                {lessonIndex + 1}
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-medium text-sm">{lesson.title}</h4>
                                            </div>
                                            {lesson.isFree ? (
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">
                                                    Free
                                                </span>
                                            ) : (
                                                <Lock className="h-4 w-4 text-muted-foreground" />
                                            )}
                                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    // LESSON VIEW
    if (view === 'lesson' && selectedLesson && selectedPath) {
        const { prev, next } = getAdjacentLessons()
        const quizScore = getQuizScore()

        return (
            <div className="min-h-screen bg-background flex">
                {/* Admin Preview Banner - Full Width */}
                <div className="fixed top-0 left-0 right-0 bg-yellow-500/10 border-b border-yellow-500/30 px-4 py-2 z-50">
                    <div className="flex items-center justify-between max-w-[1800px] mx-auto">
                        <span className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
                            Admin Preview Mode
                        </span>
                        <a href="/admin/academy" className="text-sm text-yellow-600 dark:text-yellow-400 hover:underline">
                            Back to Admin
                        </a>
                    </div>
                </div>

                {/* Sidebar */}
                <aside className={`fixed left-0 top-[41px] bottom-0 w-72 border-r border-border bg-card z-40 transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
                    <div className="flex flex-col h-full">
                        {/* Sidebar Header */}
                        <div className="p-4 border-b border-border">
                            <button onClick={goToPath} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                                <ArrowLeft className="h-4 w-4" />
                                <span>Back to Course</span>
                            </button>
                            <h2 className="font-semibold mt-3 line-clamp-2">{selectedPath.title}</h2>
                        </div>

                        {/* Lesson Navigation */}
                        <div className="flex-1 overflow-auto p-4">
                            {selectedPath.modules.map((module, moduleIndex) => (
                                <div key={module.id} className="mb-4">
                                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                                        Module {moduleIndex + 1}
                                    </h3>
                                    <div className="space-y-1">
                                        {module.lessons.map((lessonItem) => (
                                            <button
                                                key={lessonItem.id}
                                                onClick={() => selectLesson(lessonItem.id)}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                                                    selectedLesson.id === lessonItem.id
                                                        ? 'bg-blue-500/10 text-blue-500 font-medium'
                                                        : 'hover:bg-accent text-muted-foreground hover:text-foreground'
                                                }`}
                                            >
                                                {lessonItem.title}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>

                {/* Mobile Sidebar Toggle */}
                <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="fixed bottom-4 left-4 z-50 lg:hidden p-3 rounded-full bg-blue-500 text-white shadow-lg"
                >
                    {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>

                {/* Main Content */}
                <main className="flex-1 lg:ml-72 pt-[41px]">
                    <div className="max-w-4xl mx-auto px-4 py-8">
                        {/* Lesson Header */}
                        <div className="mb-8">
                            <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full mb-3 ${
                                selectedLesson.difficulty === 'beginner'
                                    ? 'bg-green-500/10 text-green-500'
                                    : selectedLesson.difficulty === 'intermediate'
                                    ? 'bg-yellow-500/10 text-yellow-500'
                                    : 'bg-red-500/10 text-red-500'
                            }`}>
                                {selectedLesson.difficulty.charAt(0).toUpperCase() + selectedLesson.difficulty.slice(1)}
                            </span>
                            <h1 className="text-2xl md:text-3xl font-bold mb-4">{selectedLesson.title}</h1>

                            {/* Topics */}
                            {selectedLesson.topics && selectedLesson.topics.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {selectedLesson.topics.map((topic, i) => (
                                        <span key={i} className="text-xs px-2 py-1 rounded-full bg-accent">
                                            {topic}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Introduction */}
                            {selectedLesson.lessonIntro && (
                                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                                    <p className="text-muted-foreground">{selectedLesson.lessonIntro}</p>
                                </div>
                            )}
                        </div>

                        {/* Lesson Content */}
                        <article className="prose prose-sm dark:prose-invert max-w-none mb-12">
                            <ReactMarkdown>
                                {selectedLesson.transformedContent || selectedLesson.content || ''}
                            </ReactMarkdown>
                        </article>

                        {/* Key Takeaways */}
                        {selectedLesson.keyTakeaways && selectedLesson.keyTakeaways.length > 0 && (
                            <div className="mb-12 p-6 rounded-xl bg-accent/50 border border-border">
                                <h2 className="text-lg font-semibold mb-4">Key Takeaways</h2>
                                <ul className="space-y-2">
                                    {selectedLesson.keyTakeaways.map((takeaway, i) => (
                                        <li key={i} className="flex items-start gap-3">
                                            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                                            <span className="text-sm">{takeaway}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Quiz Section */}
                        {selectedLesson.quizQuestions && selectedLesson.quizQuestions.length > 0 && (
                            <div className="mb-12">
                                <h2 className="text-xl font-semibold mb-6">Test Your Knowledge</h2>

                                {quizSubmitted && (
                                    <div className={`mb-6 p-4 rounded-xl ${
                                        quizScore.correct === quizScore.total
                                            ? 'bg-green-500/10 border border-green-500/30'
                                            : quizScore.correct >= quizScore.total / 2
                                            ? 'bg-yellow-500/10 border border-yellow-500/30'
                                            : 'bg-red-500/10 border border-red-500/30'
                                    }`}>
                                        <div className="flex items-center gap-3">
                                            <CheckCircle2 className={`h-6 w-6 ${
                                                quizScore.correct === quizScore.total ? 'text-green-500' : 'text-yellow-500'
                                            }`} />
                                            <div>
                                                <p className="font-medium">
                                                    You scored {quizScore.correct} out of {quizScore.total}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {quizScore.correct === quizScore.total
                                                        ? 'Excellent work!'
                                                        : 'Review the explanations below to improve.'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-6">
                                    {selectedLesson.quizQuestions.map((q, qIndex) => {
                                        const isCorrect = quizAnswers[q.id] === q.correctAnswer
                                        const showResult = quizSubmitted

                                        return (
                                            <div key={q.id} className="border border-border rounded-xl p-5">
                                                <p className="font-medium mb-4">
                                                    {qIndex + 1}. {q.question}
                                                </p>
                                                <div className="space-y-2">
                                                    {q.options.map((option, oIndex) => {
                                                        const optionLetter = option.charAt(0)
                                                        const isSelected = quizAnswers[q.id] === optionLetter
                                                        const isCorrectOption = optionLetter === q.correctAnswer

                                                        let optionClass = 'border-border hover:border-blue-500/50 hover:bg-blue-500/5'
                                                        if (showResult) {
                                                            if (isCorrectOption) {
                                                                optionClass = 'border-green-500 bg-green-500/10'
                                                            } else if (isSelected && !isCorrectOption) {
                                                                optionClass = 'border-red-500 bg-red-500/10'
                                                            }
                                                        } else if (isSelected) {
                                                            optionClass = 'border-blue-500 bg-blue-500/10'
                                                        }

                                                        return (
                                                            <button
                                                                key={oIndex}
                                                                onClick={() => handleQuizAnswer(q.id, optionLetter)}
                                                                disabled={quizSubmitted}
                                                                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${optionClass}`}
                                                            >
                                                                {option}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                                {showResult && q.explanation && (
                                                    <div className="mt-4 p-3 rounded-lg bg-accent/50 text-sm text-muted-foreground">
                                                        <strong>Explanation:</strong> {q.explanation}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>

                                {!quizSubmitted && (
                                    <button
                                        onClick={submitQuiz}
                                        disabled={Object.keys(quizAnswers).length !== selectedLesson.quizQuestions.length}
                                        className="mt-6 px-6 py-3 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Submit Answers
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Navigation */}
                        <div className="flex items-center justify-between pt-8 border-t border-border">
                            {prev ? (
                                <button
                                    onClick={() => selectLesson(prev.lesson.id)}
                                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                    <div className="text-left">
                                        <p className="text-xs text-muted-foreground">Previous</p>
                                        <p className="text-sm font-medium">{prev.lesson.title}</p>
                                    </div>
                                </button>
                            ) : <div />}

                            {next ? (
                                <button
                                    onClick={() => selectLesson(next.lesson.id)}
                                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <div className="text-right">
                                        <p className="text-xs text-muted-foreground">Next</p>
                                        <p className="text-sm font-medium">{next.lesson.title}</p>
                                    </div>
                                    <ChevronRight className="h-5 w-5" />
                                </button>
                            ) : <div />}
                        </div>
                    </div>
                </main>
            </div>
        )
    }

    return null
}

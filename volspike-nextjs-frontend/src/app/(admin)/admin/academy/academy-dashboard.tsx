'use client'

import { useEffect, useState, useCallback } from 'react'
import { adminAPI } from '@/lib/admin/api-client'
import {
    BookOpen,
    Loader2,
    GraduationCap,
    FileText,
    HelpCircle,
    Upload,
    ChevronRight,
    ChevronDown,
    Eye,
    EyeOff,
    CheckCircle2,
    AlertCircle,
} from 'lucide-react'

interface AcademyStats {
    paths: number
    publishedPaths: number
    modules: number
    lessons: number
    quizQuestions: number
}

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

interface AcademyDashboardProps {
    accessToken: string
}

export function AcademyDashboard({ accessToken }: AcademyDashboardProps) {
    const [stats, setStats] = useState<AcademyStats | null>(null)
    const [paths, setPaths] = useState<LearningPath[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
    const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
    const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null)
    const [importing, setImporting] = useState(false)
    const [importResult, setImportResult] = useState<any>(null)

    const fetchData = useCallback(async () => {
        try {
            adminAPI.setAccessToken(accessToken)
            const [statsRes, pathsRes] = await Promise.all([
                adminAPI.getAcademyStats(),
                adminAPI.getAcademyPaths(),
            ])
            setStats(statsRes.stats)
            setPaths(pathsRes.paths)
        } catch (err: any) {
            setError(err.message || 'Failed to load academy data')
        } finally {
            setLoading(false)
        }
    }, [accessToken])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const togglePath = (pathId: string) => {
        setExpandedPaths(prev => {
            const next = new Set(prev)
            if (next.has(pathId)) {
                next.delete(pathId)
            } else {
                next.add(pathId)
            }
            return next
        })
    }

    const toggleModule = (moduleId: string) => {
        setExpandedModules(prev => {
            const next = new Set(prev)
            if (next.has(moduleId)) {
                next.delete(moduleId)
            } else {
                next.add(moduleId)
            }
            return next
        })
    }

    const togglePublish = async (path: LearningPath) => {
        try {
            adminAPI.setAccessToken(accessToken)
            await adminAPI.updateAcademyPath(path.id, { isPublished: !path.isPublished })
            await fetchData()
        } catch (err: any) {
            setError(err.message || 'Failed to update path')
        }
    }

    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        setImporting(true)
        setImportResult(null)
        setError(null)

        try {
            const text = await file.text()
            const data = JSON.parse(text)

            adminAPI.setAccessToken(accessToken)
            const result = await adminAPI.importAcademyContent(data)

            setImportResult(result)
            await fetchData()
        } catch (err: any) {
            setError(err.message || 'Failed to import content')
        } finally {
            setImporting(false)
            event.target.value = ''
        }
    }

    const viewLesson = async (lessonId: string) => {
        try {
            adminAPI.setAccessToken(accessToken)
            const { lesson } = await adminAPI.getAcademyLesson(lessonId)
            setSelectedLesson(lesson)
        } catch (err: any) {
            setError(err.message || 'Failed to load lesson')
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <p className="text-sm text-muted-foreground">Loading academy data...</p>
                </div>
            </div>
        )
    }

    if (error && !stats) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <p className="text-red-600 dark:text-red-400">{error}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Academy Management</h1>
                    <p className="text-muted-foreground">Manage learning paths, modules, and lessons</p>
                </div>
                <div className="flex items-center gap-3">
                    <a
                        href="/admin/academy/preview"
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                    >
                        <Eye className="h-4 w-4" />
                        <span className="text-sm font-medium">Preview as User</span>
                    </a>
                    <label className="cursor-pointer">
                        <input
                            type="file"
                            accept=".json"
                            onChange={handleImport}
                            className="hidden"
                            disabled={importing}
                        />
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card hover:bg-accent transition-colors ${importing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            {importing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Upload className="h-4 w-4" />
                            )}
                            <span className="text-sm font-medium">
                                {importing ? 'Importing...' : 'Import Content'}
                            </span>
                        </div>
                    </label>
                </div>
            </div>

            {/* Import Result */}
            {importResult && (
                <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 p-4">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="font-medium">Import Successful</span>
                    </div>
                    <div className="mt-2 text-sm text-green-600 dark:text-green-300 grid grid-cols-4 gap-4">
                        <div>Paths: {importResult.imported.paths}</div>
                        <div>Modules: {importResult.imported.modules}</div>
                        <div>Lessons: {importResult.imported.lessons}</div>
                        <div>Quiz Questions: {importResult.imported.quizQuestions}</div>
                    </div>
                </div>
            )}

            {/* Error Banner */}
            {error && stats && (
                <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-4">
                    <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                        <AlertCircle className="h-5 w-5" />
                        <span>{error}</span>
                    </div>
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-2">
                            <GraduationCap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{stats?.paths || 0}</div>
                            <div className="text-xs text-muted-foreground">Learning Paths</div>
                        </div>
                    </div>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-green-100 dark:bg-green-900/30 p-2">
                            <Eye className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{stats?.publishedPaths || 0}</div>
                            <div className="text-xs text-muted-foreground">Published</div>
                        </div>
                    </div>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-purple-100 dark:bg-purple-900/30 p-2">
                            <BookOpen className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{stats?.modules || 0}</div>
                            <div className="text-xs text-muted-foreground">Modules</div>
                        </div>
                    </div>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-orange-100 dark:bg-orange-900/30 p-2">
                            <FileText className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{stats?.lessons || 0}</div>
                            <div className="text-xs text-muted-foreground">Lessons</div>
                        </div>
                    </div>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-cyan-100 dark:bg-cyan-900/30 p-2">
                            <HelpCircle className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{stats?.quizQuestions || 0}</div>
                            <div className="text-xs text-muted-foreground">Quiz Questions</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Tree */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Learning Paths Tree */}
                <div className="rounded-lg border border-border bg-card">
                    <div className="p-4 border-b border-border">
                        <h2 className="font-semibold">Curriculum Structure</h2>
                    </div>
                    <div className="p-4 max-h-[600px] overflow-auto">
                        {paths.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p>No learning paths yet</p>
                                <p className="text-sm mt-1">Import content to get started</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {paths.map(path => (
                                    <div key={path.id} className="border border-border rounded-lg">
                                        {/* Path Header */}
                                        <div
                                            className="flex items-center gap-2 p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                                            onClick={() => togglePath(path.id)}
                                        >
                                            {expandedPaths.has(path.id) ? (
                                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                            ) : (
                                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                            )}
                                            <GraduationCap className="h-4 w-4 text-blue-500" />
                                            <span className="font-medium flex-1">{path.title}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                path.difficulty === 'beginner' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                path.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                            }`}>
                                                {path.difficulty}
                                            </span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    togglePublish(path)
                                                }}
                                                className={`p-1 rounded ${path.isPublished ? 'text-green-600' : 'text-muted-foreground'}`}
                                                title={path.isPublished ? 'Published - Click to unpublish' : 'Unpublished - Click to publish'}
                                            >
                                                {path.isPublished ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                            </button>
                                        </div>

                                        {/* Modules */}
                                        {expandedPaths.has(path.id) && (
                                            <div className="border-t border-border">
                                                {path.modules.map(module => (
                                                    <div key={module.id} className="ml-4 border-l border-border">
                                                        {/* Module Header */}
                                                        <div
                                                            className="flex items-center gap-2 p-2 cursor-pointer hover:bg-accent/30 transition-colors"
                                                            onClick={() => toggleModule(module.id)}
                                                        >
                                                            {expandedModules.has(module.id) ? (
                                                                <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                                            ) : (
                                                                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                                            )}
                                                            <BookOpen className="h-3.5 w-3.5 text-purple-500" />
                                                            <span className="text-sm flex-1">{module.title}</span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {module.lessons.length} lessons
                                                            </span>
                                                        </div>

                                                        {/* Lessons */}
                                                        {expandedModules.has(module.id) && (
                                                            <div className="ml-4 border-l border-border">
                                                                {module.lessons.map(lesson => (
                                                                    <div
                                                                        key={lesson.id}
                                                                        className={`flex items-center gap-2 p-2 cursor-pointer hover:bg-accent/20 transition-colors text-sm ${
                                                                            selectedLesson?.id === lesson.id ? 'bg-accent' : ''
                                                                        }`}
                                                                        onClick={() => viewLesson(lesson.id)}
                                                                    >
                                                                        <FileText className="h-3 w-3 text-orange-500" />
                                                                        <span className="flex-1 truncate">{lesson.title}</span>
                                                                        {lesson.isFree && (
                                                                            <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                                                Free
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Lesson Preview */}
                <div className="rounded-lg border border-border bg-card">
                    <div className="p-4 border-b border-border">
                        <h2 className="font-semibold">Lesson Preview</h2>
                    </div>
                    <div className="p-4 max-h-[600px] overflow-auto">
                        {selectedLesson ? (
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-lg font-semibold">{selectedLesson.title}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                                            selectedLesson.difficulty === 'beginner' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                            selectedLesson.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                        }`}>
                                            {selectedLesson.difficulty}
                                        </span>
                                        {selectedLesson.isFree && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                Free
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {selectedLesson.lessonIntro && (
                                    <div>
                                        <h4 className="text-sm font-medium text-muted-foreground mb-1">Introduction</h4>
                                        <p className="text-sm">{selectedLesson.lessonIntro}</p>
                                    </div>
                                )}

                                {selectedLesson.topics && selectedLesson.topics.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-medium text-muted-foreground mb-1">Topics</h4>
                                        <div className="flex flex-wrap gap-1">
                                            {selectedLesson.topics.map((topic, i) => (
                                                <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-accent">
                                                    {topic}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {selectedLesson.transformedContent && (
                                    <div>
                                        <h4 className="text-sm font-medium text-muted-foreground mb-1">Content Preview</h4>
                                        <div className="text-sm prose prose-sm dark:prose-invert max-w-none border border-border rounded-lg p-3 bg-accent/20 max-h-[200px] overflow-auto">
                                            {selectedLesson.transformedContent.substring(0, 500)}...
                                        </div>
                                    </div>
                                )}

                                {selectedLesson.lessonSummary && (
                                    <div>
                                        <h4 className="text-sm font-medium text-muted-foreground mb-1">Summary</h4>
                                        <p className="text-sm text-muted-foreground">{selectedLesson.lessonSummary}</p>
                                    </div>
                                )}

                                {selectedLesson.quizQuestions && selectedLesson.quizQuestions.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-medium text-muted-foreground mb-2">
                                            Quiz Questions ({selectedLesson.quizQuestions.length})
                                        </h4>
                                        <div className="space-y-3">
                                            {selectedLesson.quizQuestions.slice(0, 2).map((q, i) => (
                                                <div key={q.id} className="border border-border rounded-lg p-3">
                                                    <p className="text-sm font-medium mb-2">{i + 1}. {q.question}</p>
                                                    <div className="space-y-1">
                                                        {q.options.map((opt, oi) => (
                                                            <div
                                                                key={oi}
                                                                className={`text-xs p-1.5 rounded ${
                                                                    opt.startsWith(q.correctAnswer)
                                                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                                                        : 'bg-accent'
                                                                }`}
                                                            >
                                                                {opt}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                            {selectedLesson.quizQuestions.length > 2 && (
                                                <p className="text-xs text-muted-foreground">
                                                    +{selectedLesson.quizQuestions.length - 2} more questions
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-muted-foreground">
                                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p>Select a lesson to preview</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

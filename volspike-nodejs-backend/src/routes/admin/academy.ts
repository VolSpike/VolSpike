import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../../index'
import { createLogger } from '../../lib/logger'
import type { AppBindings, AppVariables } from '../../types/hono'

const logger = createLogger()

const adminAcademyRoutes = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>()

// ============================================================================
// LEARNING PATHS
// ============================================================================

// GET /api/admin/academy/paths - List all learning paths
adminAcademyRoutes.get('/paths', async (c) => {
    try {
        const paths = await prisma.academyLearningPath.findMany({
            include: {
                modules: {
                    include: {
                        lessons: {
                            select: {
                                id: true,
                                title: true,
                                order: true,
                                isFree: true,
                            },
                            orderBy: { order: 'asc' },
                        },
                    },
                    orderBy: { order: 'asc' },
                },
            },
            orderBy: { order: 'asc' },
        })

        return c.json({ paths })
    } catch (error: any) {
        logger.error('Error fetching learning paths:', error)
        return c.json({ error: 'Failed to fetch learning paths' }, 500)
    }
})

// GET /api/admin/academy/paths/:id - Get single learning path
adminAcademyRoutes.get('/paths/:id', async (c) => {
    try {
        const pathId = c.req.param('id')

        const path = await prisma.academyLearningPath.findUnique({
            where: { id: pathId },
            include: {
                modules: {
                    include: {
                        lessons: {
                            orderBy: { order: 'asc' },
                        },
                    },
                    orderBy: { order: 'asc' },
                },
            },
        })

        if (!path) {
            return c.json({ error: 'Learning path not found' }, 404)
        }

        return c.json({ path })
    } catch (error: any) {
        logger.error('Error fetching learning path:', error)
        return c.json({ error: 'Failed to fetch learning path' }, 500)
    }
})

// POST /api/admin/academy/paths - Create learning path
adminAcademyRoutes.post('/paths', async (c) => {
    try {
        const body = await c.req.json()

        const schema = z.object({
            title: z.string().min(1),
            slug: z.string().min(1),
            description: z.string(),
            difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
            order: z.number().default(0),
            isPublished: z.boolean().default(false),
            introduction: z.string().optional(),
            whatYoullLearn: z.array(z.string()).default([]),
        })

        const data = schema.parse(body)

        const path = await prisma.academyLearningPath.create({
            data,
        })

        logger.info(`Learning path created: ${path.title}`)
        return c.json({ path }, 201)
    } catch (error: any) {
        logger.error('Error creating learning path:', error)
        if (error?.code === 'P2002') {
            return c.json({ error: 'A path with this slug already exists' }, 409)
        }
        return c.json({ error: 'Failed to create learning path' }, 500)
    }
})

// PATCH /api/admin/academy/paths/:id - Update learning path
adminAcademyRoutes.patch('/paths/:id', async (c) => {
    try {
        const pathId = c.req.param('id')
        const body = await c.req.json()

        const schema = z.object({
            title: z.string().min(1).optional(),
            slug: z.string().min(1).optional(),
            description: z.string().optional(),
            difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
            order: z.number().optional(),
            isPublished: z.boolean().optional(),
            introduction: z.string().optional(),
            whatYoullLearn: z.array(z.string()).optional(),
        })

        const data = schema.parse(body)

        const path = await prisma.academyLearningPath.update({
            where: { id: pathId },
            data,
        })

        logger.info(`Learning path updated: ${path.title}`)
        return c.json({ path })
    } catch (error: any) {
        logger.error('Error updating learning path:', error)
        return c.json({ error: 'Failed to update learning path' }, 500)
    }
})

// DELETE /api/admin/academy/paths/:id - Delete learning path
adminAcademyRoutes.delete('/paths/:id', async (c) => {
    try {
        const pathId = c.req.param('id')

        await prisma.academyLearningPath.delete({
            where: { id: pathId },
        })

        logger.info(`Learning path deleted: ${pathId}`)
        return c.json({ success: true })
    } catch (error: any) {
        logger.error('Error deleting learning path:', error)
        return c.json({ error: 'Failed to delete learning path' }, 500)
    }
})

// ============================================================================
// MODULES
// ============================================================================

// GET /api/admin/academy/modules - List all modules
adminAcademyRoutes.get('/modules', async (c) => {
    try {
        const pathId = c.req.query('pathId')

        const where = pathId ? { pathId } : {}

        const modules = await prisma.academyModule.findMany({
            where,
            include: {
                path: {
                    select: { id: true, title: true },
                },
                lessons: {
                    select: {
                        id: true,
                        title: true,
                        order: true,
                    },
                    orderBy: { order: 'asc' },
                },
            },
            orderBy: { order: 'asc' },
        })

        return c.json({ modules })
    } catch (error: any) {
        logger.error('Error fetching modules:', error)
        return c.json({ error: 'Failed to fetch modules' }, 500)
    }
})

// POST /api/admin/academy/modules - Create module
adminAcademyRoutes.post('/modules', async (c) => {
    try {
        const body = await c.req.json()

        const schema = z.object({
            pathId: z.string(),
            title: z.string().min(1),
            slug: z.string().min(1),
            description: z.string(),
            order: z.number().default(0),
            introduction: z.string().optional(),
        })

        const data = schema.parse(body)

        const module = await prisma.academyModule.create({
            data,
        })

        logger.info(`Module created: ${module.title}`)
        return c.json({ module }, 201)
    } catch (error: any) {
        logger.error('Error creating module:', error)
        if (error?.code === 'P2002') {
            return c.json({ error: 'A module with this slug already exists' }, 409)
        }
        return c.json({ error: 'Failed to create module' }, 500)
    }
})

// PATCH /api/admin/academy/modules/:id - Update module
adminAcademyRoutes.patch('/modules/:id', async (c) => {
    try {
        const moduleId = c.req.param('id')
        const body = await c.req.json()

        const schema = z.object({
            pathId: z.string().optional(),
            title: z.string().min(1).optional(),
            slug: z.string().min(1).optional(),
            description: z.string().optional(),
            order: z.number().optional(),
            introduction: z.string().optional(),
        })

        const data = schema.parse(body)

        const module = await prisma.academyModule.update({
            where: { id: moduleId },
            data,
        })

        logger.info(`Module updated: ${module.title}`)
        return c.json({ module })
    } catch (error: any) {
        logger.error('Error updating module:', error)
        return c.json({ error: 'Failed to update module' }, 500)
    }
})

// DELETE /api/admin/academy/modules/:id - Delete module
adminAcademyRoutes.delete('/modules/:id', async (c) => {
    try {
        const moduleId = c.req.param('id')

        await prisma.academyModule.delete({
            where: { id: moduleId },
        })

        logger.info(`Module deleted: ${moduleId}`)
        return c.json({ success: true })
    } catch (error: any) {
        logger.error('Error deleting module:', error)
        return c.json({ error: 'Failed to delete module' }, 500)
    }
})

// ============================================================================
// LESSONS
// ============================================================================

// GET /api/admin/academy/lessons - List all lessons
adminAcademyRoutes.get('/lessons', async (c) => {
    try {
        const moduleId = c.req.query('moduleId')
        const pathId = c.req.query('pathId')

        const where: any = {}
        if (moduleId) where.moduleId = moduleId
        if (pathId) where.module = { pathId }

        const lessons = await prisma.academyLesson.findMany({
            where,
            include: {
                module: {
                    select: {
                        id: true,
                        title: true,
                        path: {
                            select: { id: true, title: true },
                        },
                    },
                },
                images: {
                    orderBy: { position: 'asc' },
                },
                quizQuestions: {
                    orderBy: { order: 'asc' },
                },
            },
            orderBy: { order: 'asc' },
        })

        return c.json({ lessons })
    } catch (error: any) {
        logger.error('Error fetching lessons:', error)
        return c.json({ error: 'Failed to fetch lessons' }, 500)
    }
})

// GET /api/admin/academy/lessons/:id - Get single lesson
adminAcademyRoutes.get('/lessons/:id', async (c) => {
    try {
        const lessonId = c.req.param('id')

        const lesson = await prisma.academyLesson.findUnique({
            where: { id: lessonId },
            include: {
                module: {
                    select: {
                        id: true,
                        title: true,
                        path: {
                            select: { id: true, title: true },
                        },
                    },
                },
                images: {
                    orderBy: { position: 'asc' },
                },
                quizQuestions: {
                    orderBy: { order: 'asc' },
                },
            },
        })

        if (!lesson) {
            return c.json({ error: 'Lesson not found' }, 404)
        }

        return c.json({ lesson })
    } catch (error: any) {
        logger.error('Error fetching lesson:', error)
        return c.json({ error: 'Failed to fetch lesson' }, 500)
    }
})

// POST /api/admin/academy/lessons - Create lesson
adminAcademyRoutes.post('/lessons', async (c) => {
    try {
        const body = await c.req.json()

        const schema = z.object({
            moduleId: z.string(),
            title: z.string().min(1),
            slug: z.string().min(1),
            originalTitle: z.string().optional(),
            content: z.string(),
            transformedContent: z.string().optional(),
            summary: z.string(),
            lessonIntro: z.string().optional(),
            lessonSummary: z.string().optional(),
            difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
            topics: z.array(z.string()).default([]),
            prerequisites: z.array(z.string()).default([]),
            keyTakeaways: z.array(z.string()).default([]),
            order: z.number().default(0),
            isFree: z.boolean().default(false),
            estimatedMinutes: z.number().optional(),
        })

        const data = schema.parse(body)

        const lesson = await prisma.academyLesson.create({
            data,
        })

        logger.info(`Lesson created: ${lesson.title}`)
        return c.json({ lesson }, 201)
    } catch (error: any) {
        logger.error('Error creating lesson:', error)
        if (error?.code === 'P2002') {
            return c.json({ error: 'A lesson with this slug already exists' }, 409)
        }
        return c.json({ error: 'Failed to create lesson' }, 500)
    }
})

// PATCH /api/admin/academy/lessons/:id - Update lesson
adminAcademyRoutes.patch('/lessons/:id', async (c) => {
    try {
        const lessonId = c.req.param('id')
        const body = await c.req.json()

        const schema = z.object({
            moduleId: z.string().optional(),
            title: z.string().min(1).optional(),
            slug: z.string().min(1).optional(),
            originalTitle: z.string().optional(),
            content: z.string().optional(),
            transformedContent: z.string().optional(),
            summary: z.string().optional(),
            lessonIntro: z.string().optional(),
            lessonSummary: z.string().optional(),
            difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
            topics: z.array(z.string()).optional(),
            prerequisites: z.array(z.string()).optional(),
            keyTakeaways: z.array(z.string()).optional(),
            order: z.number().optional(),
            isFree: z.boolean().optional(),
            estimatedMinutes: z.number().optional(),
        })

        const data = schema.parse(body)

        const lesson = await prisma.academyLesson.update({
            where: { id: lessonId },
            data,
        })

        logger.info(`Lesson updated: ${lesson.title}`)
        return c.json({ lesson })
    } catch (error: any) {
        logger.error('Error updating lesson:', error)
        return c.json({ error: 'Failed to update lesson' }, 500)
    }
})

// DELETE /api/admin/academy/lessons/:id - Delete lesson
adminAcademyRoutes.delete('/lessons/:id', async (c) => {
    try {
        const lessonId = c.req.param('id')

        await prisma.academyLesson.delete({
            where: { id: lessonId },
        })

        logger.info(`Lesson deleted: ${lessonId}`)
        return c.json({ success: true })
    } catch (error: any) {
        logger.error('Error deleting lesson:', error)
        return c.json({ error: 'Failed to delete lesson' }, 500)
    }
})

// ============================================================================
// QUIZ QUESTIONS
// ============================================================================

// POST /api/admin/academy/quiz-questions - Create quiz question
adminAcademyRoutes.post('/quiz-questions', async (c) => {
    try {
        const body = await c.req.json()

        const schema = z.object({
            lessonId: z.string(),
            question: z.string().min(1),
            options: z.array(z.string()).min(2),
            correctAnswer: z.string(),
            explanation: z.string().optional(),
            order: z.number().default(0),
        })

        const data = schema.parse(body)

        const quizQuestion = await prisma.academyQuizQuestion.create({
            data,
        })

        logger.info(`Quiz question created for lesson: ${data.lessonId}`)
        return c.json({ quizQuestion }, 201)
    } catch (error: any) {
        logger.error('Error creating quiz question:', error)
        return c.json({ error: 'Failed to create quiz question' }, 500)
    }
})

// POST /api/admin/academy/quiz-questions/bulk - Create multiple quiz questions
adminAcademyRoutes.post('/quiz-questions/bulk', async (c) => {
    try {
        const body = await c.req.json()

        const schema = z.object({
            lessonId: z.string(),
            questions: z.array(z.object({
                question: z.string().min(1),
                options: z.array(z.string()).min(2),
                correctAnswer: z.string(),
                explanation: z.string().optional(),
                order: z.number().default(0),
            })),
        })

        const data = schema.parse(body)

        const quizQuestions = await prisma.academyQuizQuestion.createMany({
            data: data.questions.map((q, i) => ({
                lessonId: data.lessonId,
                ...q,
                order: q.order ?? i,
            })),
        })

        logger.info(`${quizQuestions.count} quiz questions created for lesson: ${data.lessonId}`)
        return c.json({ count: quizQuestions.count }, 201)
    } catch (error: any) {
        logger.error('Error creating quiz questions:', error)
        return c.json({ error: 'Failed to create quiz questions' }, 500)
    }
})

// DELETE /api/admin/academy/quiz-questions/:id - Delete quiz question
adminAcademyRoutes.delete('/quiz-questions/:id', async (c) => {
    try {
        const questionId = c.req.param('id')

        await prisma.academyQuizQuestion.delete({
            where: { id: questionId },
        })

        logger.info(`Quiz question deleted: ${questionId}`)
        return c.json({ success: true })
    } catch (error: any) {
        logger.error('Error deleting quiz question:', error)
        return c.json({ error: 'Failed to delete quiz question' }, 500)
    }
})

// ============================================================================
// IMAGES
// ============================================================================

// POST /api/admin/academy/images - Create image reference
adminAcademyRoutes.post('/images', async (c) => {
    try {
        const body = await c.req.json()

        const schema = z.object({
            lessonId: z.string(),
            filename: z.string(),
            url: z.string().optional(),
            position: z.number().default(0),
            altText: z.string().optional(),
            analysis: z.any().optional(),
        })

        const data = schema.parse(body)

        const image = await prisma.academyImage.create({
            data,
        })

        logger.info(`Image created for lesson: ${data.lessonId}`)
        return c.json({ image }, 201)
    } catch (error: any) {
        logger.error('Error creating image:', error)
        return c.json({ error: 'Failed to create image' }, 500)
    }
})

// POST /api/admin/academy/images/bulk - Create multiple images
adminAcademyRoutes.post('/images/bulk', async (c) => {
    try {
        const body = await c.req.json()

        const schema = z.object({
            lessonId: z.string(),
            images: z.array(z.object({
                filename: z.string(),
                url: z.string().optional(),
                position: z.number().default(0),
                altText: z.string().optional(),
                analysis: z.any().optional(),
            })),
        })

        const data = schema.parse(body)

        const images = await prisma.academyImage.createMany({
            data: data.images.map((img, i) => ({
                lessonId: data.lessonId,
                ...img,
                position: img.position ?? i,
            })),
        })

        logger.info(`${images.count} images created for lesson: ${data.lessonId}`)
        return c.json({ count: images.count }, 201)
    } catch (error: any) {
        logger.error('Error creating images:', error)
        return c.json({ error: 'Failed to create images' }, 500)
    }
})

// ============================================================================
// IMPORT ENDPOINT - Import processed content from JSON files
// ============================================================================

// POST /api/admin/academy/import - Import entire curriculum from processed data
adminAcademyRoutes.post('/import', async (c) => {
    try {
        const body = await c.req.json()

        const schema = z.object({
            curriculumProposal: z.any(),
            moduleContent: z.any(),
            transformedContent: z.any(),
        })

        const data = schema.parse(body)
        const { curriculumProposal, moduleContent, transformedContent } = data

        // Create a map of transformed content by title for easy lookup
        const transformedMap = new Map<string, any>()
        for (const doc of transformedContent.documents || []) {
            transformedMap.set(doc.title, doc)
        }

        // Create a map of module introductions
        const moduleIntroMap = new Map<string, any>()
        for (const path of moduleContent.paths || []) {
            for (const module of path.modules || []) {
                moduleIntroMap.set(`${path.name}|${module.name}`, module)
            }
        }

        const proposal = curriculumProposal.proposal
        const importResults = {
            paths: 0,
            modules: 0,
            lessons: 0,
            quizQuestions: 0,
        }

        // Import learning paths
        for (let pathIndex = 0; pathIndex < proposal.learning_paths.length; pathIndex++) {
            const pathData = proposal.learning_paths[pathIndex]
            const pathIntro = moduleContent.paths?.find((p: any) => p.name === pathData.name)

            const slug = pathData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

            // Check if path already exists
            const existingPath = await prisma.academyLearningPath.findUnique({
                where: { slug },
            })

            let path
            if (existingPath) {
                path = await prisma.academyLearningPath.update({
                    where: { slug },
                    data: {
                        title: pathData.name,
                        description: pathData.description,
                        difficulty: pathData.difficulty,
                        order: pathIndex,
                        introduction: pathIntro?.introduction || null,
                        whatYoullLearn: pathIntro?.what_youll_learn || [],
                    },
                })
            } else {
                path = await prisma.academyLearningPath.create({
                    data: {
                        title: pathData.name,
                        slug,
                        description: pathData.description,
                        difficulty: pathData.difficulty,
                        order: pathIndex,
                        isPublished: false,
                        introduction: pathIntro?.introduction || null,
                        whatYoullLearn: pathIntro?.what_youll_learn || [],
                    },
                })
            }
            importResults.paths++

            // Import modules for this path
            for (let moduleIndex = 0; moduleIndex < pathData.modules.length; moduleIndex++) {
                const moduleData = pathData.modules[moduleIndex]
                const moduleIntro = moduleIntroMap.get(`${pathData.name}|${moduleData.name}`)

                const moduleSlug = moduleData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

                const existingModule = await prisma.academyModule.findUnique({
                    where: { slug: moduleSlug },
                })

                let module
                if (existingModule) {
                    module = await prisma.academyModule.update({
                        where: { slug: moduleSlug },
                        data: {
                            pathId: path.id,
                            title: moduleData.name,
                            description: moduleData.description,
                            order: moduleIndex,
                            introduction: moduleIntro?.introduction || null,
                        },
                    })
                } else {
                    module = await prisma.academyModule.create({
                        data: {
                            pathId: path.id,
                            title: moduleData.name,
                            slug: moduleSlug,
                            description: moduleData.description,
                            order: moduleIndex,
                            introduction: moduleIntro?.introduction || null,
                        },
                    })
                }
                importResults.modules++

                // Import lessons for this module
                for (const lessonData of moduleData.lessons || []) {
                    const transformed = transformedMap.get(lessonData.title)

                    const lessonSlug = lessonData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

                    const existingLesson = await prisma.academyLesson.findUnique({
                        where: { slug: lessonSlug },
                    })

                    let lesson
                    const lessonPayload = {
                        moduleId: module.id,
                        title: transformed?.transformed?.transformed_title || lessonData.title,
                        originalTitle: lessonData.title,
                        content: transformed?.transformed?.transformed_content || '',
                        transformedContent: transformed?.transformed?.transformed_content || null,
                        summary: transformed?.transformed?.lesson_summary || lessonData.rationale || '',
                        lessonIntro: transformed?.transformed?.lesson_intro || null,
                        lessonSummary: transformed?.transformed?.lesson_summary || null,
                        difficulty: pathData.difficulty,
                        topics: [] as string[],
                        prerequisites: [] as string[],
                        keyTakeaways: [] as string[],
                        order: lessonData.order || 0,
                        isFree: false,
                    }

                    if (existingLesson) {
                        lesson = await prisma.academyLesson.update({
                            where: { slug: lessonSlug },
                            data: lessonPayload,
                        })
                    } else {
                        lesson = await prisma.academyLesson.create({
                            data: {
                                ...lessonPayload,
                                slug: lessonSlug,
                            },
                        })
                    }
                    importResults.lessons++

                    // Import quiz questions if available
                    if (transformed?.quiz?.questions) {
                        // Delete existing quiz questions for this lesson
                        await prisma.academyQuizQuestion.deleteMany({
                            where: { lessonId: lesson.id },
                        })

                        for (let qIndex = 0; qIndex < transformed.quiz.questions.length; qIndex++) {
                            const q = transformed.quiz.questions[qIndex]
                            await prisma.academyQuizQuestion.create({
                                data: {
                                    lessonId: lesson.id,
                                    question: q.question,
                                    options: q.options,
                                    correctAnswer: q.correct_answer,
                                    explanation: q.explanation || null,
                                    order: qIndex,
                                },
                            })
                            importResults.quizQuestions++
                        }
                    }
                }
            }
        }

        logger.info('Academy content imported', importResults)
        return c.json({
            success: true,
            imported: importResults,
        })
    } catch (error: any) {
        logger.error('Error importing academy content:', error)
        return c.json({ error: 'Failed to import content', details: error?.message }, 500)
    }
})

// ============================================================================
// STATS
// ============================================================================

// GET /api/admin/academy/stats - Get academy statistics
adminAcademyRoutes.get('/stats', async (c) => {
    try {
        const [
            pathCount,
            moduleCount,
            lessonCount,
            quizCount,
            publishedPathCount,
        ] = await Promise.all([
            prisma.academyLearningPath.count(),
            prisma.academyModule.count(),
            prisma.academyLesson.count(),
            prisma.academyQuizQuestion.count(),
            prisma.academyLearningPath.count({ where: { isPublished: true } }),
        ])

        return c.json({
            stats: {
                paths: pathCount,
                publishedPaths: publishedPathCount,
                modules: moduleCount,
                lessons: lessonCount,
                quizQuestions: quizCount,
            },
        })
    } catch (error: any) {
        logger.error('Error fetching academy stats:', error)
        return c.json({ error: 'Failed to fetch stats' }, 500)
    }
})

export { adminAcademyRoutes }

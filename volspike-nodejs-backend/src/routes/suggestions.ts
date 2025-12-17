import { Hono } from 'hono'
import { z } from 'zod'
import { createLogger } from '../lib/logger'
import { EmailService } from '../services/email'

const logger = createLogger()

// Suggestions API endpoint - receives user feedback and sends email notifications

const suggestionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
  type: z.enum(['feature', 'improvement', 'bug', 'other']),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(10, 'Description must be at least 10 characters').max(5000),
})

export const suggestionRoutes = new Hono()

suggestionRoutes.post('/', async (c) => {
  try {
    // Parse and validate request body
    const body = await c.req.json()
    const validatedData = suggestionSchema.parse(body)

    logger.info('Suggestion received:', {
      name: validatedData.name,
      email: validatedData.email,
      type: validatedData.type,
      title: validatedData.title,
    })

    // Send email notification
    const emailService = EmailService.getInstance()
    await emailService.sendSuggestionNotification(validatedData)

    return c.json({
      success: true,
      message: 'Suggestion submitted successfully',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid suggestion data:', error.errors)
      return c.json(
        {
          error: 'Validation failed',
          details: error.errors,
        },
        400
      )
    }

    logger.error('Error submitting suggestion:', error)
    return c.json(
      {
        error: 'Failed to submit suggestion',
      },
      500
    )
  }
})

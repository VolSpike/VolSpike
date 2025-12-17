import { Hono } from 'hono'
import { z } from 'zod'
import { createLogger } from '../lib/logger'
import { EmailService } from '../services/email'

const logger = createLogger()

// Suggestions API endpoint - receives user feedback and sends email notifications

const suggestionSchema = z.object({
  name: z.string().max(100).optional(),
  email: z.string().email('Invalid email address'),
  type: z.enum(['feature', 'improvement', 'bug', 'other']).optional(),
  title: z.string().max(200).optional(),
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

    // Send emails asynchronously in background for instant response
    const emailService = EmailService.getInstance()
    Promise.all([
      emailService.sendSuggestionNotification(validatedData),
      emailService.sendSuggestionConfirmation(validatedData),
    ]).catch((error) => {
      logger.error('Failed to send suggestion emails in background:', error)
    })

    // Return success immediately without waiting for emails
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

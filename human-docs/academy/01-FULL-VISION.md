# VolSpike Academy - Full Vision

This document captures the complete long-term vision for VolSpike Academy. Implementation is phased, with Phase 1 focusing on text content only.

---

## Overview

Build a comprehensive learning platform from 200-500 mixed text/video files from 6 analysts, featuring:

- Structured curriculum (beginner to advanced)
- Progress tracking and interactive features
- AI-powered Q&A from the knowledge base

## Key Decisions (Confirmed)

| Decision         | Choice                                                            |
| ---------------- | ----------------------------------------------------------------- |
| Pricing Model    | **Freemium** - Basic lessons free, advanced content for Pro/Elite |
| Attribution      | **Anonymous** - Unified VolSpike brand, no analyst names          |
| Video Handling   | **Text only initially** - Videos deferred to Phase 2              |
| Content Location | User will provide local folder path                               |

---

## Phase 1: Text Content Processing (CURRENT)

See [02-PHASE1-TEXT-CONTENT.md](02-PHASE1-TEXT-CONTENT.md) for detailed plan.

Focus:

- Extract text and images from .docx files
- Analyze TradingView charts with annotations
- Build initial curriculum from text content
- Frontend pages and progress tracking

---

## Phase 2: Video Content Integration (FUTURE)

### Video Transcription

**Recommendation: OpenAI Whisper API**

Why Whisper API:

- Cost: ~$0.006/minute (a 10-hour video library = ~$3.60)
- No GPU setup required
- High accuracy for trading terminology

**Implementation:**

1. Scan local folder for video files (.mp4, .mov, .webm, etc.)
2. Extract audio using ffmpeg
3. Send to Whisper API for transcription
4. Save transcripts as .txt files
5. Track progress in manifest JSON file

### Video Content Analysis

After transcription:

1. Run summarization on transcripts
2. Map to existing curriculum topics
3. Identify new topics from videos
4. Fill curriculum gaps

---

## Phase 3: AI-Powered Q&A (FUTURE)

### Vector Database Setup

**Recommendation: PostgreSQL with pgvector**

Why pgvector:

- Already using PostgreSQL with Prisma
- pgvector extension is free
- No additional service to manage
- Works well with OpenAI embeddings

### Database Schema Additions

```prisma
model AcademyContent {
  id            String   @id @default(cuid())
  title         String
  content       String   @db.Text
  summary       String   @db.Text
  embedding     Unsupported("vector(1536)")?
  moduleId      String
  lessonOrder   Int
  difficulty    String
  topics        String[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  module        AcademyModule @relation(fields: [moduleId], references: [id])
}

model AcademyModule {
  id          String   @id @default(cuid())
  title       String
  description String
  pathId      String
  order       Int

  path        LearningPath @relation(fields: [pathId], references: [id])
  lessons     AcademyContent[]
}

model LearningPath {
  id          String   @id @default(cuid())
  title       String
  description String
  difficulty  String

  modules     AcademyModule[]
}

model UserProgress {
  id          String   @id @default(cuid())
  userId      String
  contentId   String
  completed   Boolean  @default(false)
  score       Int?
  completedAt DateTime?

  user        User     @relation(fields: [userId], references: [id])
}
```

### AI Q&A Implementation

1. User asks question in Academy
2. Generate embedding for question
3. Search pgvector for similar content chunks
4. Pass top 5 results + question to Claude
5. Claude answers using only the retrieved context
6. Show answer with links to source lessons

---

## Frontend Pages (All Phases)

```
/academy                    # Landing page, learning path overview
/academy/path/[pathId]      # Learning path detail
/academy/lesson/[lessonId]  # Individual lesson
/academy/progress           # User's progress dashboard
/academy/ask                # AI Q&A interface (Phase 3)
```

### Components

- `LearningPathCard` - Overview of a learning path
- `ModuleList` - Expandable list of modules
- `LessonViewer` - Content display with images
- `ProgressTracker` - Visual progress indicators
- `QuizComponent` - Interactive quiz UI
- `AskAI` - Chat interface for Q&A (Phase 3)

---

## Cost Estimates (Full Implementation)

| Service               | Usage                   | Cost    |
| --------------------- | ----------------------- | ------- |
| Whisper API           | ~50 hours of video      | ~$18    |
| Claude API (analysis) | 500 content items       | ~$25-50 |
| OpenAI Embeddings     | 500 items x 1536 dims   | ~$1     |
| pgvector              | Included in existing DB | $0      |

**Total estimated: $50-75 one-time for content processing**

---

## Timeline Overview

| Phase   | Focus                | Estimated Duration     |
| ------- | -------------------- | ---------------------- |
| Phase 1 | Text + Image content | Current                |
| Phase 2 | Video transcription  | After Phase 1 complete |
| Phase 3 | AI Q&A               | After Phase 2 complete |

---

*Document created: December 2025*
*Last updated: December 2025*

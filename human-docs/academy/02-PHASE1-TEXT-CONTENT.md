# VolSpike Academy - Phase 1: Text Content Processing

**Status**: Active
**Scope**: .docx files with embedded images only (no video)

---

## Objective

Process text documents (.docx) from 6 analysts to build the initial VolSpike Academy curriculum. Each document contains:

- Written trading lessons and explanations
- Embedded TradingView charts with annotations
- Visual examples that complement the text

**Critical**: Images are NOT decorative - they contain annotated charts that are essential to understanding the lessons.

---

## Content Inventory (Completed)

**Source Path**: `/Users/nikolaysitnikov/Documents/Documents_Nik_MacBook/Everyday Life/AI/VolumeFunding/Whop VolSpike Academy`

### Files Per Analyst

| Analyst   | .docx Files | Files with Images | Total Images |
| --------- | ----------- | ----------------- | ------------ |
| CBS       | 69          | 6                 | 16           |
| Krillin   | 54          | 15                | 32           |
| Loma      | 42          | 13                | 22           |
| Mayne     | 35          | 8                 | 25           |
| Pierre    | 30          | 18                | 48           |
| UB        | 73          | 19                | 22           |
| **TOTAL** | **303**     | **79**            | **165**      |

### Folder Structure

**CBS** (69 docs):

- Chapter 1 - Introduction to the System, Building out Ideas, Risk Management
- Chapter 2 - Attacking the Market, Swing Trading Tips
- Chapter 3 - Market Structure, Options & Scalping Content, Trade Reviews
- Psychology Education

**Krillin** (54 docs):

- Chapter 1 - Introduction to the System, Planning, Managing Risk & Execution Tips
- Chapter 2 - The MA EMA System
- Chapter 3 - Positioning, Strategy & Scalping Considerations
- Psychology
- Others (Fibonacci, OI)

**Loma** (42 docs):

- Chapter 1 - Introduction to System, Market Structure Basics, General Risk Management
- Chapter 2 - Funding, Setups, Patterns
- Chapter 3 - Advanced System Teachings, Scalping, Trade Recaps
- Macro Event Planning - 2022 Example
- Psychology

**Mayne** (35 docs):

- Chapter 1 - Introduction to System, PA Basics
- Chapter 2 - Revamped PA Course
- Chapter 3 - Trading Techniques & Strategies, Execution
- Chapter 4 - Backtesting, Case Studies, Trade Reviews

**Pierre** (30 docs):

- Chapter 1 - Introduction to the System, Risk Management, FAQs
- Chapter 2 - Nuances & Execution Tips
- Chapter 3 - Setups, Reversals, Compressions
- Chapter 4 - Psychology, System Discussion, Trade Reviews

**UB** (73 docs):

- Chapter 1 - Introduction to PA & Range Concepts
- Chapter 2 - Setups, Execution
- Chapter 3 - System Explained - Trade Reviews. Entry, Invalidation, TPs
- Candle Pattern Mastery
- Emotional and Psychological Mastery
- Options Content

### Files to Ignore

These helper files exist in each analyst folder and should be excluded:

- `Contents.html`
- `create_docx.py`
- `output.txt`
- `parse_contents.py`
- `~$*.docx` (temp files)

---

## Step 2: Document Processing Pipeline

### 2.1 Extract Content from .docx

For each document:

1. **Extract text** - Preserve headings, paragraphs, lists
2. **Extract images** - Save as separate files (PNG/JPG)
3. **Map image positions** - Track where each image appears in text flow
4. **Preserve structure** - Maintain document hierarchy

**Tool**: `mammoth` (Node.js) or `python-docx` (Python)

### 2.2 Image Analysis (Critical)

Each extracted image must be analyzed by a vision-capable LLM (Claude) to extract:

1. **Chart Type**: Candlestick, line, volume bars, etc.
2. **Timeframe**: 1m, 5m, 1h, 4h, daily, etc.
3. **Asset**: BTC, ETH, specific futures contract
4. **Annotations**:
   - Trend lines drawn
   - Support/resistance levels marked
   - Entry/exit points indicated
   - Text callouts and labels
5. **Key Observations**: What the chart is demonstrating
6. **Relation to Text**: How it connects to surrounding content

### 2.3 Processing Output Structure

```
processed/
├── manifest.json           # Master index
├── content/
│   ├── {id}/
│   │   ├── metadata.json   # Document metadata
│   │   ├── content.md      # Extracted text as markdown
│   │   ├── images/
│   │   │   ├── img-001.png
│   │   │   ├── img-001-analysis.json  # LLM analysis
│   │   │   ├── img-002.png
│   │   │   └── img-002-analysis.json
│   │   └── combined.json   # Text + image analysis merged
│   └── ...
```

### 2.4 Metadata Schema

```json
{
  "id": "unique-id",
  "sourceFile": "path/to/original.docx",
  "analyst": "analyst-folder-name",
  "title": "Document Title",
  "wordCount": 1500,
  "imageCount": 5,
  "extractedAt": "2025-12-21T00:00:00Z",
  "topics": ["volume-analysis", "trend-lines"],
  "difficulty": "intermediate",
  "summary": "2-3 paragraph summary",
  "keyTakeaways": ["bullet", "points"],
  "images": [
    {
      "id": "img-001",
      "position": "after-paragraph-3",
      "filename": "img-001.png",
      "analysis": {
        "chartType": "candlestick",
        "timeframe": "4h",
        "asset": "BTCUSDT",
        "annotations": ["support line at 42000", "entry arrow"],
        "description": "Shows breakout above resistance with volume confirmation"
      }
    }
  ]
}
```

---

## Step 3: Content Analysis & Organization

### 3.1 LLM Summarization

For each processed document, Claude generates:

1. **Summary**: 2-3 paragraphs explaining the content
2. **Key Takeaways**: 3-5 bullet points
3. **Prerequisites**: What learner should know first
4. **Topics Covered**: Standardized topic tags
5. **Difficulty**: beginner / intermediate / advanced
6. **Image Integration Notes**: How charts support the lesson

### 3.2 Topic Taxonomy Generation

After processing all documents, generate a topic hierarchy:

```
Trading Fundamentals
├── Market Basics
│   ├── Order Types
│   ├── Reading Charts
│   └── Timeframes
├── Technical Analysis
│   ├── Support/Resistance
│   ├── Trend Lines
│   ├── Chart Patterns
│   └── Indicators
├── Volume Analysis
│   ├── Volume Spikes
│   ├── Volume Profile
│   └── Delta Analysis
├── Open Interest
│   ├── OI Basics
│   └── OI Divergences
└── Trade Execution
    ├── Entry Strategies
    ├── Risk Management
    └── Position Sizing
```

### 3.3 Deduplication

1. Generate embeddings for each document summary
2. Find semantic clusters (similar content)
3. For each cluster:
   - Identify best explanation
   - Note unique perspectives
   - Mark true duplicates
4. Present clusters for your review

---

## Step 4: Curriculum Design

### 4.1 Learning Path Proposal

LLM proposes structured learning paths:

```
Path 1: Complete Beginner
├── Module 1: What is Trading? (3 lessons)
├── Module 2: Understanding Charts (5 lessons)
├── Module 3: Basic Analysis (4 lessons)
└── Module 4: Your First Trades (3 lessons)

Path 2: Intermediate Trader
├── Module 1: Advanced Chart Patterns (6 lessons)
├── Module 2: Volume Analysis Intro (5 lessons)
└── Module 3: Building a System (4 lessons)

Path 3: Volume Specialist (VolSpike Focus)
├── Module 1: Volume Fundamentals (4 lessons)
├── Module 2: Detecting Spikes (5 lessons)
├── Module 3: OI & Funding Rates (4 lessons)
└── Module 4: Putting It Together (3 lessons)
```

### 4.2 Your Review

For each proposed module:

- Review included content
- Approve, reject, or rearrange
- Flag gaps needing new content
- Adjust difficulty progression

### 4.3 Content Transformation

Once approved:

1. Rewrite for consistent voice (anonymous VolSpike brand)
2. Create module introductions
3. Add transitions between lessons
4. Generate quiz questions

---

## Step 5: Database & Backend

### 5.1 Prisma Schema Additions

```prisma
model AcademyLesson {
  id            String   @id @default(cuid())
  title         String
  slug          String   @unique
  content       String   @db.Text
  summary       String   @db.Text
  difficulty    String   // beginner, intermediate, advanced
  topics        String[]
  order         Int
  moduleId      String
  isFree        Boolean  @default(false) // Freemium gating
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  module        AcademyModule @relation(fields: [moduleId], references: [id])
  images        AcademyImage[]
  progress      UserLessonProgress[]
}

model AcademyImage {
  id            String   @id @default(cuid())
  lessonId      String
  filename      String
  url           String   // CDN URL after upload
  position      Int      // Order in lesson
  altText       String
  analysis      Json     // LLM analysis of chart

  lesson        AcademyLesson @relation(fields: [lessonId], references: [id])
}

model AcademyModule {
  id            String   @id @default(cuid())
  title         String
  slug          String   @unique
  description   String
  order         Int
  pathId        String

  path          LearningPath @relation(fields: [pathId], references: [id])
  lessons       AcademyLesson[]
}

model LearningPath {
  id            String   @id @default(cuid())
  title         String
  slug          String   @unique
  description   String
  difficulty    String
  isFree        Boolean  @default(false)

  modules       AcademyModule[]
}

model UserLessonProgress {
  id            String    @id @default(cuid())
  userId        String
  lessonId      String
  completed     Boolean   @default(false)
  completedAt   DateTime?

  user          User      @relation(fields: [userId], references: [id])
  lesson        AcademyLesson @relation(fields: [lessonId], references: [id])

  @@unique([userId, lessonId])
}
```

### 5.2 API Endpoints

```
GET  /api/academy/paths              # List learning paths
GET  /api/academy/paths/:slug        # Path detail with modules
GET  /api/academy/lessons/:slug      # Lesson content
POST /api/academy/progress/:lessonId # Mark lesson complete
GET  /api/academy/my-progress        # User's progress summary
```

---

## Step 6: Frontend Implementation

### 6.1 Pages

```
/academy                     # Landing page
/academy/path/[slug]         # Learning path detail
/academy/lesson/[slug]       # Individual lesson
/academy/progress            # User's progress dashboard
```

### 6.2 Key Components

- `LearningPathCard` - Path overview with progress
- `ModuleAccordion` - Expandable module list
- `LessonContent` - Markdown renderer with images
- `ChartImage` - Image with hover analysis tooltip
- `ProgressBar` - Visual completion indicator
- `LessonNav` - Previous/Next navigation

### 6.3 Tier Gating

```typescript
// Check if lesson is accessible
const canAccess = lesson.isFree || user.tier !== 'FREE'

// Show upgrade prompt for locked content
if (!canAccess) {
  return <UpgradePrompt feature="academy-advanced" />
}
```

---

## Image Strategy

### Critical: Original Images Cannot Be Reused

**The source document images are copyrighted TradingView charts and cannot be published in the Academy.** Image analysis is performed to capture metadata for future reference, but the original images will NOT be displayed.

### Current Approach

1. **Extract & Analyze** - Images are extracted and analyzed by Claude Vision to capture:
   - Chart type, timeframe, asset
   - Annotations (trend lines, support/resistance, entry/exit points)
   - Key observations and teaching purpose

2. **Store Metadata** - Analysis is saved in `AcademyImage` database records and JSON files

3. **Strip from Display** - Image markdown (`![...]()`) is removed from lesson content in the frontend

4. **Future: Create Replacements** - Options include:
   - AI-generated educational diagrams based on analysis descriptions
   - Designer-created simplified charts using analysis as specifications
   - Generic educational graphics that convey the same concepts
   - Stock trading images with appropriate licensing

### Database Model

The `AcademyImage` model stores analysis metadata for future image recreation:
```prisma
model AcademyImage {
  id        String @id @default(cuid())
  lessonId  String
  filename  String
  position  Int
  altText   String
  analysis  Json   // Chart type, timeframe, annotations, observations
}
```

### Image Hosting (For Future Replacement Images)

Options when replacement images are created:

1. **Vercel Blob** - Simple, integrated with Next.js
2. **Cloudinary** - Free tier, image optimization
3. **S3 + CloudFront** - Most control, more setup

**Recommendation**: Cloudinary for free tier + automatic optimization

---

## Processing Scripts Location

Create processing scripts in a new folder:

```
volspike-academy-tools/
├── package.json
├── src/
│   ├── extract-docx.ts      # Extract text + images
│   ├── analyze-images.ts    # Send images to Claude
│   ├── summarize-content.ts # Generate summaries
│   ├── build-taxonomy.ts    # Create topic hierarchy
│   ├── deduplicate.ts       # Find similar content
│   └── import-to-db.ts      # Load into Prisma
└── output/                  # Processed content
```

---

## Implementation Steps

### Step 1: Build Processing Pipeline (Python)

Create `volspike-academy-tools/` with scripts to:

1. **extract_docx.py** - Extract text + images from .docx files
   
   - Use `python-docx` library
   - Preserve paragraph structure
   - Extract images to separate folder
   - Track image positions in document flow

2. **analyze_content.py** - Send to Claude for analysis
   
   - Text summarization
   - Image analysis (charts with annotations)
   - Topic tagging
   - Difficulty assessment

3. **build_curriculum.py** - Organize into learning paths
   
   - Cluster similar content
   - Identify duplicates
   - Propose module structure
   - Generate for your review

### Step 2: Content Review Workflow

1. Process all 303 documents
2. Generate JSON manifest with summaries
3. You review proposed curriculum structure
4. Adjust, approve, or reject
5. Final content transformation

### Step 3: Database + Frontend

1. Add Prisma models for Academy
2. Import processed content
3. Build Academy pages
4. Implement progress tracking

---

## Cost Estimate (Phase 1 Only)

| Service                     | Usage      | Cost    |
| --------------------------- | ---------- | ------- |
| Claude API (image analysis) | 165 images | ~$5-8   |
| Claude API (summarization)  | 303 docs   | ~$15-20 |
| Cloudinary                  | Free tier  | $0      |

**Total Phase 1: ~$20-30**

---

## Immediate Next Step

Build the Python processing pipeline to:

1. Extract all 303 documents
2. Analyze 165 embedded images
3. Generate structured JSON output for review

---

*Document created: December 2025*
*Inventory completed: December 2025*

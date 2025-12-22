# VolSpike Academy - Test Pilot (Proof of Concept)

**Status**: Ready to Execute
**Scope**: 12 sample .docx files (2 per analyst) to validate the full pipeline

---

## Purpose

Validate the entire Academy content pipeline on a small sample before processing all 303 documents. This test will:

1. Confirm .docx extraction works correctly
2. Validate image analysis produces useful output
3. Test LLM summarization quality
4. Verify curriculum organization approach
5. Estimate actual costs for full processing

---

## Test Dataset

**12 files selected** (2 per analyst, mix of with/without images)

| Analyst | File | Images |
|---------|------|--------|
| CBS | Chapter 3/.../11 - Case Study - Using Equities Market to Build a Thought Process.docx | 5 |
| CBS | Psychology Education/17 - Psych - How Renko Can Cure FOMO.docx | 0 |
| Krillin | Others/2 - Fibonacci Examples.docx | 5 |
| Krillin | Chapter 3/.../8 - How to Play New Listings.docx | 0 |
| Loma | Psychology/2 - Psych - Context and Perspective.docx | 5 |
| Loma | Chapter 1/.../2 - 5 Tips To Help You Grow a Small Trading Portfolio.docx | 0 |
| Mayne | Chapter 4/.../9 - Trade Recap - Gold Short - H1-H12.docx | 2 |
| Mayne | Chapter 3/.../7 - How to Maximize Profits in Price Discovery.docx | 0 |
| Pierre | Chapter 1/.../9 - Simplified Approach to Trade Management.docx | 2 |
| Pierre | Chapter 4/.../2 - BTC Trade Review - H4 EMA-MA Long - Aug 3, 2025.docx | 0 |
| UB | Chapter 2/.../3 - Daily Open V Pattern.docx | 1 |
| UB | Emotional and Psychological Mastery/1 - Round Tripping Profits.docx | 0 |

**Totals**: 12 files, 20 images

---

## Test Pipeline Steps

### Step 1: Extract Content

For each of the 12 files:
- Extract all text preserving structure
- Extract all embedded images
- Map image positions in document flow
- Save to structured output folder

**Output**:
```
test-output/
├── manifest.json
├── CBS/
│   ├── 11-case-study-equities/
│   │   ├── content.md
│   │   ├── metadata.json
│   │   └── images/
│   │       ├── image1.png
│   │       ├── image2.png
│   │       └── ...
│   └── 17-renko-fomo/
│       ├── content.md
│       └── metadata.json
├── Krillin/
│   └── ...
└── ...
```

### Step 2: Analyze Images (20 total)

Send each image to Claude Vision with prompt:
```
Analyze this TradingView chart image. Extract:
1. Chart type (candlestick, line, etc.)
2. Timeframe visible (1m, 5m, 1h, 4h, daily, etc.)
3. Asset/symbol if visible
4. All annotations (trend lines, support/resistance, arrows, text labels)
5. Key observation - what is this chart demonstrating?
6. How does this chart support a trading lesson?

Return as structured JSON.
```

**Output**: `image-analysis.json` for each image

### Step 3: Summarize Content (12 docs)

Send each document (text + image analyses) to Claude with prompt:
```
Analyze this trading education content. Return:
1. Summary (2-3 paragraphs)
2. Key takeaways (3-5 bullet points)
3. Prerequisites (what should learner know first)
4. Topics covered (standardized tags)
5. Difficulty level (beginner/intermediate/advanced)
6. Teaching style notes

The content includes [N] chart images. The image analyses are provided.
Explain how the charts support the lesson.

Return as structured JSON.
```

**Output**: `summary.json` for each document

### Step 4: Propose Mini-Curriculum

Given all 12 summaries, have Claude propose:
- Logical grouping into modules
- Suggested learning order
- Identified topic overlaps
- Difficulty progression

**Output**: `curriculum-proposal.json`

### Step 5: Review & Evaluate

You review the outputs and evaluate:
- [ ] Text extraction quality
- [ ] Image analysis accuracy
- [ ] Summary usefulness
- [ ] Topic tagging consistency
- [ ] Curriculum proposal logic
- [ ] Overall approach viability

---

## Success Criteria

| Criterion | Pass | Fail |
|-----------|------|------|
| Text extraction | Readable, structured markdown | Garbled or missing content |
| Image extraction | All images saved correctly | Missing or corrupted images |
| Image analysis | Accurately describes charts | Misses key annotations |
| Summarization | Captures main teaching points | Generic or inaccurate |
| Topic tagging | Consistent, useful categories | Random or unhelpful tags |
| Curriculum | Logical groupings suggested | Nonsensical organization |

---

## Estimated Cost (Test Only)

| Service | Usage | Cost |
|---------|-------|------|
| Claude API (image analysis) | 20 images | ~$0.50-1.00 |
| Claude API (summarization) | 12 docs | ~$0.50-1.00 |
| Claude API (curriculum) | 1 call | ~$0.10 |

**Total Test Cost: ~$1-2**

---

## Implementation

### Option A: Python Scripts (Recommended)

Create `volspike-academy-tools/` with:
```
volspike-academy-tools/
├── requirements.txt
├── config.py              # API keys, paths
├── extract_docx.py        # Step 1
├── analyze_images.py      # Step 2
├── summarize_content.py   # Step 3
├── propose_curriculum.py  # Step 4
├── run_test.py            # Orchestrate all steps
└── test-output/           # Results
```

### Option B: Single Script

One Python script that does everything in sequence, outputting to a single JSON file for review.

---

## File Paths (Full)

```
CBS/Chapter 3 - Market Structure, Options & Scalping Content, Trade Reviews/11 - Case Study - Using Equities Market to Build a Thought Process.docx
CBS/Psychology Education/17 - Psych - How Renko Can Cure FOMO.docx
Krillin/Others/2 - Fibonacci Examples.docx
Krillin/Chapter 3 - Positioning, Strategy & Scalping Considerations/8 - How to Play New Listings.docx
Loma/Psychology/2 - Psych - Context and Perspective.docx
Loma/Chapter 1 - Introduction to System, Market Structure Basics, General Risk Management/2 - 5 Tips To Help You Grow a Small Trading Portfolio.docx
Mayne/Chapter 4 - Backtesting, Case Studies, Trade Reviews/9 - Trade Recap - Gold Short - H1-H12.docx
Mayne/Chapter 3 - Trading Techniques & Strategies, Execution/7 - How to Maximize Profits in Price Discovery.docx
Pierre/Chapter 1 - Introduction to the System, Risk Management, FAQs/9 - Simplified Approach to Trade Management.docx
Pierre/Chapter 4 - Psychology, System Discussion, Trade Reviews/2 - BTC Trade Review - H4 EMA-MA Long - Aug 3, 2025.docx
UB/Chapter 2 - Setups, Execution/3 - Daily Open V Pattern.docx
UB/Emotional and Psychological Mastery/1 - Round Tripping Profits.docx
```

---

## Next Steps

1. **Approve test plan** - Confirm sample selection is good
2. **Build extraction script** - Start with Step 1
3. **Run test** - Process 12 files
4. **Review output** - Evaluate quality
5. **Iterate or proceed** - Adjust approach or scale up

---

*Document created: December 2025*

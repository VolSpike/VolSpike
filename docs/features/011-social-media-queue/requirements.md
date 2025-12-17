# Feature 011: Social Media Queue for Twitter/X Posting

## Purpose

Enable the admin to convert volume spike alerts into shareable social media images and queue them for posting to Twitter/X, driving brand awareness and user acquisition for VolSpike.

### Problem Statement

VolSpike generates valuable real-time volume spike alerts (e.g., "ACT 6.55x volume spike") that would serve as excellent marketing content on Twitter/X. Currently:
- No way to share these alerts as images
- No workflow to review/approve content before posting
- Manual screenshot process is time-consuming
- Risk of posting low-quality or duplicate alerts

### Business Value

- **User Acquisition**: Attract crypto traders interested in volume spikes
- **Brand Authority**: Position VolSpike as a real-time market data provider
- **SEO/Discovery**: Searchable tweets with relevant hashtags
- **Engagement**: Visual alert cards are more shareable than text
- **Competitive Advantage**: Automated but controlled social media presence

## Scope

### In Scope

1. **Image Generation**
   - Convert alert cards to high-quality PNG images
   - Preserve styling, colors, and branding
   - Support both Volume and Open Interest alerts

2. **Admin Queue Management**
   - Add alerts to queue from admin dashboard
   - Preview generated images before posting
   - Edit tweet captions and hashtags
   - Approve or reject queued posts
   - Track posting history

3. **Twitter API Integration**
   - Post tweet with image via Twitter API v2
   - Handle rate limits and errors gracefully
   - Store API credentials securely in environment variables

4. **Duplicate Prevention**
   - Track which alerts have been posted
   - Prevent re-posting the same alert
   - Show "Already Posted" status on alert cards

### Out of Scope (Future Enhancements)

- Fully automated posting without review
- Multi-image carousel posts
- Scheduled posting (post at specific time)
- Analytics tracking (impressions, engagement)
- Support for other platforms (Instagram, LinkedIn, Facebook)
- Video generation
- AI-generated captions

## User Stories

### Story 1: Generate Tweet Image

**As an** admin
**I want to** click a button on an alert card to generate a tweet image
**So that** I can quickly create shareable content without manual screenshots

**Acceptance Criteria:**
- "Add to Twitter Queue" button appears on each alert card in admin view
- Clicking button generates PNG image of the alert card
- Image preserves exact styling (colors, fonts, spacing)
- Image resolution is optimal for Twitter (1200x675px or similar)
- Success notification appears when added to queue
- Button shows "Already Queued" if alert is already in queue

### Story 2: Review and Edit Queued Posts

**As an** admin
**I want to** review queued posts before they go live
**So that** I can ensure quality and control brand voice

**Acceptance Criteria:**
- New "Social Media" section in admin dashboard
- Queue shows all pending posts with:
  - Generated image preview
  - Suggested caption (auto-generated)
  - Editable text field for caption
  - Character count (280 limit)
  - Timestamp of alert
- Ability to edit caption and hashtags
- "Post Now" button to publish immediately
- "Reject" button to remove from queue
- Queue items sorted by newest first

### Story 3: Post to Twitter

**As an** admin
**I want to** click "Post Now" to publish approved content
**So that** the tweet goes live on the VolSpike Twitter account

**Acceptance Criteria:**
- "Post Now" button calls Twitter API v2
- Tweet includes both image and caption text
- Success notification on successful post
- Error message if API fails (with reason)
- Posted tweet moves to "History" section
- Alert card shows "Posted to Twitter" badge
- Link to published tweet appears in history

### Story 4: Track Posting History

**As an** admin
**I want to** see which alerts have been posted
**So that** I avoid duplicates and track content performance

**Acceptance Criteria:**
- "History" tab in Social Media section
- Shows last 100 posted tweets with:
  - Alert details (symbol, spike multiplier)
  - Posted timestamp
  - Link to Twitter post
  - Image preview
- Ability to view tweet on Twitter (opens in new tab)
- Search/filter by symbol or date

## Constraints

### Technical Constraints

1. **Twitter API Limits**
   - Free tier: 50 tweets per day
   - Elevated tier (recommended): 100 tweets per day
   - Must handle rate limit errors gracefully

2. **Image Generation**
   - Must work server-side (Puppeteer) OR client-side (html2canvas)
   - Image file size should be < 5MB (Twitter limit)
   - Optimal dimensions: 1200x675px (16:9 aspect ratio)

3. **Database**
   - New Prisma model required for social media queue
   - Relationship to existing VolumeAlert or OpenInterestAlert models
   - Store image URLs (could use temporary storage or base64)

4. **Authentication**
   - Only admin role can access this feature
   - Twitter API credentials stored in `.env` (never commit)

### Business Constraints

1. **Manual Approval Required**
   - All posts must be manually approved by admin
   - No auto-posting in initial version (reduces spam risk)

2. **Content Quality**
   - Only post alerts that meet quality threshold:
     - Volume spike ≥ 5x (configurable)
     - Open Interest spike ≥ 3% in 5min (configurable)
   - Avoid posting too frequently (max 10 per day recommended)

3. **Brand Voice**
   - Captions should be factual, not hype-driven
   - Include relevant hashtags: #crypto #altcoin #volspike
   - Avoid spam-like language

## Acceptance Criteria (Overall Feature)

### Must Have

- [ ] Admin can generate images from alert cards
- [ ] Admin can review queued posts before publishing
- [ ] Admin can edit captions and hashtags
- [ ] Admin can post to Twitter via API
- [ ] Posted alerts are tracked to prevent duplicates
- [ ] Twitter API errors are handled gracefully
- [ ] Only admin role has access to this feature

### Nice to Have

- [ ] Suggested captions are generated automatically
- [ ] Image quality is optimized for social media
- [ ] Queue shows estimated character count
- [ ] Posting history includes link to live tweet

### Won't Have (V1)

- Scheduled posting
- Analytics dashboard
- Multi-platform support
- AI-generated captions

## Non-Functional Requirements

### Performance

- Image generation should complete in < 5 seconds
- Queue page should load in < 2 seconds
- Posting to Twitter should complete in < 10 seconds

### Security

- Twitter API credentials stored in environment variables
- Never expose API keys in client-side code
- Validate admin role on all endpoints
- Sanitize user-edited captions to prevent injection

### Reliability

- Handle Twitter API downtime gracefully
- Retry failed posts with exponential backoff
- Log all posting attempts for debugging

### Usability

- Clear visual feedback for all actions
- Error messages are actionable
- Queue UI is intuitive and easy to navigate

## Success Metrics

- **Adoption**: Admin uses feature to post ≥ 5 tweets per week
- **Efficiency**: Reduces time to create social post from 5 minutes to 30 seconds
- **Quality**: Zero spam complaints or low-quality posts
- **Growth**: Twitter followers increase by 10% month-over-month

## Dependencies

- Twitter API v2 credentials (requires Twitter Developer account)
- Image generation library (html2canvas or Puppeteer)
- Existing admin dashboard infrastructure
- Existing alert detection system (Digital Ocean scripts)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Twitter API changes/breaks | High | Abstract API calls into service layer, easy to swap |
| Rate limit exceeded | Medium | Track daily post count, warn admin before limit |
| Poor image quality | Medium | Test on multiple devices, allow manual upload fallback |
| Duplicate posts | Low | Track posted alerts in database |
| API credentials leaked | High | Use .env, never commit, rotate keys regularly |

## Timeline Estimate

- **Documentation**: 1 hour (this file)
- **Implementation**: 4-6 hours
- **Testing**: 1-2 hours
- **Total**: ~6-9 hours for full feature

## Open Questions

1. Should we support Open Interest alerts or only Volume alerts initially?
   - **Recommendation**: Start with Volume alerts only (simpler), add OI later

2. What's the default caption format?
   - **Recommendation**: "{emoji} {SYMBOL} volume spike: {ratio}x in {timeframe}! ${currentVolume} this hour vs ${previousVolume} last hour. Price: {priceChange}% #crypto #altcoin #volspike"

3. Should images include VolSpike logo/branding?
   - **Recommendation**: Yes, add small logo in corner for brand recognition

4. Where to store generated images?
   - **Recommendation**: Temporary in-memory or Railway temp storage (auto-cleanup)

5. Should we include disclaimer text on images?
   - **Recommendation**: Not necessary initially, focus on clean design

## References

- Twitter API v2 Documentation: https://developer.twitter.com/en/docs/twitter-api
- html2canvas Library: https://html2canvas.hertzen.com/
- Existing Admin Dashboard: `volspike-nextjs-frontend/src/app/admin/*`
- Alert Detection: `Digital Ocean/hourly_volume_alert_dual_env.py`

# Implement Feature Command

You are implementing a new feature following Spec Driven Development and Test Driven Development principles.

## Process Overview

Follow these steps in order:

### 1. Create Feature Documentation Folder

Create a new folder in `docs/features/` with format: `NNN-feature-name/` where NNN is the next sequential number (e.g., `001-user-profile/`, `002-dark-mode/`, etc.).

Inside this folder, create three documentation files:

#### requirements.md
- **Purpose**: What problem does this solve? What are the user needs?
- **Scope**: What is included and excluded?
- **User Stories**: As a [role], I want [feature], so that [benefit]
- **Acceptance Criteria**: How do we know it's complete?
- **Constraints**: Technical or business limitations

#### design.md
- **Architecture**: High-level component structure
- **Data Models**: Database schema changes (if any)
- **API Contracts**: Endpoints, request/response formats
- **UI/UX**: Wireframes, user flows, component hierarchy
- **Security Considerations**: Authentication, authorization, validation
- **Performance Considerations**: Caching, optimization strategies
- **Technology Choices**: Libraries, frameworks, justification

#### steps.md
- **Implementation Steps**: Ordered checklist of tasks
- **Dependencies**: What needs to be done first?
- **Testing Strategy**: Unit tests, integration tests, E2E tests
- **Rollout Plan**: How will this be deployed?
- **Rollback Plan**: How to revert if needed?

### 2. Review Documentation with User

Present the three documents to the user for approval. Wait for confirmation before proceeding.

### 3. Test Driven Development

For each implementation step:

1. **Write the test first** (Red phase)
   - Unit tests for functions/utilities
   - Integration tests for API endpoints
   - Component tests for React components
   - E2E tests for critical user flows

2. **Implement minimum code to pass** (Green phase)
   - Write the simplest code that makes tests pass
   - Follow existing code patterns in the project
   - Adhere to TypeScript strict typing

3. **Refactor and improve** (Refactor phase)
   - Clean up code while keeping tests green
   - Apply DRY principles
   - Optimize for readability and performance

### 4. Implementation Guidelines

Follow the project's architecture principles from CLAUDE.md and AGENTS.md:

#### Frontend (Next.js)
- Use TypeScript with proper typing
- Follow App Router patterns
- Use `export const dynamic = 'force-dynamic'` for routes using cookies/headers
- Wrap components with `<SessionProvider>` if using `useSession`
- Use Tailwind CSS and shadcn/ui components
- Client-side data fetching for market data
- NO emojis unless explicitly requested

#### Backend (Node.js + Hono)
- Only for auth, payments, and volume alerts
- Use Hono framework
- Implement proper error handling
- Use Prisma ORM for database
- Validate with Zod schemas
- NO market data processing (client-side only)

#### Security Checklist
- [ ] Input validation with Zod
- [ ] Authentication checks
- [ ] Authorization (role-based access)
- [ ] Rate limiting where needed
- [ ] SQL injection prevention (use Prisma)
- [ ] XSS prevention (proper escaping)

#### Testing Checklist
- [ ] Unit tests written and passing
- [ ] Integration tests for APIs
- [ ] Component tests for UI
- [ ] TypeScript type checking passes
- [ ] Build succeeds without errors
- [ ] No console errors or warnings
- [ ] Tested across user tiers (guest, free, pro, elite, admin)

### 5. Documentation Updates

After implementation:
- Update steps.md with ✅ for completed items
- Document any deviations from original design
- Add usage examples in the feature docs
- Update main AGENTS.md if architecture changed

### 6. Commit Strategy

Use conventional commits:
```
feat(scope): brief description

Longer description if needed

Closes #issue-number
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### 7. Final Checklist

Before marking feature complete:
- [ ] All tests passing
- [ ] Documentation complete
- [ ] Code reviewed (self-review at minimum)
- [ ] TypeScript strict mode passes
- [ ] Build succeeds
- [ ] No security vulnerabilities
- [ ] Feature works for all user tiers
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Accessibility considerations addressed

## Example Usage

User: "Implement dark mode toggle"

Response:
1. Create `docs/features/001-dark-mode/`
2. Write `requirements.md` (user needs dark mode for eye comfort)
3. Write `design.md` (Tailwind dark: classes, localStorage persistence)
4. Write `steps.md` (add toggle, implement theme provider, test)
5. Present to user for approval
6. Write tests for theme hook
7. Implement theme provider
8. Write tests for toggle component
9. Implement toggle component
10. Update layout to use theme
11. Test across all pages
12. Commit with `feat(ui): Add dark mode toggle with persistence`

## Important Notes

- **Wait for user approval** after documentation phase
- **Write tests BEFORE implementation** (TDD)
- **Follow existing patterns** in the codebase
- **Security first** - validate all inputs
- **Type safety** - no `any` types without justification
- **User tiers** - respect free/pro/elite access levels
- **No emojis** unless user explicitly requests them

## Getting Started

What feature would you like to implement? Please describe:
1. The feature name
2. The problem it solves
3. Who will use it (user tier/role)
4. Any specific requirements or constraints

// Cursor Rules Templates - Modern .mdc format with metadata

export interface CursorRule {
  filename: string;
  content: string;
}

export const CURSOR_RULES_TEMPLATES: CursorRule[] = [
  {
    filename: "code-style.mdc",
    content: `---
name: "Code Style & Formatting Standards"
description: "TypeScript, JavaScript, and React coding style guidelines"
applyMode: "always"
filePatterns: ["*.ts", "*.tsx", "*.js", "*.jsx", "*.vue", "*.svelte"]
---

# Code Style & Formatting Standards

## General Principles
- Use consistent indentation (2 spaces for JS/TS/React, 4 spaces for Python)
- Maximum line length: 100 characters
- Use meaningful variable and function names that clearly express intent
- Prefer explicit over implicit code
- Write self-documenting code with clear naming conventions

## TypeScript/JavaScript
- Use TypeScript for all new projects
- Enable strict mode in TypeScript configuration
- Use interfaces for object shapes, types for unions/primitives
- Prefer const assertions and readonly where appropriate
- Use optional chaining (?.) and nullish coalescing (??) operators
- Import organization: external libraries first, then internal modules
- Use arrow functions for callbacks and short functions
- Prefer template literals over string concatenation

## React Specific
- Use functional components with hooks
- Custom hooks should start with 'use' prefix
- Prefer composition over inheritance
- Use proper key props in lists
- Handle loading and error states explicitly
- Use React.memo() for expensive components
- Keep components small and focused on single responsibility

## CSS & Styling
- Use CSS-in-JS or CSS modules for component styling
- Follow BEM methodology for class naming
- Use semantic color names and design tokens
- Prefer flexbox and grid over floats
- Use relative units (rem, em) over absolute pixels where appropriate
`,
  },

  {
    filename: "architecture.mdc",
    content: `---
name: "Architecture & Patterns"
description: "File organization, state management, and architectural patterns"
applyMode: "always"
filePatterns: ["*.ts", "*.tsx", "*.js", "*.jsx"]
---

# Architecture & Patterns

## File Organization
- Group related files in feature-based directories
- Use index.ts files for clean exports
- Separate concerns: components, hooks, utils, types
- Keep configuration files at project root
- Use absolute imports with path mapping

## State Management
- Use React Context for app-wide state
- Prefer local state (useState/useReducer) when possible
- Use state management libraries (Redux/Zustand) for complex state
- Keep state as close to where it's used as possible
- Normalize complex nested state structures

## Error Handling
- Use proper error boundaries in React
- Handle async errors with try/catch blocks
- Provide meaningful error messages to users
- Log errors for debugging but don't expose internals
- Use custom error classes for different error types

## Component Design
- Single Responsibility Principle: one component, one purpose
- Prop drilling should not exceed 2-3 levels
- Use composition patterns for complex UI
- Implement proper loading and error states
- Make components reusable and configurable
`,
  },

  {
    filename: "testing.mdc",
    content: `---
name: "Testing Standards"
description: "Unit testing, integration testing, and test organization guidelines"
applyMode: "auto-attach"
filePatterns: ["*.test.ts", "*.test.tsx", "*.spec.ts", "*.spec.tsx", "**/__tests__/**"]
---

# Testing Standards

## Unit Testing
- Write tests for all business logic
- Use descriptive test names that explain the scenario
- Follow AAA pattern: Arrange, Act, Assert
- Mock external dependencies
- Test edge cases and error conditions
- Maintain at least 80% code coverage

## Integration Testing
- Test component integration with React Testing Library
- Test API endpoints with real HTTP calls
- Use test databases for data layer testing
- Test user workflows end-to-end

## Test Organization
- Keep tests close to the code they test
- Use consistent naming: \`component.test.ts\`
- Group related tests with describe blocks
- Use beforeEach/afterEach for test setup/cleanup

## Testing Best Practices
- Test behavior, not implementation details
- Use data-testid for reliable element selection
- Mock at the boundary (API calls, external services)
- Write tests that would catch real bugs
- Keep tests fast and independent
`,
  },

  {
    filename: "security.mdc",
    content: `---
name: "Security Guidelines"
description: "Input validation, API security, and data protection standards"
applyMode: "auto-attach"
filePatterns: ["*.ts", "*.tsx", "*.js", "*.jsx", "**/api/**", "**/auth/**"]
---

# Security Guidelines

## Input Validation
- Validate all user inputs on both client and server
- Sanitize data before displaying in UI
- Use parameterized queries for database operations
- Implement proper authentication and authorization
- Never store sensitive data in client-side code

## API Security
- Use HTTPS for all communications
- Implement rate limiting on API endpoints
- Validate request bodies and query parameters
- Use proper CORS configuration
- Implement proper session management
- Use JWT tokens with proper expiration
- Sanitize all inputs to prevent XSS attacks

## Data Protection
- Encrypt sensitive data at rest and in transit
- Use environment variables for secrets
- Implement proper password hashing (bcrypt, scrypt)
- Follow principle of least privilege
- Log security events for monitoring
- Regular security dependency updates
`,
  },

  {
    filename: "performance.mdc",
    content: `---
name: "Performance Standards"
description: "Frontend and backend performance optimization guidelines"
applyMode: "auto-attach"
filePatterns: ["*.ts", "*.tsx", "*.js", "*.jsx", "**/api/**"]
---

# Performance Standards

## Frontend Performance
- Use code splitting and lazy loading
- Optimize images and assets
- Minimize bundle sizes
- Use proper caching strategies
- Implement virtual scrolling for large lists
- Use React.memo and useMemo for expensive operations
- Debounce user inputs and API calls

## Backend Performance
- Use database indexes appropriately
- Implement caching where beneficial
- Use pagination for large data sets
- Optimize database queries
- Use connection pooling
- Implement proper logging and monitoring
- Use compression for API responses

## Monitoring & Metrics
- Track Core Web Vitals (LCP, FID, CLS)
- Monitor API response times
- Set up performance budgets
- Use performance profiling tools
- Track bundle size changes
- Monitor memory usage and leaks
`,
  },

  {
    filename: "documentation.mdc",
    content: `---
name: "Documentation Standards"
description: "Code documentation, API docs, and README requirements"
applyMode: "agent-requested"
filePatterns: ["*.md", "*.ts", "*.tsx", "*.js", "*.jsx"]
---

# Documentation Standards

## Code Documentation
- Document complex business logic with comments
- Use JSDoc for public APIs and functions
- Include usage examples in documentation
- Document environment variables and configuration
- Maintain up-to-date README files
- Document architectural decisions (ADRs)

## API Documentation
- Document all API endpoints
- Include request/response examples
- Document error codes and messages
- Use OpenAPI/Swagger specifications
- Keep documentation current with code changes
- Include authentication requirements

## README Requirements
- Clear project description and purpose
- Installation and setup instructions
- Usage examples and common workflows
- Environment variable documentation
- Contributing guidelines
- License information
- Troubleshooting section
`,
  },

  {
    filename: "git-workflow.mdc",
    content: `---
name: "Git & Version Control"
description: "Commit standards, branching strategy, and code review requirements"
applyMode: "manual"
filePatterns: []
---

# Git & Version Control

## Commit Standards
- Use conventional commit format: type(scope): description
- Types: feat, fix, docs, style, refactor, test, chore
- Keep commits atomic and focused
- Write clear, descriptive commit messages
- Reference issue numbers in commits

## Branch Strategy
- Use feature branches for all development
- Keep main/master branch always deployable
- Use descriptive branch names: feature/user-authentication
- Delete branches after merging
- Use pull requests for all code changes

## Code Review Requirements
- All code must be reviewed before merging
- Check for code style, logic, and security issues
- Verify tests are included and passing
- Ensure documentation is updated
- Use automated checks (linting, testing, security scans)

## Git Best Practices
- Use .gitignore to exclude build artifacts
- Keep commits focused on single changes
- Use interactive rebase to clean up history
- Write meaningful merge commit messages
- Tag releases with semantic versioning
`,
  },

  {
    filename: "accessibility.mdc",
    content: `---
name: "Accessibility Standards"
description: "Web accessibility guidelines and WCAG compliance requirements"
applyMode: "auto-attach"
filePatterns: ["*.tsx", "*.jsx", "*.vue", "*.svelte", "*.html"]
---

# Accessibility Standards

## Web Accessibility
- Use semantic HTML elements
- Provide alt text for images
- Ensure proper heading hierarchy (h1-h6)
- Implement keyboard navigation
- Maintain color contrast ratios (WCAG 2.1 AA)
- Use ARIA labels where appropriate
- Test with screen readers

## Interactive Elements
- Ensure all interactive elements are keyboard accessible
- Provide focus indicators for all focusable elements
- Use proper ARIA roles and properties
- Implement skip links for navigation
- Ensure form inputs have associated labels

## Content & Design
- Use sufficient color contrast (4.5:1 for normal text)
- Don't rely on color alone to convey information
- Provide text alternatives for non-text content
- Ensure content is readable and understandable
- Design for users with various abilities

## Testing & Validation
- Use automated accessibility testing tools
- Perform manual keyboard navigation testing
- Test with screen readers (NVDA, JAWS, VoiceOver)
- Validate HTML for semantic correctness
- Include accessibility testing in CI/CD pipeline
`,
  },
];

export const TEMPLATE_VERSION = "2.0.0";
export const TEMPLATE_METADATA = {
  generatedBy: "dev-assistant-mcp-server",
  format: "cursor-mdc",
  lastUpdated: "{timestamp}",
  version: TEMPLATE_VERSION,
};

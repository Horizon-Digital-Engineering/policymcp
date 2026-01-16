# Contributing to Policy MCP

Thank you for your interest in contributing to Policy MCP! This document provides guidelines for contributing to the project.

## License Considerations

This project is licensed under the Business Source License 1.1 (BUSL-1.1). Please review the [LICENSE](LICENSE) file before contributing. By contributing, you agree that your contributions will be licensed under the same license.

## Development Setup

### Prerequisites

- Node.js 18.0.0 or higher
- npm (comes with Node.js)
- Git

### Getting Started

1. Fork the repository on GitHub
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR-USERNAME/policymcp.git
   cd policymcp
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Build the project:
   ```bash
   npm run build
   ```
5. Run tests:
   ```bash
   npm test
   ```

## Development Workflow

### Making Changes

1. Create a new branch for your feature or bugfix:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bugfix-name
   ```

2. Make your changes, following the code style guidelines

3. Add or update tests as needed

4. Run the test suite:
   ```bash
   npm test
   ```

5. Run the linter:
   ```bash
   npm run lint
   ```

6. Commit your changes with a descriptive commit message:
   ```bash
   git commit -m "Add feature: description of your changes"
   ```

### Commit Message Guidelines

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

Example:
```
Add support for RTF document parsing

- Implement RTF parser using rtf.js library
- Extract metadata from RTF document properties
- Add comprehensive tests for RTF parsing
- Update documentation

Closes #123
```

## Code Style

### TypeScript

- Follow the existing code style in the project
- Use TypeScript strict mode features
- Add JSDoc comments for public APIs
- Use meaningful variable and function names

### Testing

- Write tests for all new features and bug fixes
- Maintain or improve code coverage
- Use descriptive test names that explain what is being tested
- Follow the Arrange-Act-Assert pattern

Example:
```typescript
describe("parsePDF", () => {
  it("should extract title from PDF metadata when available", async () => {
    // Arrange
    const testFile = "test.pdf";

    // Act
    const result = await parsePDF(testFile);

    // Assert
    expect(result.title).toBe("Expected Title");
  });
});
```

## Pull Request Process

1. Push your changes to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

2. Open a pull request on GitHub:
   - Provide a clear description of the changes
   - Reference any related issues
   - Include screenshots for UI changes
   - List any breaking changes

3. Address review feedback:
   - Make requested changes
   - Push additional commits to your branch
   - Respond to reviewer comments

4. Once approved, your PR will be merged by a maintainer

## What to Contribute

### Good First Issues

Look for issues labeled `good first issue` for beginner-friendly contributions.

### Feature Requests

Before implementing a new feature:
1. Open an issue to discuss the feature
2. Wait for maintainer feedback
3. Implement the feature once approved

### Bug Reports

When reporting bugs, include:
- Description of the issue
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details (OS, Node version, etc.)
- Relevant logs or error messages

### Documentation

Documentation improvements are always welcome:
- Fix typos or clarify unclear sections
- Add examples or use cases
- Update outdated information
- Improve code comments

## Areas of Interest

We're particularly interested in contributions that:

- Add support for new document formats (RTF, HTML, etc.)
- Improve document parsing accuracy
- Add persistent storage options (PostgreSQL, SQLite)
- Implement vector search capabilities
- Add OCR support for scanned documents
- Improve test coverage
- Enhance the web UI
- Optimize search performance
- Add internationalization support

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui
```

### Writing Tests

- Place test files in `src/__tests__/` directory
- Name test files `*.test.ts`
- Use Vitest for testing framework
- Mock external dependencies appropriately
- Test both success and error cases

## Questions?

If you have questions about contributing:
- Open a GitHub issue with the `question` label
- Review existing issues and pull requests
- Check the [documentation](docs/)

## Code of Conduct

### Our Standards

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Accept criticism gracefully
- Prioritize the project's best interests

### Unacceptable Behavior

- Harassment, trolling, or insulting comments
- Personal or political attacks
- Publishing others' private information
- Any conduct inappropriate in a professional setting

## Recognition

Contributors will be recognized in the project's documentation and release notes.

Thank you for contributing to Policy MCP!

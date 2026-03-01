# Contributing to AI Powered Food & Fitness Tracker

Thank you for considering contributing to this project! 🎉

## 🤝 How to Contribute

### Reporting Bugs

If you find a bug, please create an issue with:

- Clear title and description
- Steps to reproduce
- Expected vs actual behavior
- Screenshots (if applicable)
- Your environment (OS, Node version, browser)

### Suggesting Features

Feature requests are welcome! Please:

- Check if the feature already exists
- Explain the use case
- Provide examples if possible

### Pull Request Process

1. **Fork the repository**

   ```bash
   git clone https://github.com/your-username/fitness-goal-tracker.git
   cd fitness-goal-tracker
   ```

2. **Create a feature branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Write clean, readable code
   - Follow existing code style
   - Comment complex logic
   - Test your changes

4. **Commit your changes**

   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

   Use conventional commits:
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation changes
   - `style:` - Code style changes (formatting)
   - `refactor:` - Code refactoring
   - `test:` - Adding tests
   - `chore:` - Maintenance tasks

5. **Push to your fork**

   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request**
   - Provide a clear description
   - Reference related issues
   - Include screenshots for UI changes

## 📋 Development Setup

1. Install dependencies:

   ```bash
   cd server && npm install
   cd ../frontend && npm install
   ```

2. Set up environment variables:
   - Copy `.env.example` to `.env` in both folders
   - Add your API keys

3. Run the development servers:

   ```bash
   # Terminal 1 - Backend
   cd server && npm start

   # Terminal 2 - Frontend
   cd frontend && npm start
   ```

## 🎨 Code Style

- Use meaningful variable names
- Keep functions small and focused
- Add comments for complex logic
- Use semicolons consistently
- Use ES6+ features (arrow functions, destructuring, etc.)

## 🧪 Testing

- Test your changes thoroughly
- Check both success and error cases
- Test on different screen sizes (for UI changes)
- Ensure the AI fallback system works

## 🔍 Areas for Contribution

### High Priority

- [ ] Add unit and integration tests
- [ ] Implement dark mode
- [ ] Add export feature (CSV/PDF reports)
- [ ] Multi-language / i18n support
- [ ] Progressive Web App (PWA) features

### Medium Priority

- [ ] Social sharing features
- [ ] Recipe suggestions based on macros
- [ ] Integration with fitness devices / Apple Health / Google Fit
- [ ] Barcode scanner for packaged foods
- [ ] Meal planning / scheduling

### Nice to Have

- [ ] Streak tracking & gamification badges
- [ ] Community leaderboard
- [ ] Voice input for food entries
- [ ] Water intake tracking

## 📝 Commit Message Guidelines

Good commit messages:

```
feat: add meal history page
fix: resolve authentication timeout issue
docs: update API documentation
style: format code with prettier
refactor: simplify food analysis logic
```

Bad commit messages:

```
update
fixed stuff
changes
asdf
```

## ❓ Questions?

Feel free to:

- Open an issue for discussion
- Reach out to maintainers
- Check existing issues/PRs

## 📜 Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Help others learn and grow

Thank you for contributing! 🙌

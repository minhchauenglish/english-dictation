# English Dictation (100% Client-Side)

An ultra-simple, modern, and privacy-first English Dictation web application designed for teachers and students.

## ✨ Key Characteristics

- **100% Client-Side**: Runs completely in the user's browser as a static Single-Page Application (SPA).
- **No Database & No Backend**: Zero cloud database or server dependencies.
- **No Login / No Account**: Frictionless for students and teachers.
- **No API Keys**: Fully operational out of the box with zero external subscription or API setup.
- **No Gemini / No Firebase / No Express**: Clean, pure static build.
- **Native Browser SpeechSynthesis**: Generates natural English audio and individual difficult word pronunciations offline using the Web Speech API.
- **Local Learning Features**:
  - **Retry Before Reveal**: Encourages second attempts before showing answers in Practice mode.
  - **Progressive Hint Ladder**: Unlocks sentence word count and first-letter clues (`💡 GỢI Ý`).
  - **Exercise Modes**: Practice mode (interactive with hints & retries) vs Test mode (continuous submission with review upon completion).
  - **Remediation & Difficult Words**: Dedicated "Luyện lại câu sai" round and audio pronunciation playback for tricky words.
- **URL-Encoded Exercises**: Entire exercises (sentences, audio settings, check modes, exercise mode) are compressed and encoded directly into shareable URLs (`#/practice/ENCODED_DATA`) with `lz-string` and QR codes.

## 🚀 GitHub Pages & Static Deployment

This project builds directly into static files in `dist/` with relative asset paths (`base: './'`).

### Automated GitHub Pages Workflow
Whenever changes are pushed to the `main` branch, the included GitHub Actions workflow (`.github/workflows/deploy.yml`) builds and deploys the `dist/` folder to GitHub Pages automatically.

### Manual Build
```bash
npm install
npm run build
```
The output in `dist/` can be served from any static web server, GitHub Pages, Vercel, Netlify, or Cloudflare Pages.

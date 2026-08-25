# English Dictation (100% Client-Side)

An ultra-simple, modern, and privacy-first English Dictation web application designed for teachers and students.

## ✨ Key Characteristics

- **100% Client-Side**: Runs completely in the user's browser as a static Single-Page Application (SPA).
- **No Database & No Backend**: Zero cloud database or server dependencies.
- **No Login / No Account**: Frictionless for students and teachers.
- **No API Keys**: Fully operational out of the box with zero external subscription or API setup.
- **No Gemini / No Firebase / No Express**: Clean, pure static build.
- **Native Browser SpeechSynthesis**: Generates clear US/UK voice pronunciations offline using standard Web Speech API.
- **Local JavaScript Answer Checking**: Word-level diff and accuracy calculation done locally in milliseconds.
- **URL-Encoded Exercises**: Entire exercises (sentences, audio settings, check modes) are compressed and encoded directly into shareable URLs (`#/practice/ENCODED_DATA`) with `lz-string` and QR codes.

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

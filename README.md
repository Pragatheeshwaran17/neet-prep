# NEET Prep — student app

Next.js 15 + PocketBase. Students sign up, practise by subject (Physics / Chemistry / Biology), take mixed mock tests or the full paper, and get NEET-style scoring (+4 / −1) with solutions.

## Run locally

```bash
npm install
cp .env.example .env.local      # then fill in the 3 values below
npm run setup                   # one-time: locks down PocketBase rules (safe to re-run)
npm run dev                     # open http://localhost:3000
```

`.env.local`:

```
NEXT_PUBLIC_PB_URL=https://saravanan.uk
PB_ADMIN_EMAIL=your-superuser-email
PB_ADMIN_PASSWORD="your-superuser-password"
```

## Admins

Sign up in the app like a student, then promote that account:

```bash
npm run make-admin -- you@example.com          # --remove to demote
```

Log in again → an **Admin** tab appears:

- **Question bank** — stats, papers, and a review screen per paper (edit text/options/answer/images, publish or unpublish, add or delete questions)
- **Upload PDF** — no AI. The browser reads the PDF's own text positions to find question numbers, `Ans.`, `Sol.` and `PART – SUBJECT` headings, then cuts every question and solution out of the page as a 3× image — English, Hindi, formulas and diagrams exactly as printed. New papers are saved as **drafts**; **Refresh existing paper** re-cuts images but keeps answers and publish status. Works for digital (not scanned) PDFs in this layout.
- **Students** — every user with tests taken, accuracy, average score and last activity

Drafts are invisible to students until published. A question can't be published without a correct answer.

The superuser login is only used by the server-side API routes (scoring, starting tests). It never reaches the browser.

## How it works

| Piece | Where |
|---|---|
| Login / sign-up | Browser → PocketBase `users` (students can't make themselves admin) |
| Question lists & counts | Browser → PocketBase `questions` (answer + solution are hidden fields) |
| Start test, autosave, submit, review | `app/api/attempts/**` → PocketBase as superuser |
| Scoring | Server only, in `app/api/attempts/[id]/submit` |

Anti-cheat: students can read their own attempts but can't create or edit them directly; answers and solutions are only returned after submission; the timer deadline is enforced on the server.

## Pages

- `/` landing · `/login` · `/signup`
- `/dashboard` subject cards, mock test, full paper, recent tests
- `/test/[id]` exam screen: timer, palette, mark for review, autosave, keys 1–4 and ← →
- `/results/[id]` score, per-subject breakdown, answer review with solutions
- `/history` all past tests

## Deploy to Vercel (later)

Push to GitHub → import in Vercel → add the same environment variables (`NEXT_PUBLIC_PB_URL`, `PB_ADMIN_EMAIL`, `PB_ADMIN_PASSWORD`) → Deploy.

## Cost

No paid services: Vercel Hobby (non-commercial), GitHub and your own PocketBase server. PDF reading runs in the admin's browser.

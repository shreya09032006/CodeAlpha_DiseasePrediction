# Claim Lens

Fact-checks forwarded messages (text, link, screenshot, voice note, PDF) in Hindi, Marathi, Malayalam and English. Gives one of five verdicts with sources, plus scam red-flag scanning, an email phishing check, a Gmail extension and a shared ledger of repeat claims.

**Verdicts:** Verified, False, Outdated, Partly supported, Cannot be confirmed.

## What is in the project

| Part | Where |
|---|---|
| Fact-check pipeline (extract claims, search, judge) | `core/` |
| WhatsApp bot (Meta Cloud API) | `app/meta.py` |
| Website pages and API | `app/*.py` |
| Gmail / Chrome extension | `extension/` |
| Allowlisted sources | `data/allowlist.txt` |
| Demo and test scripts | `eval/` |

### Website pages
| Page | Purpose |
|---|---|
| `/` | Landing page |
| `/app` | Checker: text, link, screenshot, PDF, voice, share card, listen |
| `/scan` | Instant scam red-flag scan (no AI, no quota) |
| `/email` | Email phishing check (SPF, DKIM, DMARC, fake links) |
| `/languages` | Tap a language to try it |
| `/dashboard` | Ledger: counts, repeat checks, human requests |
| `/privacy` | Privacy page |

### How a check works
Input (text, image, audio, PDF, URL) -> text (vision LLM / Tesseract, Whisper, PyMuPDF, trafilatura) -> claim extraction -> evidence from Google Fact Check API + Tavily on the allowlist -> judge LLM uses only that evidence and today's date -> verdict, explanation in the user's language, evidence cards.

LLM order: Gemini models first, then Groq as fallback. Answers are cached in `.cache/`.

## Setup

Requires Python 3.9+ and Tesseract (optional, image fallback): `brew install tesseract tesseract-lang`

```bash
git clone https://github.com/YOUR-USERNAME/claim-lens.git
cd claim-lens
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env     # then fill in the keys
mkdir -p data/fonts      # fonts used by the share card (see below)
uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000

### Keys you need (put in `.env`, never commit it)
| Variable | Where to get it |
|---|---|
| `GEMINI_API_KEY` | aistudio.google.com/apikey |
| `GROQ_API_KEY` | console.groq.com/keys |
| `TAVILY_API_KEY` | tavily.com |
| `FACTCHECK_API_KEY` | Google Cloud, enable Fact Check Tools API |
| `META_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID` | Meta app, WhatsApp, Step 1 |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | Twilio console (only needed because `main.py` creates the client) |

Ask the team lead for working keys privately. Do not paste keys in chat, screenshots or commits.

### Share card fonts
`core/card.py` reads Noto fonts from `data/fonts/` (NotoSans, NotoSansDevanagari, NotoSansMalayalam, `.ttf`). They are in the repo; if missing, download them from the Noto fonts project.

## WhatsApp bot
1. Run the server and expose it: `ngrok http 8000`
2. Meta app, Configure Webhooks: callback `https://YOUR-URL/webhook`, verify token `claimlens123`, subscribe to `messages`.
3. Only numbers added as test recipients can message the test number (Meta, Step 1, To, Manage phone number list).
4. The temporary Meta token expires about every 24 hours. Regenerate it in Step 1 and update `.env`, then restart.

Commands users can send: `hindi`, `marathi`, `malayalam`, `english`, `auto`, `voice off`, `voice on`, `guardian on`, `guardian off`.

## Gmail extension
1. Set the server address in `extension/background.js` and `extension/manifest.json` (currently the ngrok URL).
2. Chrome, `chrome://extensions`, Developer mode, Load unpacked, pick the `extension` folder.
3. Open Gmail, close old Gmail tabs after every reload of the extension, open an email. A badge shows the risk, with Check claims and Full signature check (opens `/email`).

## Rules for working together
- Branch per feature: `git checkout -b feature/name`, then open a pull request. Do not push straight to `main`.
- Pull before you start: `git pull`.
- Never commit `.env`, `venv/`, `.cache/` or files in `data/` that hold user data (they are in `.gitignore`).
- Do not change prompts in `core/judge.py` or `core/claims.py` without rerunning `python3 -W ignore -m eval.run_demo` (must stay 5/5).
- Test all pages with: `python3 -W ignore -m eval.smoke`

## Status
Done: WhatsApp bot, website, scan, email check, Gmail extension, ledger with fuzzy repeat matching, guardian alerts, share card, voice replies.
Not live: phone line (`app/voice.py`, needs a Twilio voice number), Android share target (needs a deployed https site).
Roadmap: embeddings and pgvector ledger, volunteer corrections, claim family tree, on-device models, Chrome Web Store release.

## Known limits
- Instagram and other social links cannot be read (login wall). Use a screenshot.
- DKIM checks only work on the original raw email.
- Free tiers of Gemini, Groq and Tavily are shared by everyone using the same keys.

<div align="center">
  <img src="assets/logo.svg" alt="SlashPrompt Logo" width="84" height="84" />
  <h1>SlashPrompt</h1>
  <p>
    <strong>Enhance prompts inline with <code>//</code> using Chrome's Built-in AI (Gemini Nano)</strong><br />
    100% on-device · Zero API keys · Zero token costs
  </p>

  <p>
    <img src="https://img.shields.io/badge/Manifest-V3-18181b?style=flat-square" alt="Manifest V3" />
    <img src="https://img.shields.io/badge/Chrome_AI-Gemini_Nano-10b981?style=flat-square" alt="Chrome Built-in AI" />
    <img src="https://img.shields.io/badge/TypeScript-Strict-3178c6?style=flat-square" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Shadow_DOM-Isolated_UI-71717a?style=flat-square" alt="Shadow DOM" />
    <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="MIT License" />
  </p>
</div>

---

## Why SlashPrompt?

Most prompt-enhancer extensions send your text to external cloud APIs, require paid API keys, or inject clunky modals. **SlashPrompt** runs **entirely inside Chrome** via the Built-in AI APIs (`LanguageModel`, `Rewriter`, `Writer`, `Summarizer`, `Proofreader`) and renders a clean, CSS-isolated **Shadow DOM** floating pill right next to your cursor.

- **Works everywhere you type:** `<textarea>`, `<input>`, and rich `contenteditable` editors (ChatGPT, Claude, Gemini, Notion, GitHub, Gmail, Linear, Slack).
- **URL & comment safe:** Automatically ignores `https://`, `http://`, and `///` so normal typing is never interrupted.
- **Instant streaming & 1-click replace:** Streams tokens over a Manifest V3 `chrome.runtime.Port` and replaces your `// ...` text cleanly without breaking React, ProseMirror, or Lexical editor state.
- **Light & dark adaptive:** Automatically matches your system theme.

---

## Features & Examples

Type `//` followed by a rough thought in any text box, pick a mode or style, and press `Ctrl+Enter` (`Cmd+Enter` on Mac) or click **Enhance**.

### 1. Enhancement Styles (`LanguageModel` / Prompt API)

| Style | You type | Enhanced output |
| :--- | :--- | :--- |
| **Structured** *(default)* | `// plan a 3-day trip to tokyo for foodies` | *Role: Travel concierge. Task: Create a 3-day Tokyo itinerary focused on local food. Constraints: Group by neighborhood, include breakfast/lunch/dinner/late-night spots, and note reservation tips. Output: Day-by-day schedule.* |
| **Coding** | `// python script to dedupe csv by email` | *Act as a senior Python engineer. Write a clean script using `csv` or `pandas` to deduplicate a CSV by the `email` column (case-insensitive, trimmed). Handle missing headers, malformed rows, and include CLI usage.* |
| **Concise** | `// help me write a polite decline for a meeting` | *Draft a brief, polite 2–3 sentence email declining a meeting invitation while proposing an async alternative.* |
| **Creative** | `// sci-fi opening about a quiet mars outpost` | *Write an atmospheric 200-word sci-fi opening set in a solitary Mars research outpost. Focus on sensory details—dust, radio static, low-gravity stillness—and end on an unexpected signal.* |

### 2. Built-in AI Modes

| Mode | Chrome API Used | Best For | Example |
| :--- | :--- | :--- | :--- |
| **Enhance** | `LanguageModel` | Turning rough ideas into high-signal prompts | `// sql query for monthly churn` → structured prompt with schema/edge-case asks |
| **Concise** | `Rewriter` (`shorter`) | Trimming wordy prompts | `// I was wondering if you could maybe...` → crisp direct instruction |
| **Formal** | `Rewriter` (`more-formal`) | Professional / client-facing tone | `// tell client deadline moved to friday` → polished professional message |
| **Expand** | `Writer` | Turning short bullet points into full drafts | `// onboarding email: welcome, setup link, slack` → complete structured draft |
| **Proofread** | `Proofreader` | Fixing grammar & clarity without changing voice | `// wrtie a summry of teh Q3 report` → `Write a summary of the Q3 report.` |
| **Summarize** | `Summarizer` (`key-points`) | Condensing long pasted context into key points | `// <long 400-word spec>` → crisp bulleted requirements |

> **Automatic Fallback:** If only the **Prompt API** (`LanguageModel`) is enabled in your Chrome build, `Concise`, `Formal`, `Expand`, `Proofread`, and `Summarize` automatically route through `LanguageModel` with task-specific instructions.

### 3. Advanced On-Device Chrome AI Capabilities

- **Warm Session Caching (`session.clone()`):** Caches base `LanguageModel` sessions per style and clones them per request to avoid re-parsing system prompts.
- **Structured Prompt Linting (`responseConstraint`):** Uses a JSON Schema constraint to score prompt clarity (`1–10`) and surface 1-click missing-element chips (e.g. `+ Output Format`, `+ Target Audience`).
- **Context-Window Guardrails (`measureInputUsage()` + `inputQuota`):** Automatically pre-condenses oversized inputs via the **`Summarizer`** API before enhancing, preventing `QuotaExceededError`.
- **Multimodal Screenshot-to-Prompt (`📷`):** Toggle **📷** in the floating pill to attach a visible-tab screenshot (`chrome.tabs.captureVisibleTab`) using `expectedInputs: [{ type: 'image' }]`.
- **Page-Aware Local Context (`📄 Page`):** Toggle **📄 Page** to include the active page title, hostname, and highlighted text as local `sharedContext`.
- **Auto Language Detection & Translation (`LanguageDetector` + `Translator`):** Detects non-English `//` prompts and offers a 1-click **Translate → EN & Enhance** chip.

### 4. Toolbar Popup & Local History

Click the **SlashPrompt** extension icon anytime to access:
- **Enhance Playground:** Test and refine prompts without leaving your current tab (`Ctrl+Enter` to run).
- **Local History:** Last 30 enhanced prompts stored strictly in `chrome.storage.local` with **★ starring** and 1-click copy.
- **AI & Settings:** Live availability pills (`available`, `downloadable`, `unavailable`) for all 8 Chrome Built-in AI capabilities, custom trigger prefix (default `//`), default style, and **Offline Demo Fallback**.

---

## Keyboard Shortcuts

| Context | Shortcut | Action |
| :--- | :--- | :--- |
| Inline `//` pill visible | `Ctrl + Enter` / `Cmd + Enter` / `Alt + E` | Start enhancing prompt |
| Preview card ready | `Enter` | Replace original `// ...` text in-place |
| Pill or card open | `Esc` | Cancel generation & dismiss overlay |

---

## What Happens If Chrome Built-in AI Models Aren't Installed?

SlashPrompt handles missing or un-downloaded models gracefully:

1. **Model not yet downloaded (`downloadable`):**
   On first use, Chrome begins downloading Gemini Nano automatically. SlashPrompt displays a live progress indicator (`Preparing on-device AI model (X%)...`) inside the floating card and popup.
2. **APIs disabled or unsupported (`unavailable`):**
   By default, SlashPrompt does **not** fake AI output—it shows a clear notice (`Chrome Built-in AI (Gemini Nano) is not enabled or available in this browser`) and links you to the **AI & Settings** setup checklist.
3. **Offline Demo Fallback (optional):**
   If you want to preview the UI/workflow before enabling Chrome flags or downloading Gemini Nano, toggle **Offline Demo Fallback** in **AI & Settings** to use local template-based streaming.

---

## Setup & Installation

### 1. Enable Chrome Built-in AI

<details>
<summary>Click for Chrome flags & hardware requirements</summary>

1. Use **Google Chrome 138+** on desktop (Windows 10/11, macOS 13+, Linux, or Chromebook Plus) with at least **22 GB** of free disk space.
2. Open `chrome://flags` and enable:
   - `#optimization-guide-on-device-model` → **Enabled BypassPerfRequirement**
   - `#prompt-api-for-gemini-nano` → **Enabled**
   - Optional specialized APIs: `#rewriter-api-for-gemini-nano`, `#writer-api-for-gemini-nano`, `#summarizer-api-for-gemini-nano`, `#proofreader-api-for-gemini-nano`
3. Relaunch Chrome and check `chrome://on-device-internals` (or open **SlashPrompt → AI & Settings**).

</details>

### 2. Build & Load Unpacked

```bash
git clone https://github.com/amafjarkasi/slashprompt-chrome-local-ai.git
cd slashprompt-chrome-local-ai
npm install
npm run build
```

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** and select the `dist/` directory.

---

## Project Structure

```text
├── assets/logo.svg            # Minimal repository logo
├── public/
│   ├── manifest.json          # Manifest V3 config (storage, contextMenus, activeTab)
│   └── popup.html             # Toolbar popup markup
├── scripts/build.mjs          # Vite bundler + PNG icon generator → dist/
├── src/
│   ├── ai/chromeAi.ts         # Unified wrapper for all 5 Chrome Built-in AI APIs
│   ├── background/index.ts    # MV3 service worker, context menu, streaming Port
│   ├── content/
│   │   ├── index.ts           # // trigger listener, shortcuts, Port client
│   │   ├── domTarget.ts       # Caret/range detection & React/contenteditable replacement
│   │   └── overlay.ts         # Shadow DOM floating pill & streaming card UI
│   ├── popup/                 # Popup UI & styles
│   └── shared/                # Trigger parser, storage helper, shared types
└── tests/
    ├── trigger.test.ts        # Vitest unit tests
    └── e2e.mjs                # Playwright Chromium MV3 end-to-end tests
```

---

## Development & Testing

| Command | Description |
| :--- | :--- |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm run build` | Bundle extension into `dist/` |
| `npm test` | Run Vitest unit tests (`tests/trigger.test.ts`) |
| `npm run test:e2e` | Run Playwright Chromium E2E tests against `dist/` |

---

## License

MIT

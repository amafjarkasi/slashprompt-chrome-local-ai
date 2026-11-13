# SlashPrompt — Local AI Prompt Enhancer for Chrome

> Type `//` followed by any rough idea in any web text area to enhance, rewrite, expand, proofread, or summarize your prompt **100% locally** using Chrome's Built-in AI (**Gemini Nano**) — zero API keys, zero cloud calls, zero token costs.

---

## Features

- **Inline `//` Trigger Anywhere:** Works across standard `<textarea>`, `<input>`, and rich `contenteditable` editors (ChatGPT, Claude, Gemini, Notion, GitHub, Gmail, Linear, Slack, etc.).
- **URL & Comment Safe:** Automatically ignores `https://` / `http://` URLs and `///` comments so normal typing is never interrupted.
- **Minimal Shadow DOM Floating UI:** CSS-isolated floating pill and streaming preview card that adapts automatically to light and dark mode without clashing with host page styles.
- **Powered by 5 Chrome Built-in AI APIs:**
  - **Prompt API (`LanguageModel`):** Full prompt engineering enhancement with selectable styles (`Structured`, `Concise`, `Coding`, `Creative`).
  - **Rewriter API (`Rewriter`):** One-click `Concise` / `Shorter` and `Formal` tone adjustments.
  - **Writer API (`Writer`):** `Expand` mode to turn brief notes or bullet points into complete prompts.
  - **Summarizer API (`Summarizer`):** `Summarize` mode to condense verbose prompts into crisp key points.
  - **Proofreader API (`Proofreader`):** `Proofread` mode to fix grammar and clarity without altering intent.
  - *(Specialized modes automatically fall back to `LanguageModel` if only the Prompt API is enabled.)*
- **Real-Time Streaming & One-Click Replace:** Streams tokens live over a Manifest V3 `chrome.runtime.Port` with abort support, quick-refine chips (`Shorter`, `Formal`, `Coding`, `Retry`), clipboard copy, and in-place replacement that preserves React/ProseMirror/Lexical editor state.
- **Toolbar Popup & Local History:** Includes an **Enhance Playground**, **Local History** (last 30 prompts with starring, stored strictly in `chrome.storage.local`), live **Chrome AI Status** badges, custom trigger prefix support, and an **Offline Demo Fallback** toggle for testing without Gemini Nano weights.
- **Right-Click Context Menu:** Highlight any text in an editable field and select **Enhance prompt with SlashPrompt**.

---

## Keyboard Shortcuts

| Context | Shortcut | Action |
| :--- | :--- | :--- |
| Inline `//` pill visible | `Ctrl + Enter` / `Cmd + Enter` / `Alt + E` | Start enhancing prompt |
| Preview card ready | `Enter` | Replace original `// ...` text in-place |
| Pill or card open | `Esc` | Cancel generation & dismiss overlay |

---

## Chrome Built-in AI Setup (Free, On-Device)

SlashPrompt runs Gemini Nano directly inside Chrome. To enable Chrome's Built-in AI APIs:

1. Use **Google Chrome 138+** on desktop (Windows 10/11, macOS 13+, Linux, or Chromebook Plus) with at least **22 GB** of free disk space.
2. Open `chrome://flags` and enable:
   - `#optimization-guide-on-device-model` → **Enabled BypassPerfRequirement**
   - `#prompt-api-for-gemini-nano` → **Enabled**
   - Optional specialized APIs: `#rewriter-api-for-gemini-nano`, `#writer-api-for-gemini-nano`, `#summarizer-api-for-gemini-nano`, `#proofreader-api-for-gemini-nano`
3. Relaunch Chrome and verify model status at `chrome://on-device-internals` or in the **SlashPrompt → AI & Settings** tab.

---

## Installation (Load Unpacked)

```bash
git clone https://github.com/<your-username>/slashprompt-chrome-local-ai.git
cd slashprompt-chrome-local-ai
npm install
npm run build
```

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** and select the generated `dist/` folder.

---

## Architecture

```text
src/
├── ai/chromeAi.ts          # Unified wrapper for LanguageModel, Rewriter, Writer, Summarizer, Proofreader
├── background/index.ts     # MV3 service worker, context menu, and streaming Port handler
├── content/
│   ├── index.ts            # Trigger listener, keyboard shortcuts, and Port client
│   ├── domTarget.ts        # Caret/range extraction & React/contenteditable-safe replacement
│   └── overlay.ts          # Shadow DOM floating pill & streaming preview card
├── popup/
│   ├── popup.ts            # Playground, local history, AI capability status, and settings
│   └── popup.css           # Minimal light/dark adaptive popup styles
└── shared/
    ├── trigger.ts          # Pure // trigger parser with URL & /// guards
    ├── storage.ts          # Typed chrome.storage.local wrapper
    └── types.ts            # Shared message, mode, style, and settings types
```

---

## Development & Testing

| Command | Description |
| :--- | :--- |
| `npm run typecheck` | Run TypeScript typechecking (`tsc --noEmit`) |
| `npm run build` | Bundle MV3 `content.js`, `background.js`, `popup.js`, and assets into `dist/` |
| `npm test` | Run Vitest unit tests (`tests/trigger.test.ts`) |
| `npm run test:e2e` | Run Playwright Chromium end-to-end tests loading the unpacked `dist/` extension |

---

## License

MIT

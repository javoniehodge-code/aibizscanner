# Milestone 2 setup: the first real AI prompt analysis

Plain-English steps to run a real prompt analysis for MVP Miami. ChatGPT, Claude and Gemini each answer a set of
customer questions, with web search on. Do Milestone 1 first ([milestone-1-setup.md](milestone-1-setup.md)): the app
must be deployed and the background worker running. Allow about 20 minutes plus the run itself (5–10 minutes).

**This costs real money.** A run of 12 questions costs roughly $3–4 across the three providers. The report's spending
cap stops paid calls at $5 by default (you can change it on the prompt set screen).

Never paste an API key into chat, GitHub or code. Keys go only into Vercel's environment variables.

---

## 1. Merge the pull requests

Merge the engine-modules pull request first, then the Milestone 2 pull request, each when its checks are green. Merging
applies the database changes automatically (new prices, prompt set fields, a longer worker timeout).

## 2. Get the three API keys

| Provider | Where | Name it |
| --- | --- | --- |
| OpenAI (ChatGPT answers) | [platform.openai.com](https://platform.openai.com) → **API keys** → **Create new secret key** | `aibizscanner-internal` |
| Anthropic (Claude answers, and the model that reads every answer) | [console.anthropic.com](https://console.anthropic.com) → **API keys** → **Create key** | `aibizscanner-internal` |
| Google (Gemini answers) | [aistudio.google.com](https://aistudio.google.com) → **Get API key** → **Create API key** | `aibizscanner-internal` |

Each provider needs billing turned on (a payment method or prepaid credit). Setting a monthly spend limit in each
provider's billing settings is a good second safety net, e.g. $20.

## 3. Add the keys to Vercel

In Vercel, open the project → **Settings → Environment Variables** and add, for all environments:

| Name | Value |
| --- | --- |
| `OPENAI_API_KEY` | the OpenAI key |
| `ANTHROPIC_API_KEY` | the Anthropic key |
| `GEMINI_API_KEY` | the Google key |

Then redeploy: **Deployments → … (latest) → Redeploy**. Keys are read when the app starts, so they take effect only
after a redeploy.

A missing key is not an error: that engine's answers are shown as "not configured", and the others still run.

## 4. Check the worker can run for 5 minutes

Asking an engine a dozen questions with web search takes a few minutes, so the worker now runs for up to 300 seconds.
In Vercel open **Settings → Functions** and check **Fluid compute** is **on** (it is on by default for new projects).
With it on, every plan allows 300 seconds.

## 5. Run the analysis

1. Open the app → **Reports**. Create a report for **MVP Miami** (add the business first under **Businesses** if it
   isn't there; put `mvpmiami.com` in its domains, so its own pages are recognized when cited).
2. On the report, click **Prompt analysis**, then **Review and approve the prompt set**.
3. The form starts from the 12 questions in the MVP Miami example report. Edit them if you like. One question per line:
   `group number | demand | question`. Check the customer location (Miami, Florida, US, America/New_York).
4. Click **Approve this set and run the prompt analysis**. The set is saved as a frozen version, and the run starts.
5. The results page refreshes every 20 seconds. Within about a minute the three engines start (in parallel); then the
   answers are read and the result is assembled automatically.

## 6. What to look at

- **Summary**: how many answers were usable, and how often MVP Miami was recommended by each engine.
- **Who the engines name**: every business named, with recommended / mentioned / excluded counts per engine.
- **Answers by question**: for each question and engine, who was named, the first choice when the answer states one,
  and the full answer text with the pages it cited (click **Answer**).
- **Cited pages** and **Method**.
- **Run monitor**: time, tokens, searches and estimated cost per step.

Please spot-check a few answers against what the results page says. That is the human check the brief asks for:
the reading model can be wrong, and those checks become our first evaluation cases.

## Choices made for you (tell me if you want them changed)

| Choice | Value | Why |
| --- | --- | --- |
| ChatGPT model | `gpt-6.1-sol` (OpenAI API, web search) | OpenAI's newest general model at $2 / $10 per million tokens. Their top model, `gpt-6-astra`, costs 5× more and alone would use most of the $5 cap. |
| Claude model | `claude-opus-5-5` (Anthropic API, web search) | Anthropic's current main model. If its safety system declines a question, Anthropic's **refusal fallback** is on: the same question is answered by another Claude model and the answer is marked with the model that actually served it. |
| Gemini model | `gemini-3.1-pro-preview` (Gemini API, Google Search grounding) | Google's current Pro model in the SDK. Third-party sites mention a newer "Gemini 4" model I couldn't confirm on Google's own pages. |
| Reading model | `claude-haiku-5-5` | Cheap and fast. It only lists who an answer names; plain code checks that every quote really appears in the answer, and does all counting. |
| Searches | up to 3 per answer (ChatGPT, Claude); Gemini decides itself | Keeps cost predictable. |
| Settings | provider defaults, no temperature | Closest to what a customer gets. Answers vary from run to run, so a rerun can differ. |

These are the providers' APIs, not the ChatGPT, Claude or Gemini consumer apps. Answers are similar but not
identical to what a customer sees in the apps. The report's method notes say so.

Prices are in the database (`pricing` table) and come from each provider's published price list on 13 Nov 2026.
Please compare them with your provider dashboards after the first run; a price change is a new database row, not an
edit.

## If something goes wrong

| What you see | Meaning / fix |
| --- | --- |
| "ChatGPT is not configured (its API key is not set)" | The key is missing in Vercel, or you didn't redeploy after adding it. |
| An engine's step **failed** with `401` / `invalid api key` | Wrong key, or billing isn't enabled with that provider. |
| `model not found` / `404` | The provider renamed or retired the model. Tell me; it's a one-line change plus a price row. |
| "Spending cap reached" | The cap stopped further paid calls. The answers already collected are kept. Raise the cap on the prompt set screen and approve again. |
| Steps stay **queued** | The background worker isn't running (Milestone 1 step 8), or Fluid compute is off. "Process queue now" only runs short steps. |
| "Couldn't verify what this answer says" | The reading model quoted words that aren't in the answer twice in a row, so that answer is left out rather than guessed. |

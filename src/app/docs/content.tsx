/* In-app documentation. Each section is plain data so the page can build the contents list and search. */
export type Block =
  | { p: string }
  | { steps: string[] }
  | { list: string[] }
  | { code: string }
  | { note: string; tone?: "info" | "warn" }
  | { table: { head: string[]; rows: string[][] } }
  | { h: string };
export type Section = { id: string; title: string; group: string; blocks: Block[] };

export const SECTIONS: Section[] = [
  /* ---------------- Getting started ---------------- */
  { id: "overview", group: "Getting started", title: "What Delegra does", blocks: [
    { p: "Delegra runs AI coding agents inside the project folders on your computer, using the AI plans you already have. You give agents tasks, chain them into workflows, and watch them work live." },
    { list: [
      "Agents run through Claude Code (and Antigravity, if it is installed) on this computer, with your own sign-in. No API key is needed.",
      "Each step can use a different model: cheap and fast for simple work, deeper models only where they are needed. That keeps token use low.",
      "Everything stays on your computer: the app, your files and your logins.",
    ] },
  ] },
  { id: "requirements", group: "Getting started", title: "Requirements", blocks: [
    { table: { head: ["Needed", "Why", "Check"], rows: [
      ["Node.js 20 or newer", "Runs the app", "node --version"],
      ["Claude Code (required)", "Runs Claude agents on your Claude plan", "claude --version"],
      ["A Claude plan (Pro, Max, Team or Enterprise)", "Agent runs use its usage", "claude auth status"],
      ["Antigravity CLI (optional)", "Adds Gemini and other models for cheap steps", "agy --version"],
      ["Git (optional)", "Shows each project's branch", "git --version"],
    ] } },
    { note: "Antigravity is optional. If it is not installed on a computer, every Antigravity option is hidden there and the app works with Claude Code alone.", tone: "info" },
  ] },
  { id: "install", group: "Getting started", title: "Install and start", blocks: [
    { steps: [
      "Install Node.js 20+ from nodejs.org.",
      "Install Claude Code: npm install -g @anthropic-ai/claude-code",
      "Sign in once: run claude auth login and finish signing in on Anthropic's page.",
      "Get the app: git clone the repository, then cd lean-orchestrator.",
      "Install dependencies: npm install",
      "Start it: npm run dev",
      "Open http://127.0.0.1:3210 in your browser.",
    ] },
    { code: "npm install -g @anthropic-ai/claude-code\nclaude auth login\ngit clone https://github.com/<you>/lean-orchestrator.git\ncd lean-orchestrator\nnpm install\nnpm run dev" },
    { note: "The app only listens on 127.0.0.1, so other devices on your network cannot reach it.", tone: "info" },
  ] },
  { id: "first-run", group: "Getting started", title: "Your first 5 minutes", blocks: [
    { steps: [
      "Click Connect AI (top right) and allow Claude Code. See Connections below.",
      "Go to Projects → Connect project and paste the full path of a folder, for example E:\\Projects\\my-app. Start with Read only access.",
      "Go to Agents → Agent library, select Researcher, Implementer and Code Reviewer, and click Add.",
      "Go to Tasks → New task. Pick the Researcher agent, write \"Summarize how this project is structured\", and click Create and run.",
      "Open the task row to watch its live activity, then read its output when it finishes.",
      "When you are comfortable, switch the project to Edit files and try a workflow.",
    ] },
  ] },

  /* ---------------- Connections ---------------- */
  { id: "connect-claude", group: "Connections", title: "Connect Claude Code", blocks: [
    { p: "Connecting has three stages, and the Connect AI window walks you through them." },
    { steps: [
      "Installed: the app checks that the claude command exists. If not, it shows the install command.",
      "Signed in: if Claude Code is not signed in, click Sign in. Anthropic's own sign-in page opens in your browser. Finish there, and the app notices within a few seconds.",
      "Allowed: the app lists what it will do (run agents in your connected folders, edit files there as each project allows, use your plan's usage). Click Allow.",
    ] },
    { p: "The sidebar card and the top-right badge turn green when a provider is connected. Disconnect any time in Settings → Connections." },
    { note: "The app never sees or stores your password or tokens. Claude Code keeps its own login. API-key environment variables are removed from every agent process, so a run is never billed to an API account by accident.", tone: "info" },
  ] },
  { id: "connect-agy", group: "Connections", title: "Connect Antigravity (optional)", blocks: [
    { p: "Antigravity adds Gemini and other models. It is a good fit for cheap steps such as research, checks and docs, which saves your Claude usage for harder work." },
    { h: "If Antigravity is not installed" },
    { p: "Nothing about it is shown: no Antigravity row in Connections, no Gemini models in the model picker, and no Gemini switch in the agent library. The app runs on Claude Code only." },
    { h: "If Antigravity is installed" },
    { steps: [
      "Sign in to Antigravity once: open the Antigravity app, or run agy in a terminal and follow its sign-in.",
      "In Settings → Connections (or Connect AI), Antigravity shows \"Signed in\" with the number of models available to you.",
      "Click Allow. Its models now appear under Antigravity in every model picker.",
    ] },
    { note: "If Antigravity is installed but not signed in, the row shows \"Check again\". Sign in, then click it.", tone: "info" },
  ] },

  /* ---------------- Using the app ---------------- */
  { id: "projects", group: "Using the app", title: "Projects", blocks: [
    { p: "A project is a folder on this computer. Tasks, workflows and executions belong to one project, while agents and rules are shared by all projects." },
    { steps: [
      "Projects → Connect project.",
      "Paste the folder's full path. The app checks that it exists, and detects its git branch and stack (Node, TypeScript, Next.js, Python, Supabase and so on).",
      "Choose the agent access level (see the table).",
      "Switch between projects with the project picker in the top bar.",
    ] },
    { table: { head: ["Access", "What agents can do", "Use it for"], rows: [
      ["Read only (plan)", "Read files and plan; no edits or commands", "First runs, reviews, questions"],
      ["Edit files", "Edit files; other tools follow your Claude Code settings", "Everyday work"],
      ["Full access", "Run any tool without asking", "Sandboxes and throwaway copies only"],
    ] } },
    { note: "Disconnecting a project removes its tasks, workflows and executions from the app. Files in the folder are never touched.", tone: "warn" },
  ] },
  { id: "agents", group: "Using the app", title: "Agents", blocks: [
    { p: "An agent is a reusable specialist: a model, a role, skills, standing instructions, an effort level and an icon. Tasks and workflow steps can use an agent, and its details go into every prompt it runs." },
    { h: "Add from the library" },
    { steps: [
      "Agents → Agent library.",
      "Select agents by group: Plan, Build, Verify, Ship. Agents you already added are greyed out.",
      "Optional, shown only if Antigravity is installed and allowed: turn on \"Run fast roles on Gemini Flash\" to put simple roles on a cheaper model.",
      "Click Add.",
    ] },
    { table: { head: ["Group", "Agents"], rows: [
      ["Plan", "Researcher, Planner, Technical Lead, Solution Architect"],
      ["Build", "Implementer, Frontend Engineer, Backend Engineer, Database Expert, Refactorer"],
      ["Verify", "Test Engineer, QA Tester, Code Reviewer, Security Reviewer, Debugger, Performance Expert"],
      ["Ship", "DevOps Engineer, Docs Writer, UX Reviewer"],
    ] } },
    { h: "Create your own" },
    { steps: [
      "Agents → New agent.",
      "Name it and pick a model and effort level.",
      "Write the role in one sentence, add skills (press Enter after each), and pick an icon.",
      "Write short standing instructions: the files it owns, how to answer, what to avoid. They are sent with every call, so keep them brief.",
      "Save. Use Chat to try it out before putting it in a workflow.",
    ] },
  ] },
  { id: "models", group: "Using the app", title: "Models and effort", blocks: [
    { table: { head: ["Model", "Provider", "Best for"], rows: [
      ["Default (recommended)", "Claude Code", "Your plan's recommended model (Opus 5.5 today)"],
      ["Opus 5.5", "Claude Code", "Complex work, architecture, final reviews"],
      ["Sonnet 5.5", "Claude Code", "Features, fixes and reviews, at good efficiency"],
      ["Fable 5.2", "Claude Code", "The toughest problems"],
      ["Haiku 5.5", "Claude Code", "Fast, cheap steps: research, checks, small edits"],
      ["Gemini, GPT-OSS and others", "Antigravity", "Whatever your Antigravity account offers; Flash models are the cheapest"],
    ] } },
    { p: "The coloured dot beside a model shows its tier: green is fast and cheapest, amber is balanced, red is deep reasoning." },
    { p: "Effort (Auto, Low, Medium, High, X-High, Max) sets how long the model thinks. Higher effort can be better on hard steps but uses more tokens. Auto uses the provider's default. You can set it on an agent, a task or a workflow node; the most specific one wins." },
  ] },
  { id: "tasks", group: "Using the app", title: "Tasks", blocks: [
    { p: "A task is one agent run in the current project." },
    { steps: [
      "Tasks → New task (or the New task button in the sidebar).",
      "Enter a title, then pick an agent (optional), a model and an effort level. Choosing an agent sets its model.",
      "Write the instructions: what to do, which files it owns, and how to check it worked.",
      "Click Create and run, or Add to queue to start it later.",
      "Click the row to see its live activity, the tools it used, files changed, tokens, duration and final output.",
      "Use Stop to end a running task, and Re-run to start it again.",
    ] },
    { table: { head: ["Status", "Meaning"], rows: [
      ["Queued", "Created, not started"],
      ["Working", "The agent is running now"],
      ["Done", "Finished successfully"],
      ["Blocked", "Stopped, failed, or the model reported an error. The reason is shown in the details"],
    ] } },
  ] },
  { id: "workflows", group: "Using the app", title: "Workflows (node editor)", blocks: [
    { p: "A workflow is a graph of steps, like n8n. Data flows left to right: each step receives the output of the steps connected into it." },
    { h: "Build one" },
    { steps: [
      "Workflows → New workflow. It starts with a trigger plus Plan, Implement and Review steps.",
      "Click + (top right of the canvas) to open \"What happens next?\" and add a node. It connects after the selected node.",
      "Drag from a node's right dot to another node's left dot to connect them. Select a line and press Delete to remove it.",
      "Click a node to open its settings on the right.",
      "Rename the workflow in the top bar, then click Save or press Ctrl+S.",
    ] },
    { table: { head: ["Node", "What it does"], rows: [
      ["Manual trigger", "Starts the run. Each workflow has one"],
      ["Claude agent", "Runs one step with an agent, model and effort. Turn on Can edit files to let it change files (otherwise it is read-only)"],
      ["If", "Checks whether its input contains some text and routes to the true or false output. For example, a reviewer replies PASS: true goes to Merge, false goes back to a fix step"],
      ["Merge", "Waits for its inputs and joins their outputs"],
      ["Sticky note", "A note on the canvas. It never runs"],
    ] } },
    { h: "Run it" },
    { steps: [
      "Click Execute workflow. Unsaved changes are saved first.",
      "Nodes show live badges: blue spinner running, green tick done, red cross failed, grey skipped.",
      "The execution bar at the bottom shows each node's output. Click one to open it.",
      "Use Stop to end a run early.",
    ] },
    { note: "Only one branch of an If node runs; nodes on the other branch are marked skipped. A failed step stops the whole run.", tone: "info" },
  ] },
  { id: "executions", group: "Using the app", title: "Executions", blocks: [
    { p: "Every workflow run in the current project, newest first, with its trigger, completed nodes, tokens, duration and status. Click a row to read each node's full output. Failed nodes open automatically." },
  ] },
  { id: "chat", group: "Using the app", title: "Chat and /lean", blocks: [
    { p: "Chat asks questions about the current project. Chat is read-only: the agent can read files but cannot change them." },
    { list: [
      "Pick an agent to answer with its role and skills, or choose a model directly.",
      "Start a message with /lean to get a staged plan: the smallest checkpoints, the model each one needs, which files each touches, and how to verify it.",
      "The box on the Overview page (Run /lean) does the same thing.",
      "Chat history is saved in this browser, separately for each project. Clear removes it.",
    ] },
  ] },
  { id: "analytics", group: "Using the app", title: "Overview and Analytics", blocks: [
    { list: [
      "Tokens are the totals each CLI reports at the end of a run: input, output and cache.",
      "Est. value on a task is Claude Code's own price estimate. On a subscription plan this is not a charge.",
      "Success rate counts finished tasks and runs that ended without an error.",
      "The model router card shows how your tasks are spread across models.",
    ] },
  ] },
  { id: "rules", group: "Using the app", title: "Rules and guardrails", blocks: [
    { p: "Settings → Rules & guardrails holds short rules that are added to every task, workflow step and chat. The defaults keep agents in their lane, stop them from guessing, keep answers short, and make them ask before anything destructive." },
    { note: "Every rule is sent with every call. Ten short rules cost less than three long ones.", tone: "info" },
  ] },

  /* ---------------- Saving tokens ---------------- */
  { id: "save-tokens", group: "Saving tokens", title: "How to spend fewer tokens", blocks: [
    { steps: [
      "Route by difficulty: Haiku or Gemini Flash for research, checks and docs; Sonnet for building; Opus or Fable only for design and final review.",
      "Keep agent instructions and rules short. They are sent with every call.",
      "Give tasks exact file names and goals so agents don't search the whole repository.",
      "Use read-only steps (Can edit files off) for planning and review.",
      "Leave effort on Auto, and raise it only on steps that need it.",
      "Delegra already starts Claude agents without your MCP servers and skills, which saves about 9K tokens on every call.",
      "In workflows, pass work forward step by step instead of giving every step the full goal again. The app already sends only the previous step's output.",
    ] },
  ] },

  /* ---------------- Reference ---------------- */
  { id: "privacy", group: "Reference", title: "Data, privacy and security", blocks: [
    { list: [
      "All app data (projects, agents, tasks, workflows, runs, rules and the permission grants) is stored as JSON in the app's data folder on this computer. It is not committed to git.",
      "The server listens on 127.0.0.1 only and rejects requests from other websites, so a page you visit cannot start agents.",
      "Prompts reach the CLIs through standard input, never through a shell command line.",
      "Claude Code and Antigravity keep their own logins; the app never reads them.",
      "Agents work only inside connected folders, at that project's access level.",
    ] },
  ] },
  { id: "troubleshooting", group: "Reference", title: "Troubleshooting", blocks: [
    { table: { head: ["Problem", "Fix"], rows: [
      ["\"Connect Claude first\" when running", "Settings → Connections → Allow next to Claude Code"],
      ["Claude Code shows Not installed", "npm install -g @anthropic-ai/claude-code, then Check again"],
      ["Sign in does nothing", "Run claude auth login in a terminal, then Check again"],
      ["No Antigravity option anywhere", "Antigravity is not installed on this computer; that is expected. Install it to enable it"],
      ["Antigravity says Check again", "Open Antigravity or run agy once to sign in"],
      ["\"Use the full path of an existing folder\"", "Paste an absolute path, for example E:\\Projects\\my-app"],
      ["A task stays Blocked", "Open it: the error is shown. Common causes are a read-only project, or a step that needs a tool its access level does not allow"],
      ["The page does not update live", "Reload. The app reconnects to the live update stream"],
    ] } },
  ] },
  { id: "deploy", group: "Reference", title: "Running it on a server", blocks: [
    { p: "Today the app runs on the same computer as your project folders and AI logins. That is how it reaches the CLIs. A copy deployed to a server cannot use your computer's folders or logins." },
    { p: "The planned hosted version splits the app in two: a hosted dashboard (website, accounts, database, job queue) and a small local runner you start on your computer. The runner opens an outgoing connection, runs agents in your folders with your own logins, and streams progress back. Your logins never leave your computer." },
  ] },
  { id: "shortcuts", group: "Reference", title: "Keyboard shortcuts", blocks: [
    { table: { head: ["Where", "Keys", "Action"], rows: [
      ["Workflow editor", "Ctrl+S", "Save"],
      ["Workflow editor", "Delete / Backspace", "Delete the selected node or line"],
      ["Chat", "Enter", "Send"],
      ["Chat", "Shift+Enter", "New line"],
      ["Agent form", "Enter in Skills", "Add the skill"],
    ] } },
  ] },
];

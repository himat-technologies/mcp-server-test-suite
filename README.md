<div align="center">

# 🧪 MCP Server Test Suite & Protocol Benchmark Runner

### Validate MCP manifests · Inspect JSON-RPC · Check tool schemas · Export tests

<a href="https://himat.tech/free-tools/mcp-server-test-suite"><img src="https://img.shields.io/badge/🚀_Live_Demo-Open_Tool-8B5CF6?style=for-the-badge" alt="Live demo"></a>
<a href="https://github.com/himat-technologies/mcp-server-test-suite"><img src="https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github" alt="GitHub repository"></a>
<img src="https://img.shields.io/badge/Privacy-Local--First-16A34A?style=for-the-badge&logo=shield" alt="Local-first privacy">

<img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=20232A" alt="React">
<img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
<img src="https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite">
<img src="https://img.shields.io/badge/Ajv-JSON_Schema-EF4444?style=flat-square" alt="Ajv">
<img src="https://img.shields.io/badge/Vitest-Tests-6E9F18?style=flat-square&logo=vitest&logoColor=white" alt="Vitest">

**A local-first developer utility by Himat Technologies.** Author test manifests, validate protocol fixtures, test tool schemas, scan for likely secrets, measure local validation performance, and generate test code and CI templates.

[Try the live tool](https://himat.tech/free-tools/mcp-server-test-suite) · [Report an issue](https://github.com/himat-technologies/mcp-server-test-suite/issues) · [Contact us](mailto:info@himat.co.in)

</div>

---

## 🎯 Overview

MCP Server Test Suite is a standalone React + TypeScript utility for authoring and validating Model Context Protocol test manifests. Its bundled test presets and mock runner do not need credentials, an account, a backend, or a connection to a real MCP server.

> **Mock vs. real server:** The browser runner validates manifests, JSON-RPC-shaped message fixtures, declared tool schemas and tool argument samples. It does not prove a real server is available or compliant. The benchmark measures local browser-side validation work—not network or production MCP latency. Real stdio/HTTP transport is not part of this browser-only implementation.

## 🌈 Features

| Feature | Description |
| --- | --- |
| 🧩 **5 presets** | Filesystem, Brave Search, Knowledge Graph Memory, PostgreSQL, and Custom. Sample fixtures do not require service credentials. |
| 🧾 **Manifest editor** | Edit, format, import, validate, copy and download JSON. Invalid JSON produces readable errors rather than crashing the editor. |
| ✅ **Protocol assertions** | Required manifest fields, JSON-RPC request/notification/response structure, initialize parameters, discovery fixtures, and expected-error fixture checks. |
| 🧰 **Tool schemas** | Ajv validation for required fields, data types, nested values, enums and unexpected properties; valid and invalid sample arguments. |
| 📈 **Local benchmark** | Configurable iterations, warmups and threshold; average, min/max, median, approximate p95, throughput, payload size and latency chart. Clearly labelled mock/local. |
| 🔐 **Secret scanner** | Pattern-based findings for API-key-like strings, GitHub tokens, bearer tokens, credential assignments, cloud identifiers and private-key blocks; sanitized preview and export. |
| 🧑‍💻 **Code export** | Generates TypeScript/Vitest and Python/pytest checks from the current manifest. Download individual outputs or a ZIP project. |
| ⚙️ **CI/CD template** | Downloadable GitHub Actions workflow with install, test and build steps. |
| 🕘 **Run history** | Local summary history, report reopening, JSON/HTML export, and clear-history control. |
| 📱 **Responsive interface** | Charcoal surfaces, purple accents, accessible controls and mobile layout. |

## 🖥️ Screenshot

After launching the app, capture a screenshot and save it as `docs/images/app-preview.png`. Then replace this placeholder with:

```markdown
![MCP Server Test Suite application preview](docs/images/app-preview.png)
```

A real screenshot is not bundled yet.

## ⚡ Quick start

### Prerequisites

- [Node.js](https://nodejs.org/) LTS (Node.js 20+ recommended)
- npm (installed with Node.js)
- Git, if cloning the repository

### 1. Clone

```bash
git clone https://github.com/himat-technologies/mcp-server-test-suite.git
cd mcp-server-test-suite
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start development

```bash
npm run dev
```

Open the local URL printed by Vite, typically `http://127.0.0.1:5173`.

### 4. Check and build

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

## 🧭 How to use it

1. Select a server preset.
2. Inspect and edit the JSON manifest. Use **Import** for a `.json` file.
3. Resolve required-field or syntax errors reported under the editor.
4. Select **Run test suite**. Each result uses local validation logic and can be expanded for expected/actual evidence.
5. Use **Redact secrets** to inspect potential credential matches. Review the sanitized preview before export.
6. In **Latency & performance**, adjust iterations, warmups and the average-latency threshold. These times cover local validation only.
7. In **Code export**, select TypeScript, Python, GitHub Actions or generated README. Copy or download outputs, or export a generated ZIP.
8. Reopen a prior summary in **Run history**, export reports, or clear saved history.

## 🗂️ Manifest format

Each manifest has a unique ID, name, description, server type, protocol version, capabilities, tool definitions, and request frames. Tool definitions use JSON Schema-style `inputSchema` objects and can include sample arguments with expected validity.

```json
{
  "id": "example-suite-v1",
  "name": "Example MCP Test Suite",
  "description": "Fixture-only protocol and tool schema tests",
  "serverType": "custom",
  "protocolVersion": "2024-11-05",
  "capabilities": ["tools"],
  "tools": [{
    "name": "hello",
    "description": "Returns a fixture greeting",
    "inputSchema": {
      "type": "object",
      "properties": { "name": { "type": "string", "minLength": 1 } },
      "required": ["name"],
      "additionalProperties": false
    },
    "samples": [
      { "args": { "name": "MCP" }, "expectedValid": true },
      { "args": {}, "expectedValid": false, "label": "Missing name" }
    ]
  }],
  "frames": [{
    "name": "Initialize",
    "request": {
      "jsonrpc": "2.0", "id": 1, "method": "initialize",
      "params": {
        "protocolVersion": "2024-11-05",
        "capabilities": {},
        "clientInfo": { "name": "local-suite", "version": "1.0.0" }
      }
    }
  }]
}
```

The runtime manifest validator checks required fields and broad data types. Ajv validates tool input argument examples against the declared schema. JSON-RPC shape checks distinguish requests, notifications and responses instead of requiring identical fields on each.

## ➕ Add a preset

1. Add a manifest to `PRESETS` in `src/data/presets.ts` using the `TestManifest` interface in `src/types/manifest.ts`.
2. Add its display item to `PRESET_OPTIONS`.
3. Include at least one valid sample and one invalid sample for tool schemas, where applicable.
4. Add cases to `tests/engine.test.ts`.
5. Run `npm test`, `npm run typecheck`, and `npm run build`.

Use **Custom manifest** to test a manifest without changing source code.

## 🧑‍💻 Generated test suites

### TypeScript + Vitest

The TypeScript export derives test fixtures from the current manifest and uses Vitest and Ajv. In the generated folder:

```bash
npm install --save-dev vitest ajv
npx vitest run
```

### Python + pytest

The Python export derives tests from the selected manifest and uses pytest and jsonschema:

```bash
python -m pip install pytest jsonschema
python -m pytest
```

These exporters generate manifest/schema fixture checks, not an automatically connected live-server client. They use no real credentials. Review the outputs and add official MCP SDK transport tests separately if you need live server integration.

## ⚙️ GitHub Actions

Download the workflow from the **CI/CD** tab and place it at `.github/workflows/mcp-tests.yml`. The template installs dependencies, runs `npm test`, and runs `npm run build`. Adapt those commands to your repository scripts. This workflow is a template; the generated file has not been executed against your target repository or against a live MCP server.

## 🔒 Privacy & security

- Manifest editing, mock assertions, tool schema validation, scanning and code generation run inside the browser.
- The app does not require accounts, database access, API keys or prompt uploads for core mock validation.
- Run history stores summaries and assertion evidence in browser `localStorage`; some evidence may include manifest-derived data. Treat browser storage as potentially sensitive, clear history after working with private manifests, and do not rely on it as a secure vault.
- Secret scanning is heuristic and may miss credentials or flag harmless strings. It is not a guarantee of complete detection.
- Do not add production credentials to manifests. Review all findings and sanitized output before sharing.
- The browser application does not spawn local processes or connect to MCP stdio servers. Actual remote and stdio transport execution is not implemented in this build.
- No analytics or telemetry is intentionally included. Dependency installation itself may access the npm registry.

## 🏗️ Project structure

```text
mcp-server-test-suite/
├── index.html
├── package.json
├── README.md
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── styles.css
│   ├── data/presets.ts
│   ├── engine/
│   │   ├── manifestValidator.ts
│   │   ├── jsonRpcValidator.ts
│   │   ├── schemaValidator.ts
│   │   ├── mcpAssertions.ts
│   │   ├── benchmark.ts
│   │   ├── secretScanner.ts
│   │   ├── codeGenerator.ts
│   │   └── reportExporter.ts
│   ├── types/manifest.ts
│   └── utils/files.ts
└── tests/
    ├── setup.ts
    └── engine.test.ts
```

## 🧪 Test coverage and limitations

Automated tests cover bundled preset and manifest validation, malformed JSON, JSON-RPC message types, tool JSON Schema examples, secret detection/redaction, controlled-clock benchmark statistics, deliberately invalid tool calls, and manifest-specific code exports.

The current project deliberately implements a **browser-local mock workflow**. It does not claim full support for every MCP specification version, launch arbitrary processes, implement official MCP SDK transports, or benchmark a real remote server. Error fixtures are only meaningful when a manifest supplies an actual response fixture for comparison; a method name alone does not generate proof of remote error handling. Inspect the code and validate a real-server integration separately before using it for production certification.

## 🧯 Troubleshooting

**`npm` is not recognized:** install Node.js from [nodejs.org](https://nodejs.org/), restart your terminal, then check `node -v` and `npm -v`.

**Vite is missing or package installation is inconsistent (PowerShell):**

```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item package-lock.json -Force -ErrorAction SilentlyContinue
npm install
npm run dev
```

**Manifest invalid:** confirm JSON syntax and required keys: `id`, `name`, `description`, `serverType`, `protocolVersion`, `capabilities`, `tools`, and `frames`.

**Variable benchmark results:** browser activity and JIT compilation influence timing. Local results are not production network/server measurements.

## 🤝 Contributing

1. Open an [issue](https://github.com/himat-technologies/mcp-server-test-suite/issues) describing the use case.
2. Keep protocol and schema validation independent from the React UI.
3. Add deterministic tests for new behavior.
4. Run type-checks, tests, lint and production build before a pull request.
5. Never commit API keys, passwords, private keys, or sensitive raw test reports.

## 📄 License

A license has not been selected in this README. Add the intended `LICENSE` file once the project license is confirmed.

---

<div align="center">

## Built for developers by Himat Technologies

**Build systems, not just websites.**

[🌐 Website](https://himat.co.in) · [💻 GitHub](https://github.com/Himat-developers) · [🔗 LinkedIn](https://www.linkedin.com/in/himat-technologies-14b1051b4) · [📸 Instagram](https://www.instagram.com/himat_technologies?stkn=djdmcGxweWtwYWI0) · [📘 Facebook](https://www.facebook.com/people/Himat-technologies/61593829197445/)

**Email:** [info@himat.co.in](mailto:info@himat.co.in) · **Phone / WhatsApp:** [+91 94452 34023](https://wa.me/919445234023)

[**Open the live MCP Server Test Suite →**](https://himat.tech/free-tools/mcp-server-test-suite)

</div>

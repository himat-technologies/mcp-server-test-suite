import { useMemo, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowDownToLine, BadgeCheck, Braces, Check, CheckCircle2, ChevronDown, ChevronRight,
  CircleHelp, Clipboard, Code2, FileCode2, FileJson, FileText, FlaskConical, Folder, Gauge,
  Github, History, KeyRound, LockKeyhole, Play, RefreshCcw, Search, Shield, Sparkles, Upload, WandSparkles, XCircle,
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getPreset, PRESET_OPTIONS } from './data/presets';
import type { AssertionResult, RunReport, ServerPreset, TestManifest } from './types/manifest';
import { validateManifestText } from './engine/manifestValidator';
import { runAssertions, summarizeResults } from './engine/mcpAssertions';
import { runBenchmark } from './engine/benchmark';
import { redactJsonText, scanSecrets } from './engine/secretScanner';
import { generateGithubWorkflow, generatePythonTests, generateTypeScriptTests, generatedReadme } from './engine/codeGenerator';
import { reportAsHtml } from './engine/reportExporter';
import { bytes, copyText, downloadText } from './utils/files';

const stringify = (value: unknown) => JSON.stringify(value, null, 2);
const storageKey = 'himat-mcp-suite-history-v1';
const preferencesKey = 'himat-mcp-suite-preferences-v1';
function readHistory(): RunReport[] {
  try { const data = JSON.parse(localStorage.getItem(storageKey) ?? '[]'); return Array.isArray(data) ? data.slice(0, 20) : []; } catch { return []; }
}
function App() {
  const [preset, setPreset] = useState<ServerPreset>('filesystem');
  const [manifestText, setManifestText] = useState(() => stringify(getPreset('filesystem')));
  const [results, setResults] = useState<AssertionResult[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [validation, setValidation] = useState(() => validateManifestText(stringify(getPreset('filesystem'))));
  const [activeTab, setActiveTab] = useState<'assertions' | 'benchmark' | 'cicd' | 'export' | 'history'>('assertions');
  const [subExport, setSubExport] = useState<'typescript' | 'python' | 'workflow' | 'readme'>('typescript');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [history, setHistory] = useState<RunReport[]>(readHistory);
  const [selectedReport, setSelectedReport] = useState<RunReport | null>(null);
  const [findings, setFindings] = useState<ReturnType<typeof scanSecrets>>([]);
  const [sanitized, setSanitized] = useState('');
  const [showSanitized, setShowSanitized] = useState(false);
  const [iterations, setIterations] = useState(60);
  const [warmups, setWarmups] = useState(5);
  const [threshold, setThreshold] = useState(5);
  const [benchmark, setBenchmark] = useState<Awaited<ReturnType<typeof runBenchmark>> | null>(null);
  const [benchmarkBusy, setBenchmarkBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => validation.manifest, [validation]);
  const suiteName = parsed?.name ?? 'Custom manifest';
  const output = useMemo(() => {
    if (!parsed) return '';
    if (subExport === 'typescript') return generateTypeScriptTests(parsed);
    if (subExport === 'python') return generatePythonTests(parsed);
    if (subExport === 'workflow') return generateGithubWorkflow();
    return generatedReadme(parsed);
  }, [parsed, subExport]);
  const metrics = useMemo(() => ({
    total: results.length,
    passed: results.filter(r => r.status === 'PASS').length,
    failed: results.filter(r => r.status === 'FAIL').length,
    skipped: results.filter(r => r.status === 'SKIPPED').length,
  }), [results]);
  const flash = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2600); };

  function loadPreset(nextPreset: ServerPreset) {
    const next = stringify(getPreset(nextPreset));
    setPreset(nextPreset); setManifestText(next); setValidation(validateManifestText(next)); setResults([]); setBenchmark(null); setFindings([]); setSanitized(''); setShowSanitized(false); setSelectedReport(null);
  }
  function editManifest(text: string) {
    setManifestText(text); const next = validateManifestText(text); setValidation(next); setResults([]); setFindings([]); setSanitized(''); setShowSanitized(false);
  }
  function formatJson() {
    try { editManifest(stringify(JSON.parse(manifestText))); flash('Manifest formatted'); }
    catch { flash('Cannot format invalid JSON'); }
  }
  async function runSuite() {
    const valid = validateManifestText(manifestText); setValidation(valid);
    if (!valid.valid || !valid.manifest) { flash('Fix manifest validation errors first'); setActiveTab('assertions'); return; }
    setBusy(true); setActiveTab('assertions');
    await new Promise(resolve => window.setTimeout(resolve, 160));
    const start = performance.now();
    const actualResults = runAssertions(valid.manifest, manifestText);
    const duration = performance.now() - start;
    setResults(actualResults); setExpanded(null);
    const report = summarizeResults(actualResults, duration, preset, valid.manifest.name);
    const next = [report, ...history].slice(0, 20); setHistory(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { flash('Run complete; browser storage quota prevented history save'); }
    setBusy(false); flash(`Suite complete · ${report.passed} passed · ${report.failed} failed`);
  }
  function redact() {
    const result = redactJsonText(manifestText); setFindings(result.findings); setSanitized(result.text); setShowSanitized(true);
    if (!result.findings.length) flash('No supported secret patterns found'); else flash(`${result.findings.length} possible secret(s) found and redacted`);
  }
  async function runBench() {
    const valid = validateManifestText(manifestText);
    if (!valid.valid || !valid.manifest) { flash('Fix manifest JSON before benchmarking'); return; }
    setBenchmarkBusy(true); setBenchmark(null);
    try {
      const fixture = stringify({ protocol: 'mock', method: 'tools/list', tools: valid.manifest.tools });
      const result = await runBenchmark({ iterations, warmups, thresholdMs: threshold, payload: fixture }, () => {
        // Exercise the actual local schema-validation workload, not network I/O.
        for (const tool of valid.manifest!.tools) { if (tool.samples?.[0]) JSON.stringify(tool.samples[0].args); }
        validateManifestText(manifestText);
      });
      setBenchmark(result); flash('Mock benchmark completed');
    } catch (error) { flash(error instanceof Error ? error.message : 'Benchmark failed'); }
    finally { setBenchmarkBusy(false); }
  }
  async function importManifest(file?: File) {
    if (!file) return;
    try {
      const text = await file.text(); editManifest(text);
      const next = validateManifestText(text);
      setPreset(next.manifest?.serverType === 'filesystem' || next.manifest?.serverType === 'brave-search' || next.manifest?.serverType === 'knowledge-graph' || next.manifest?.serverType === 'postgresql' ? next.manifest.serverType : 'custom');
      flash(next.valid ? 'Manifest imported and validated' : 'Imported file; validation errors need review');
    } catch { flash('Could not read this file'); }
    if (fileInput.current) fileInput.current.value = '';
  }
  async function copyCurrent(text: string, label: string) { flash(await copyText(text) ? `${label} copied` : 'Clipboard unavailable — select and copy manually'); }
  async function exportZip() {
    const zipModule = await import('jszip'); const Zip = zipModule.default; const zip = new Zip();
    if (!parsed) return;
    zip.file('manifest.json', stringify(parsed)); zip.file('tests/mcp-manifest.test.ts', generateTypeScriptTests(parsed)); zip.file('tests/test_manifest.py', generatePythonTests(parsed)); zip.file('.github/workflows/mcp-tests.yml', generateGithubWorkflow()); zip.file('README.md', generatedReadme(parsed));
    zip.file('package.json', stringify({ private: true, type: 'module', scripts: { test: 'vitest run' }, devDependencies: { vitest: '^2.1.8', ajv: '^8.17.1' } }));
    zip.file('requirements-test.txt', 'pytest\njsonschema\n');
    zip.file('pyproject.toml', '[tool.pytest.ini_options]\nasyncio_mode = "auto"\ntestpaths = ["tests"]\n');
    const blob = await zip.generateAsync({ type: 'blob' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${slug(parsed.name)}-generated-tests.zip`; a.click(); URL.revokeObjectURL(url); flash('Generated test project ZIP downloaded');
  }
  function slug(name: string) { return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'mcp-test-suite'; }
  function selectReport(report: RunReport) { setSelectedReport(report); setResults(report.results); setActiveTab('assertions'); setExpanded(null); }
  function clearHistory() { if (!window.confirm('Clear all locally saved test-run history?')) return; setHistory([]); setSelectedReport(null); try { localStorage.removeItem(storageKey); } catch { /* ignored */ } flash('Local history cleared'); }

  return <div className="shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><Braces size={23} strokeWidth={2.6}/></div><div><h1>MCP Server Test Suite</h1><p>Protocol validation · Benchmarks · Test export</p></div></div>
      <div className="top-actions"><span className="privacy-chip"><span className="live-dot"/> LOCAL-FIRST · NO UPLOADS</span><a className="btn ghost small" href="https://github.com/himat-technologies/mcp-server-test-suite" target="_blank" rel="noreferrer"><Github size={14}/> GitHub</a></div>
    </header>

    <section className="hero">
      <div><div className="eyebrow"><Sparkles size={13}/> Developer reliability toolkit</div><h2>Test your MCP server.<br/><span>Trust your protocol.</span></h2><p>Validate MCP manifests and JSON-RPC fixtures, exercise tool schemas, catch likely exposed credentials, and generate test code. This browser runner uses deterministic local mocks — no target server is contacted.</p></div>
      <div className="hero-actions"><button className="btn" onClick={() => { editManifest(stringify(getPreset(preset))); setResults([]); flash('Preset reset'); }}><RefreshCcw size={14}/> Reset preset</button><button className="btn primary" onClick={runSuite} disabled={busy}><Play size={14} fill="currentColor"/>{busy ? 'Running checks…' : 'Run test suite'}</button></div>
    </section>

    <div className="presets" aria-label="MCP server presets">{PRESET_OPTIONS.map(item => <button key={item.id} className={`preset ${preset === item.id ? 'active' : ''}`} onClick={() => loadPreset(item.id)} aria-pressed={preset === item.id}><div className="preset-code">{item.short} / PRESET</div><strong>{item.label}</strong><p>{item.id === 'filesystem' ? 'File tools & paths' : item.id === 'brave-search' ? 'Search tool fixtures' : item.id === 'knowledge-graph' ? 'Entities & relations' : item.id === 'postgresql' ? 'Query schemas' : 'Your own manifest'}</p></button>)}</div>

    <nav className="tabbar" aria-label="Main navigation">
      <button className={`tab ${activeTab === 'assertions' ? 'active' : ''}`} onClick={() => setActiveTab('assertions')}><BadgeCheck size={14}/> Protocol assertions</button>
      <button className={`tab ${activeTab === 'benchmark' ? 'active' : ''}`} onClick={() => setActiveTab('benchmark')}><Activity size={14}/> Latency & performance</button>
      <button className={`tab ${activeTab === 'cicd' ? 'active' : ''}`} onClick={() => setActiveTab('cicd')}><Github size={14}/> CI/CD</button>
      <button className={`tab ${activeTab === 'export' ? 'active' : ''}`} onClick={() => setActiveTab('export')}><Code2 size={14}/> Code export</button>
      <button className={`tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}><History size={14}/> Run history <span className="badge SKIPPED">{history.length}</span></button>
    </nav>

    <div className="workspace" style={{ marginTop: 16 }}>
      <section className="panel">
        <div className="panel-head"><div className="panel-title"><div className="panel-icon"><FileJson size={16}/></div><div><h3>Manifest editor</h3><p>Edit test suite fixtures · validate as you type</p></div></div><span className={`status-line ${validation.valid ? 'ok' : 'error'}`}>{validation.valid ? <CheckCircle2 size={13}/> : <XCircle size={13}/>} {validation.valid ? 'Valid manifest' : 'Needs attention'}</span></div>
        <div className="panel-body">
          <div className="editor-top"><div className="left"><span className="filetype">manifest.json</span><span className="status-line">{bytes(manifestText).toLocaleString()} bytes</span></div><div className="right"><button className="btn small" onClick={formatJson}><WandSparkles size={12}/> Format</button><button className="btn small" onClick={() => fileInput.current?.click()}><Upload size={12}/> Import</button><input className="hidden-input" ref={fileInput} type="file" accept=".json,application/json" onChange={e => importManifest(e.target.files?.[0])}/></div></div>
          <label className="sr-only" htmlFor="manifest-editor">JSON test manifest</label><textarea id="manifest-editor" spellCheck={false} className="code-editor" value={manifestText} onChange={e => editManifest(e.target.value)} aria-describedby="manifest-status" />
          <div id="manifest-status" className={`status-line ${validation.valid ? 'ok' : 'error'}`} style={{ marginTop: 9 }}>{validation.valid ? <><Check size={12}/> Schema structure passes</> : <><AlertTriangle size={12}/> {validation.errors.length} validation error(s)</>}</div>
          {!validation.valid && <div className="validation-list" role="alert">{validation.errors.slice(0, 8).map((err, i) => <div className="validation-item" key={`${err.path}-${i}`}><XCircle size={13}/><span><strong>{err.path}</strong> — {err.message}</span></div>)}</div>}
          <div className="action-row"><div className="action-group"><button className="btn small" onClick={() => copyCurrent(manifestText, 'Manifest')}><Clipboard size={12}/> Copy JSON</button><button className="btn small" onClick={() => downloadText('manifest.json', manifestText, 'application/json')}><ArrowDownToLine size={12}/> Export JSON</button></div><div className="action-group"><button className="btn small danger" onClick={redact}><Shield size={12}/> Redact secrets</button><button className="btn primary small" onClick={runSuite} disabled={busy || !validation.valid}><Play size={12} fill="currentColor"/> Run</button></div></div>
          <div className="notice" style={{ marginTop: 13 }}><LockKeyhole size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }}/> Manifest editing, mock assertions, code generation, and scanning happen locally in this browser. Only non-sensitive preferences and summarized run history are optionally saved in localStorage.</div>
          {findings.length > 0 && <div style={{ marginTop: 14 }}><div className="mini-heading">Secret scan findings · {findings.length}</div>{findings.map((f, i) => <div className="finding" key={`${f.start}-${i}`}><KeyRound size={15}/><div><strong>{f.kind}</strong><small>{f.location} · {f.severity} · {f.preview}</small></div></div>)}</div>}
          {showSanitized && <div style={{ marginTop: 14 }}><div className="editor-top"><div className="left"><span className="filetype">Sanitized preview</span><span className="status-line">{findings.length} potential finding(s)</span></div><button className="btn small" onClick={() => setShowSanitized(false)}><XCircle size={12}/> Close</button></div><textarea aria-label="Sanitized manifest preview" className="code-editor" style={{ minHeight: 190 }} value={sanitized} onChange={e => setSanitized(e.target.value)} /><div className="action-row"><span className={`status-line ${(() => { try { JSON.parse(sanitized); return 'ok'; } catch { return 'error'; } })()}`}>{(() => { try { JSON.parse(sanitized); return 'Valid JSON preview'; } catch { return 'Invalid JSON — review before export'; } })()}</span><div className="action-group"><button className="btn small" onClick={() => copyCurrent(sanitized, 'Sanitized manifest')}><Clipboard size={12}/> Copy sanitized</button><button className="btn small" onClick={() => downloadText('manifest.sanitized.json', sanitized, 'application/json')}><ArrowDownToLine size={12}/> Download</button></div></div></div>}
        </div>
      </section>

      <section className="panel">
        {activeTab === 'assertions' && <>
          <div className="panel-head"><div className="panel-title"><div className="panel-icon"><FlaskConical size={16}/></div><div><h3>Assertion results</h3><p>{selectedReport ? `Viewing saved run · ${new Date(selectedReport.timestamp).toLocaleString()}` : 'Actual validation logic · local mock mode'}</p></div></div><span className="chip"><span className="live-dot"/> MOCK MODE</span></div>
          <div className="results-summary"><div className="stat"><div className="label"><Gauge size={12}/> Total checks</div><strong>{metrics.total}</strong><small>evaluated checks</small></div><div className="stat pass"><div className="label"><CheckCircle2 size={12}/> Passed</div><strong>{metrics.passed}</strong><small>rules satisfied</small></div><div className="stat fail"><div className="label"><XCircle size={12}/> Failed</div><strong>{metrics.failed}</strong><small>needs review</small></div><div className="stat skip"><div className="label"><CircleHelp size={12}/> Skipped</div><strong>{metrics.skipped}</strong><small>not configured</small></div></div>
          {results.length === 0 ? <div className="empty-state"><FlaskConical size={27}/><strong>Ready when you are</strong>Run the suite to validate manifest structure, JSON-RPC request frames, tool schemas, error fixtures, and possible secret exposure.<div style={{ marginTop: 16 }}><button className="btn primary" onClick={runSuite} disabled={busy || !validation.valid}><Play size={13} fill="currentColor"/> {busy ? 'Running…' : 'Run test suite'}</button></div></div> : <div className="result-list">{results.map(result => <ResultItem key={result.id} result={result} expanded={expanded === result.id} toggle={() => setExpanded(expanded === result.id ? null : result.id)}/>)}</div>}
          <div className="run-footer"><span>Suite: <strong>{suiteName}</strong> · <span>Protocol {parsed?.protocolVersion ?? '—'}</span></span>{results.length ? <div className="action-group"><button className="btn small" onClick={() => { if (selectedReport) { downloadText('mcp-test-report.json', stringify(selectedReport), 'application/json'); } else { const current = summarizeResults(results, 0, preset, suiteName); downloadText('mcp-test-report.json', stringify(current), 'application/json'); } }}><ArrowDownToLine size={12}/> JSON report</button><button className="btn small" onClick={() => { const report = selectedReport ?? summarizeResults(results, 0, preset, suiteName); downloadText('mcp-test-report.html', reportAsHtml(report), 'text/html'); }}><FileText size={12}/> HTML report</button></div> : <span>Awaiting first run</span>}</div>
        </>}

        {activeTab === 'benchmark' && <>
          <div className="panel-head"><div className="panel-title"><div className="panel-icon"><Activity size={16}/></div><div><h3>Latency & performance</h3><p>Browser-timed manifest and schema workload</p></div></div><span className="chip">SIMULATED TARGET</span></div>
          <div className="panel-body"><div className="notice warning"><AlertTriangle size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }}/>This benchmark times local validation work—not a live MCP server or network transport. Use the results to compare local fixture workloads only.</div>
            <div className="row" style={{ marginTop: 17 }}><div className="field"><label htmlFor="iterations">Iterations (1–1000)</label><input id="iterations" type="number" min={1} max={1000} value={iterations} onChange={e => setIterations(Number(e.target.value))}/></div><div className="field"><label htmlFor="warmups">Warm-up runs (0–100)</label><input id="warmups" type="number" min={0} max={100} value={warmups} onChange={e => setWarmups(Number(e.target.value))}/></div></div>
            <div className="field"><label htmlFor="threshold">Average latency threshold (ms)</label><input id="threshold" type="number" min={0} step="0.1" value={threshold} onChange={e => setThreshold(Number(e.target.value))}/><span className="hint">Passes when the average local validation workload is at or below this threshold.</span></div>
            <button className="btn primary" onClick={runBench} disabled={benchmarkBusy || !validation.valid}><Activity size={14}/>{benchmarkBusy ? 'Benchmarking…' : 'Run benchmark'}</button>
            {benchmark && <><div className="benchmark-grid"><div className="benchmark-number"><span>Average</span><strong>{benchmark.average.toFixed(3)} ms</strong></div><div className="benchmark-number"><span>Median</span><strong>{benchmark.median.toFixed(3)} ms</strong></div><div className="benchmark-number"><span>p95 (approx.)</span><strong>{benchmark.p95.toFixed(3)} ms</strong></div><div className="benchmark-number"><span>Minimum</span><strong>{benchmark.min.toFixed(3)} ms</strong></div><div className="benchmark-number"><span>Maximum</span><strong>{benchmark.max.toFixed(3)} ms</strong></div><div className="benchmark-number"><span>Throughput</span><strong>{benchmark.throughput.toFixed(1)}/s</strong></div></div>
              <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={benchmark.samples.map((latency, i) => ({ iteration: i + 1, latency }))}><defs><linearGradient id="latencyFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#b29aff" stopOpacity={0.4}/><stop offset="95%" stopColor="#b29aff" stopOpacity={0.02}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#383144"/><XAxis dataKey="iteration" tick={{ fill: '#a49bb5', fontSize: 10 }} axisLine={{ stroke: '#383144' }} tickLine={false}/><YAxis tick={{ fill: '#a49bb5', fontSize: 10 }} axisLine={false} tickLine={false}/><Tooltip contentStyle={{ background: '#201c2a', border: '1px solid #49405a', borderRadius: 8, color: '#f4f1fb', fontSize: 11 }}/><Area type="monotone" dataKey="latency" stroke="#b29aff" fill="url(#latencyFill)" strokeWidth={2} dot={false}/></AreaChart></ResponsiveContainer></div>
              <div className={`notice ${benchmark.passed ? 'success' : 'warning'}`} style={{ marginTop: 12 }}>{benchmark.passed ? 'Threshold passed.' : 'Threshold exceeded.'} Measured {benchmark.samples.length} local iterations over {benchmark.totalMs.toFixed(2)} ms. Payload: {benchmark.payloadBytes.toLocaleString()} bytes. Mock-local measurements are not production performance.</div><div style={{ marginTop: 14, maxHeight: 200, overflow: 'auto' }}><table className="data-table"><thead><tr><th>Iteration</th><th>Latency (ms)</th><th>Status</th></tr></thead><tbody>{benchmark.samples.slice(0, 100).map((sample, i) => <tr key={i}><td>{i + 1}</td><td>{sample.toFixed(4)}</td><td>{sample <= threshold ? <span className="badge PASS">PASS</span> : <span className="badge FAIL">SLOW</span>}</td></tr>)}</tbody></table>{benchmark.samples.length > 100 && <div className="hint">Showing the first 100 sample rows; statistics include all {benchmark.samples.length} samples.</div>}</div></>}
          </div>
        </>}

        {activeTab === 'cicd' && <>
          <div className="panel-head"><div className="panel-title"><div className="panel-icon"><Github size={16}/></div><div><h3>CI/CD workflow</h3><p>GitHub Actions manifest and application checks</p></div></div><span className="chip">YAML</span></div>
          <div className="panel-body"><div className="notice">Download the workflow and place it at <code>.github/workflows/mcp-tests.yml</code>. It runs repository tests and a production build on pushes and pull requests.</div><div className="mini-heading">Workflow preview</div><textarea className="code-editor" style={{ minHeight: 255 }} aria-label="GitHub Actions workflow preview" readOnly value={generateGithubWorkflow()}/><div className="action-row"><div className="action-group"><button className="btn" onClick={() => copyCurrent(generateGithubWorkflow(), 'Workflow')}><Clipboard size={12}/> Copy YAML</button><button className="btn primary" onClick={() => downloadText('mcp-tests.yml', generateGithubWorkflow(), 'text/yaml')}><ArrowDownToLine size={12}/> Download workflow</button></div></div><div className="mini-heading">Add it to your project</div><ol style={{ color: '#c5bbd3', fontSize: 11, lineHeight: 1.9, paddingLeft: 18 }}><li>Create <code>.github/workflows/</code> in your repository.</li><li>Save the downloaded file as <code>mcp-tests.yml</code>.</li><li>Ensure your repository has passing <code>npm test</code> and <code>npm run build</code> scripts.</li><li>Commit the workflow; check Actions output after the first run.</li></ol><div className="notice warning">Workflow is generated from this app's base validation steps. It has not been executed against your repository or a live MCP target. Add your target's integration tests and secret configuration deliberately.</div></div>
        </>}

        {activeTab === 'export' && <>
          <div className="panel-head"><div className="panel-title"><div className="panel-icon"><Code2 size={16}/></div><div><h3>Generated test code</h3><p>Exported from the currently valid manifest</p></div></div><span className="chip">LOCAL EXPORT</span></div>
          <div className="panel-body"><div className="section-tabs"><button className={subExport === 'typescript' ? 'active' : ''} onClick={() => setSubExport('typescript')}>TypeScript + Vitest</button><button className={subExport === 'python' ? 'active' : ''} onClick={() => setSubExport('python')}>Python + pytest</button><button className={subExport === 'workflow' ? 'active' : ''} onClick={() => setSubExport('workflow')}>GitHub Actions</button><button className={subExport === 'readme' ? 'active' : ''} onClick={() => setSubExport('readme')}>README</button></div>
            <div className="editor-top" style={{ marginTop: 14 }}><div className="left"><span className="filetype">{subExport === 'typescript' ? 'mcp-manifest.test.ts' : subExport === 'python' ? 'test_manifest.py' : subExport === 'workflow' ? 'mcp-tests.yml' : 'README.md'}</span><span className="status-line">{bytes(output).toLocaleString()} bytes</span></div><span className="status-line ok"><CheckCircle2 size={12}/> Generated locally</span></div>
            <textarea className="code-editor" aria-label="Generated test code preview" readOnly value={validation.valid ? output : '// Fix manifest validation errors to enable code export.'} style={{ minHeight: 370 }}/>
            <div className="action-row"><div className="action-group"><button className="btn" onClick={() => copyCurrent(output, 'Generated output')} disabled={!validation.valid}><Clipboard size={12}/> Copy code</button><button className="btn" onClick={() => downloadText(subExport === 'typescript' ? 'mcp-manifest.test.ts' : subExport === 'python' ? 'test_manifest.py' : subExport === 'workflow' ? 'mcp-tests.yml' : 'README.generated.md', output, 'text/plain;charset=utf-8')} disabled={!validation.valid}><ArrowDownToLine size={12}/> Download file</button></div><button className="btn primary" onClick={exportZip} disabled={!validation.valid}><Folder size={12}/> Export project ZIP</button></div>
            <div className="export-box"><div className="export-icon"><FileCode2 size={18}/></div><div className="export-info"><strong>Generated tests are manifest-specific</strong><p>Includes schema fixtures and protocol frame checks derived from the current manifest. Mock code does not connect to a real server; review setup instructions before running.</p></div></div>
            {subExport === 'python' && <div className="notice" style={{ marginTop: 12 }}>Install requirements: <code>python -m pip install pytest jsonschema</code>, then run <code>python -m pytest</code>.</div>}
            {subExport === 'typescript' && <div className="notice" style={{ marginTop: 12 }}>Install requirements: <code>npm install --save-dev vitest ajv</code>, then run <code>npx vitest run</code>.</div>}
          </div>
        </>}

        {activeTab === 'history' && <>
          <div className="panel-head"><div className="panel-title"><div className="panel-icon"><History size={16}/></div><div><h3>Local run history</h3><p>Summaries saved to this browser only</p></div></div><button className="btn small danger" disabled={!history.length} onClick={clearHistory}><XCircle size={12}/> Clear history</button></div>
          <div className="panel-body"><div className="notice"><LockKeyhole size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5 }}/> History stores summary counts and check details—not a raw copy of the manifest. Browser storage is local to this browser profile and can be cleared below.</div>
            {!history.length ? <div className="empty-state"><History size={27}/><strong>No runs saved yet</strong>Run a suite and its summary will appear here.</div> : <div className="history-list" style={{ marginTop: 14 }}>{history.map(report => <div key={report.id} className="history-item"><div><strong>{report.suiteName}</strong><p>{new Date(report.timestamp).toLocaleString()} · {report.total} checks · {report.durationMs.toFixed(2)} ms · mock mode</p><div style={{ display: 'flex', gap: 6, marginTop: 7 }}><span className="badge PASS">{report.passed} PASS</span><span className="badge FAIL">{report.failed} FAIL</span><span className="badge SKIPPED">{report.skipped} SKIP</span></div></div><div className="action-group"><button className="btn small" onClick={() => selectReport(report)}><Search size={12}/> View</button><button className="btn small" onClick={() => downloadText(`mcp-report-${report.id}.json`, stringify(report), 'application/json')}><ArrowDownToLine size={12}/></button></div></div>)}</div>}
          </div>
        </>}
      </section>
    </div>

    <footer className="footer"><span>Built for developers by <strong>Himat Technologies</strong> · Browser-local mock test runner</span><div className="footer-links"><a href="https://himat.tech/free-tools/mcp-server-test-suite" target="_blank" rel="noreferrer">Live demo</a><a href="https://himat.co.in" target="_blank" rel="noreferrer">Website</a><a href="https://www.linkedin.com/in/himat-technologies-14b1051b4" target="_blank" rel="noreferrer">LinkedIn</a><a href="https://www.instagram.com/himat_technologies?stkn=djdmcGxweWtwYWI0" target="_blank" rel="noreferrer">Instagram</a><a href="https://www.facebook.com/people/Himat-technologies/61593829197445/" target="_blank" rel="noreferrer">Facebook</a><a href="mailto:info@himat.co.in">Contact</a></div></footer>
    {toast && <div role="status" style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: '#30263f', border: '1px solid #8267b6', borderRadius: 11, color: '#f4f1fb', padding: '12px 17px', boxShadow: '0 12px 34px #0005', zIndex: 40, maxWidth: 'calc(100vw - 24px)', fontSize: 12 }}>{toast}</div>}
  </div>;
}

function ResultItem({ result, expanded, toggle }: { result: AssertionResult; expanded: boolean; toggle: () => void }) {
  const StatusIcon = result.status === 'PASS' ? CheckCircle2 : result.status === 'FAIL' ? XCircle : CircleHelp;
  return <div className="result-item"><button className="result-button" onClick={toggle} aria-expanded={expanded}><span className={`result-icon ${result.status}`}><StatusIcon size={14}/></span><span className="result-main"><strong>{result.name}</strong><small>{result.explanation}</small></span><span className="result-trailing"><span className={`badge ${result.status}`}>{result.status}</span>{expanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</span></button>{expanded && <div className="result-detail"><div className="detail-grid"><div className="detail-card"><b>Expected</b><pre>{result.expected}</pre></div><div className="detail-card"><b>Actual</b><pre>{result.actual}</pre></div></div>{(result.request !== undefined || result.response !== undefined) && <div className="detail-grid" style={{ marginTop: 9 }}>{result.request !== undefined && <div className="detail-card"><b>Request / evidence</b><pre>{JSON.stringify(result.request, null, 2)}</pre></div>}{result.response !== undefined && <div className="detail-card"><b>Response / evidence</b><pre>{JSON.stringify(result.response, null, 2)}</pre></div>}</div>}<div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>Category: {result.category}</span>{result.durationMs > 0 && <span>Duration: {result.durationMs.toFixed(3)} ms</span>}</div></div>}</div>;
}

export default App;

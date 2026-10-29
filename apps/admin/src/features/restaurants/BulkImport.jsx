import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileUp, Play, Upload } from 'lucide-react';
import { Badge, Button, Card, DataTable, FormField, Switch, Textarea, notify } from '@rrb/ui';
import { api } from '../../lib/api.js';

const VARIANT = { created: 'success', updated: 'primary', skipped: 'warning' };
const SAMPLE = `[
  {
    "name": "Example Cafe",
    "type": "veg",
    "category": "cafe",
    "priceForTwo": 400,
    "address": { "line1": "56 Dukan, Indore", "city": "Indore" },
    "location": { "coordinates": [75.8577, 22.7196] },
    "cuisines": ["Cafe"]
  }
]`;

export default function BulkImport() {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [autoCreate, setAutoCreate] = useState(true);
  const [busy, setBusy] = useState('');
  const [parseErr, setParseErr] = useState('');
  const [result, setResult] = useState(null);

  const loadFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) return setParseErr('That file is larger than 20 MB.');
    setText(await f.text());
    setParseErr('');
    setResult(null);
  };

  const run = async (dryRun) => {
    let rows;
    try {
      const parsed = JSON.parse(text);
      rows = Array.isArray(parsed) ? parsed : parsed?.rows;
      if (!Array.isArray(rows) || !rows.length) throw new Error('Expected a non-empty JSON array of restaurants (or an object with a "rows" array).');
    } catch (e) {
      return setParseErr(e instanceof SyntaxError ? `Invalid JSON: ${e.message}` : e.message);
    }
    setParseErr('');
    setBusy(dryRun ? 'dry' : 'run');
    try {
      const { data } = await api.post('/restaurants/bulk-import', { rows, autoCreate, dryRun }, { timeout: 120000 });
      setResult(data);
      if (!dryRun) {
        qc.invalidateQueries({ queryKey: ['restaurants'] });
        qc.invalidateQueries({ queryKey: ['admin-stats'] });
        qc.invalidateQueries({ queryKey: ['masters'] });
      }
    } catch (e) {
      notify.error({ title: 'Import failed', message: e.message });
    } finally {
      setBusy('');
    }
  };

  const t = result?.totals;
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link to="/restaurants" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text"><ArrowLeft className="h-4 w-4" />Restaurants</Link>
        <h1 className="text-display-md sm:text-display-lg">Bulk import</h1>
        <p className="max-w-2xl text-text-muted">Paste or upload a JSON array of restaurants. Cities, cuisines and amenities are given by name. Run a dry run first to preview what would change.</p>
      </header>
      <Card>
        <Card.Body className="flex flex-col gap-4">
          <FormField label="Restaurants JSON" error={parseErr || undefined} hint={!parseErr ? 'An array of restaurant objects.' : undefined}>
            <Textarea rows={12} value={text} onChange={(e) => { setText(e.target.value); setParseErr(''); }} placeholder={SAMPLE} spellCheck={false} className="font-mono" />
          </FormField>
          <div className="flex flex-wrap items-center gap-3">
            <input id="bulk-file" type="file" accept="application/json,.json" className="sr-only" onChange={loadFile} aria-label="Upload JSON file" />
            <Button as="label" htmlFor="bulk-file" variant="secondary" leftIcon={<Upload className="h-4 w-4" />} className="cursor-pointer">Upload .json</Button>
            <Switch checked={autoCreate} onCheckedChange={setAutoCreate} label="Create missing cities, cuisines and amenities" />
          </div>
        </Card.Body>
        <Card.Footer>
          <Button variant="secondary" loading={busy === 'dry'} disabled={!text.trim() || Boolean(busy)} onClick={() => run(true)} leftIcon={<Play className="h-4 w-4" />}>Dry run</Button>
          <Button loading={busy === 'run'} disabled={!text.trim() || Boolean(busy)} onClick={() => run(false)} leftIcon={<FileUp className="h-4 w-4" />}>Import</Button>
        </Card.Footer>
      </Card>

      {result ? (
        <section aria-label="Import results" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-xl font-medium">{result.dryRun ? 'Dry run result' : 'Import result'}</h2>
            {result.dryRun ? <Badge variant="warning">Nothing was saved</Badge> : null}
            <Badge variant="success">{t.created} created</Badge>
            <Badge variant="primary">{t.updated} updated</Badge>
            <Badge variant="warning">{t.skipped} skipped</Badge>
            <span className="text-sm text-text-muted">of {t.total} rows</span>
          </div>
          <DataTable
            getRowId={(r) => r.index}
            columns={[
              { key: 'index', header: 'Row', width: '4rem', render: (r) => r.index + 1 },
              { key: 'name', header: 'Name', render: (r) => r.name || <span className="text-text-muted">(no name)</span> },
              { key: 'status', header: 'Result', render: (r) => <Badge variant={VARIANT[r.status]}>{r.status}</Badge> },
              { key: 'reason', header: 'Reason', hideOnMobile: false, render: (r) => r.reason || <span className="text-text-muted">-</span> },
            ]}
            rows={result.results}
            emptyTitle="No rows"
          />
        </section>
      ) : null}
    </div>
  );
}

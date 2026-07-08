// Shown when there's no usable public/linear.config.json yet.
export function SetupScreen({ detail }: { detail?: string }) {
  return (
    <div className="center">
      <div className="card-panel">
        <div className="brand-badge" style={{ margin: '0 auto 16px', width: 40, height: 40 }} />
        <h1>Linear MultiBoard</h1>
        <p>
          This app reads your workspaces from a local JSON file of Linear
          personal API keys — no OAuth, no server, nothing leaves your machine.
        </p>
        <ol style={{ textAlign: 'left', lineHeight: 1.7 }}>
          <li>
            Copy <code>public/linear.config.example.json</code> to{' '}
            <code>public/linear.config.json</code>.
          </li>
          <li>
            In <strong>each</strong> Linear workspace, create a personal API key
            at <code>Settings → Security &amp; access → Personal API keys</code>{' '}
            (settings are per-workspace, so make one key per workspace).
          </li>
          <li>
            Add one <code>{'{ "label": "...", "apiKey": "..." }'}</code> entry per
            workspace to the <code>workspaces</code> array.
          </li>
          <li>Save the file and refresh this page.</li>
        </ol>
        {detail && <p className="muted">{detail}</p>}
      </div>
    </div>
  )
}

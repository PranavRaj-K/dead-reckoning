import { useGame } from './app/useGame';
import { Briefing } from './components/Briefing';
import { Build } from './components/Build';
import { Debrief } from './components/Debrief';
import { Operate } from './components/Operate';
import { TopBar } from './components/TopBar';

function Boot({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="boot">
      <div className="boot-orbit" aria-hidden="true">
        <span className="boot-earth" />
        <span className="boot-sat" />
      </div>
      {error ? (
        <>
          <h1>Data link failed</h1>
          <p className="lede small">{error}</p>
          <button className="btn btn-primary" onClick={onRetry}>
            Retry the fetch
          </button>
          <p className="note small">
            The build ships with a bundled snapshot, so a working offline copy should still
            load. A persistent failure here means storage and the bundled snapshot both failed.
          </p>
        </>
      ) : (
        <>
          <h1>Establishing data link</h1>
          <p className="lede small">
            Requesting the reference orbit from CelesTrak and the space-weather window from
            NASA DONKI. If either does not answer, a timestamped snapshot is used and labelled.
          </p>
          <div className="boot-lines" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </>
      )}
    </div>
  );
}

function App() {
  const game = useGame();

  if (!game.env) {
    return (
      <div className="app">
        <TopBar env={null} screen={game.screen} mission={null} onNavigate={game.go} />
        <main className="main">
          <Boot error={game.envError} onRetry={game.retry} />
        </main>
      </div>
    );
  }

  const { mission, result, budgets, validation } = game;

  return (
    <div className="app">
      <TopBar env={game.env} screen={game.screen} mission={mission} onNavigate={game.go} />
      <main className="main">
        {game.screen === 'briefing' ? (
          <Briefing env={game.env} onStart={() => game.go('build')} />
        ) : null}

        {game.screen === 'build' && budgets && validation ? (
          <Build
            design={game.design}
            budgets={budgets}
            validation={validation}
            seed={game.seed}
            onSlot={game.setSlot}
            onPreset={game.choosePreset}
            onDesign={game.setDesign}
            onSeed={game.setSeed}
            onLaunch={game.launch}
          />
        ) : null}

        {game.screen === 'operate' && mission ? (
          <Operate
            state={mission}
            paused={game.paused}
            speed={game.speed}
            onPause={game.setPaused}
            onSpeed={game.setSpeed}
            onSkipScene={game.skipScene}
            onResolve={game.salvage}
            onDebrief={() => game.go('debrief')}
          />
        ) : null}

        {game.screen === 'debrief' && mission && result ? (
          <Debrief
            mission={mission}
            result={result}
            runs={game.runs}
            onRestart={game.restart}
            onNewDesign={() => game.go('build')}
          />
        ) : null}

        {game.screen === 'debrief' && (!mission || !result) ? (
          <div className="empty-state">
            <h1>No completed mission</h1>
            <p className="lede small">Design a spacecraft and fly the window first.</p>
            <button className="btn btn-primary" onClick={() => game.go('briefing')}>
              Back to the briefing
            </button>
          </div>
        ) : null}
      </main>

      <footer className="footer">
        <span>Dead Reckoning · NASA Space Apps 2026</span>
        <span className="dim">
          Data: CelesTrak GP/OMM, NASA DONKI · Not affiliated with NASA · Educational model, not a
          flight prediction
        </span>
        {game.env ? <span className="mono dim">snapshot loaded {game.env.loadedAtUtc.slice(11, 19)}Z</span> : null}
      </footer>
    </div>
  );
}

export default App;

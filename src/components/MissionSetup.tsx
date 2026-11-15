import { LAUNCHES, OBJECTIVES, ORBITS, orbitById } from '../sim/catalogue';
import { MAX_CREW, ROLES, ownerOf, resizeCrew } from '../sim/crew';
import type { DataSnapshot, Design, GpElements, MissionChoice, OrbitId } from '../sim/types';
import { num, usd } from '../lib/format';

/**
 * Mission-level decisions, made before any part: what the mission is for, which
 * real orbit it flies, and how it gets there. Plus who on the team owns what.
 */
export function MissionSetup({
  design,
  orbitData,
  crew,
  onMission,
  onCrew,
}: {
  design: Design;
  orbitData: Record<OrbitId, DataSnapshot<GpElements>>;
  crew: string[];
  onMission: (patch: Partial<MissionChoice>) => void;
  onCrew: (crew: string[]) => void;
}) {
  const { mission } = design;
  const lead = crew.length > 1 ? ownerOf(crew, ROLES[0]) : null;
  const owner = lead ? <span className="owner">{lead} decides</span> : null;

  return (
    <section className="mission-setup" aria-label="Mission setup" data-guide="mission">
      <div className="setup-group">
        <h2 className="setup-title">Objective {owner}</h2>
        <div className="setup-cards" role="radiogroup" aria-label="Mission objective">
          {OBJECTIVES.map((objective) => (
            <button
              key={objective.id}
              type="button"
              role="radio"
              aria-checked={mission.objective === objective.id}
              className={`setup-card ${mission.objective === objective.id ? 'is-selected' : ''}`}
              onClick={() => onMission({ objective: objective.id })}
            >
              <strong>{objective.name}</strong>
              <span>{objective.blurb}</span>
              <span className="mono small">
                Targets: {objective.scienceTarget} science · {objective.dataTargetMb} MB
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="setup-group">
        <h2 className="setup-title">Orbit {owner}</h2>
        <div className="setup-cards" role="radiogroup" aria-label="Orbit">
          {ORBITS.map((orbit) => {
            const data = orbitData[orbit.id];
            const status = data?.payload ? data.status : 'error';
            return (
              <button
                key={orbit.id}
                type="button"
                role="radio"
                aria-checked={mission.orbit === orbit.id}
                disabled={!data?.payload}
                className={`setup-card ${mission.orbit === orbit.id ? 'is-selected' : ''}`}
                onClick={() => onMission({ orbit: orbit.id })}
              >
                <strong>{orbit.name}</strong>
                <span>{orbit.blurb}</span>
                <span className="mono small">
                  {orbit.reference} · NORAD {orbit.noradId} · <span className={`status-text s-${status}`}>{status.toUpperCase()}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="setup-group">
        <h2 className="setup-title">Launch {owner}</h2>
        <div className="setup-cards" role="radiogroup" aria-label="Launch vehicle">
          {LAUNCHES.map((launch) => {
            const reaches = launch.orbits.includes(mission.orbit);
            return (
              <button
                key={launch.id}
                type="button"
                role="radio"
                aria-checked={mission.launch === launch.id}
                className={`setup-card ${mission.launch === launch.id ? 'is-selected' : ''} ${reaches ? '' : 'is-unreachable'}`}
                onClick={() => onMission({ launch: launch.id })}
              >
                <strong>{launch.name}</strong>
                <span>{launch.blurb}</span>
                <span className="mono small">
                  {usd(launch.costUsd)} · up to {num(launch.massCapacityKg, 1)} kg
                </span>
                {reaches ? null : <span className="setup-warn">Cannot reach the {orbitById(mission.orbit).name} orbit</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="setup-group" data-guide="crew">
        <h2 className="setup-title">Team</h2>
        <div className="crew-size" role="radiogroup" aria-label="Number of players">
          {Array.from({ length: MAX_CREW }, (_, i) => i + 1).map((size) => (
            <button
              key={size}
              type="button"
              role="radio"
              aria-checked={crew.length === size}
              className={crew.length === size ? 'is-selected' : ''}
              onClick={() => onCrew(resizeCrew(crew, size))}
            >
              {size === 1 ? 'Solo' : `${size} players`}
            </button>
          ))}
        </div>
        {crew.length > 1 ? (
          <ul className="crew-roles">
            {ROLES.map((role) => {
              const name = ownerOf(crew, role);
              const index = crew.indexOf(name);
              return (
                <li key={role.id}>
                  <span className="crew-role">
                    <strong>{role.name}</strong>
                    <span className="dim small">{role.owns}</span>
                  </span>
                  <input
                    aria-label={`Name of the player who is ${role.name}`}
                    value={name}
                    maxLength={20}
                    onChange={(event) => onCrew(crew.map((entry, i) => (i === index ? event.target.value : entry)))}
                    onBlur={() => onCrew(resizeCrew(crew, crew.length))}
                  />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="dim small">Playing together? Pick 2–4 players. Each role owns its parts and makes the call when its subsystem fails.</p>
        )}
      </div>
    </section>
  );
}

import { PERSONAS } from "./data";
import { useT } from "./i18n";

interface Props {
  name: string;
  reasoning: string | null;
  onClose: () => void;
}

export function AgentDrawer({ name, reasoning, onClose }: Props) {
  const { t } = useT();
  const persona = PERSONAS[name];
  return (
    <div className="drawer">
      <button className="drawer-close" onClick={onClose} aria-label={t.close}>✕</button>
      <div className="drawer-head">
        <div className="drawer-avatar" style={{ backgroundColor: persona.color }}>{name[0]}</div>
        <div>
          <div className="drawer-name">{name}</div>
          <div className="drawer-role">{t.role[persona.role] ?? persona.role}</div>
        </div>
      </div>

      <div className="drawer-section-label">{t.drawerPersona}</div>
      <p className="drawer-persona">{persona.summary}</p>

      {name !== "Teacher" && (
        <>
          <div className="drawer-section-label">{t.drawerTalkativeness}</div>
          <div className="talk-meter">
            <div
              className="talk-meter-fill"
              style={{ width: `${persona.talkativeness * 100}%`, backgroundColor: persona.color }}
            />
          </div>

          <div className="drawer-section-label">{t.drawerReasoning}</div>
          {reasoning ? (
            <p className="drawer-reasoning">“{reasoning}”</p>
          ) : (
            <p className="drawer-reasoning muted">{t.drawerNotSpoken}</p>
          )}
        </>
      )}
    </div>
  );
}

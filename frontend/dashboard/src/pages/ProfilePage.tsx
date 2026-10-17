import { useEffect, useState } from "react";
import "../components/BoardCover.css";
import "./ProfilePage.css";
import { useUser } from "../contexts/UserContext";
import { useTeams } from "../contexts/TeamsContext";
import { useToast } from "../hooks/useToast";
import { navigate } from "../hooks/useHashRoute";
import { colorForId, initialsOf } from "../utils/cover";
import type { TeamRole } from "../types";

/* ProfilePage — экран «Профиль»: личные данные и список групп. */

const ROLE_LABEL: Record<TeamRole, string> = {
  owner: "Владелец",
  admin: "Администратор",
  member: "Участник",
};

export default function ProfilePage() {
  const { user, updateName } = useUser();
  const { teams, setActiveTeamId } = useTeams();
  const { toastMessage, toastVisible, showToast } = useToast();
  const [draft, setDraft] = useState(user.name);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(user.name);
  }, [user.name]);

  const trimmed = draft.trim();
  const canSave = !saving && trimmed !== "" && trimmed !== user.name;

  const save = async () => {
    setSaving(true);
    try {
      await updateName(trimmed);
      showToast("Имя сохранено");
    } catch {
      showToast("Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const open = (id: string) => {
    setActiveTeamId(id);
    navigate({ name: "boards" });
  };

  return (
    <main className="page profile">
      <div className="profile__top">
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          aria-label="Назад к доскам"
          onClick={() => navigate({ name: "boards" })}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <h1 className="profile__title">Профиль</h1>
      </div>

      <section className="card profile__card" aria-label="Личные данные">
        <div className="profile__id">
          <div className={`profile__avatar cover--${colorForId(user.id ?? user.email ?? "")}`} aria-hidden="true">
            {initialsOf(user.name)}
          </div>
          <div className="profile__who">
            <div className="profile__name">{user.name}</div>
            <div className="profile__email">{user.email}</div>
          </div>
        </div>
        <form
          className="profile__form"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) void save();
          }}
        >
          <div className="profile__field">
            <label htmlFor="profile-name">Имя</label>
            <input id="profile-name" className="input" value={draft} onChange={(e) => setDraft(e.target.value)} />
          </div>
          <div className="profile__field">
            <label htmlFor="profile-email">Электронная почта</label>
            <input id="profile-email" className="input input-disabled" value={user.email} readOnly />
          </div>
          <div className="profile__footer">
            <button type="button" className="btn btn--ghost" onClick={() => setDraft(user.name)}>
              Отменить
            </button>
            <button type="submit" className="btn btn--primary" disabled={!canSave}>
              Сохранить
            </button>
          </div>
        </form>
      </section>

      <section className="card profile__card" aria-labelledby="profile-groups">
        <h2 id="profile-groups" className="profile__h2">Мои группы</h2>
        {teams.length === 0 ? (
          <p className="profile__empty">Вы пока не состоите ни в одной группе</p>
        ) : (
          <ul className="profile__groups">
            {teams.map((t) => (
              <li key={t.id} className="profile__row">
                <span className={`profile__mark cover--${colorForId(t.id)}`} aria-hidden="true">
                  {initialsOf(t.name)}
                </span>
                <span className="profile__gname">{t.name}</span>
                <span className="profile__role">{ROLE_LABEL[t.role]}</span>
                <button type="button" className="btn btn--ghost profile__open" onClick={() => open(t.id)}>
                  Открыть
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {toastVisible && <div className="boards-toast">{toastMessage}</div>}
    </main>
  );
}

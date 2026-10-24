import { useEffect, useMemo, useState } from "react";
import { api, type AccountSearchDTO, type TeamMemberDTO } from "../api/client";
import { shortName } from "../utils/shortName";

const ROLE_LABEL: Record<TeamMemberDTO["role"], string> = { owner: "владелец", admin: "админ группы", member: "участник" };
const looksLikeEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

interface TeamMembersTabProps {
  teamId: string;
  canManage: boolean;
}

/**
 * Вкладка «Участники» настроек группы. Одно поле ищет по всем учётным записям сада (имя или почта),
 * из найденных можно отметить несколько и добавить разом; если никого нет, а введена почта, человека
 * приглашают по ней заранее. Ниже список участников с ролью и исключением.
 */
export default function TeamMembersTab({ teamId, canManage }: TeamMembersTabProps) {
  const [members, setMembers] = useState<TeamMemberDTO[] | null>(null);
  const [directory, setDirectory] = useState<AccountSearchDTO[]>([]);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [role, setRole] = useState<"member" | "admin">("member");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api.teams.members(teamId)
      .then((list) => { if (alive) setMembers(list); })
      .catch(() => { if (alive) setError("Не удалось загрузить участников"); });
    if (canManage) {
      api.accounts.search("")
        .then((list) => { if (alive) setDirectory(list); })
        .catch(() => { if (alive) setError("Не удалось загрузить список педагогов"); });
    }
    return () => { alive = false; };
  }, [teamId, canManage]);

  const memberIds = useMemo(() => new Set((members ?? []).map((m) => m.accountId)), [members]);
  const needle = query.trim().toLowerCase();
  const candidates = useMemo(
    () => directory.filter((a) => !memberIds.has(a.id) && (!needle || a.name.toLowerCase().includes(needle) || a.email.toLowerCase().includes(needle))),
    [directory, memberIds, needle],
  );
  const inviteEmail = candidates.length === 0 && looksLikeEmail(needle) && !directory.some((a) => a.email === needle) ? needle : "";

  const togglePick = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const addEmails = async (emails: string[]) => {
    if (!emails.length || busy) return;
    setBusy(true);
    setError(null);
    try {
      const added: TeamMemberDTO[] = [];
      for (const email of emails) added.push(await api.teams.addMember(teamId, email, role));
      setMembers((prev) => {
        const list = prev ?? [];
        const fresh = added.filter((m) => !list.some((x) => x.accountId === m.accountId));
        return [...list, ...fresh];
      });
      setDirectory((prev) => {
        const known = new Set(prev.map((a) => a.email));
        return [...prev, ...added.filter((m) => !known.has(m.email)).map((m) => ({ id: m.accountId, email: m.email, name: m.name }))];
      });
      setPicked(new Set());
      setQuery("");
    } catch (e) {
      const code = (e as { code?: string }).code;
      setError(code === "invalid_email" ? "Похоже, это не почта" : "Не удалось добавить участника");
    } finally {
      setBusy(false);
    }
  };

  const addPicked = () => {
    const emails = directory.filter((a) => picked.has(a.id)).map((a) => a.email);
    void addEmails(emails);
  };

  const changeRole = async (m: TeamMemberDTO, next: "member" | "admin") => {
    try {
      const updated = await api.teams.setMemberRole(teamId, m.accountId, next);
      setMembers((prev) => (prev ?? []).map((x) => (x.accountId === m.accountId ? updated : x)));
    } catch {
      setError("Не удалось изменить роль");
    }
  };

  const remove = async (m: TeamMemberDTO) => {
    try {
      await api.teams.removeMember(teamId, m.accountId);
      setMembers((prev) => (prev ?? []).filter((x) => x.accountId !== m.accountId));
    } catch {
      setError("Не удалось исключить участника");
    }
  };

  const pickedCount = [...picked].filter((id) => candidates.some((a) => a.id === id) || directory.some((a) => a.id === id && !memberIds.has(id))).length;

  return (
    <div className="ts-members">
      {canManage && (
        <div className="ts-section">
          <label className="field-label ts-section-label" htmlFor="ts-member-search">Добавить участников</label>
          <div className="ts-members__add">
            <input
              id="ts-member-search"
              className="boards-modal-input"
              type="search"
              value={query}
              placeholder="Имя или почта"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && inviteEmail) void addEmails([inviteEmail]); }}
            />
            <select className="boards-modal-input ts-members__role" value={role} onChange={(e) => setRole(e.target.value as "member" | "admin")} aria-label="Роль">
              <option value="member">участник</option>
              <option value="admin">админ группы</option>
            </select>
            <button type="button" className="btn btn--soft" onClick={addPicked} disabled={busy || pickedCount === 0}>
              {pickedCount > 0 ? `Добавить (${pickedCount})` : "Добавить"}
            </button>
          </div>
          {candidates.length > 0 ? (
            <ul className="ts-members__candidates" aria-label="Педагоги сада">
              {candidates.map((a) => (
                <li key={a.id}>
                  <label className="ts-members__candidate">
                    <input type="checkbox" checked={picked.has(a.id)} onChange={() => togglePick(a.id)} aria-label={`Выбрать: ${a.email}`} />
                    <span className="ts-members__avatar ts-members__avatar--small" aria-hidden="true">{(a.name || a.email).trim().charAt(0).toUpperCase()}</span>
                    <span className="ts-members__who">
                      <span className="ts-members__name">{shortName(a.name) || a.email}</span>
                      <span className="ts-members__email">{a.email}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          ) : inviteEmail ? (
            <div className="ts-members__invite">
              <span className="ts-section-text">Такого педагога ещё нет: добавим в группу при первом входе с этой почтой</span>
              <button type="button" className="btn btn--ghost" onClick={() => void addEmails([inviteEmail])} disabled={busy}>Пригласить {inviteEmail}</button>
            </div>
          ) : (
            <p className="ts-section-text">{needle ? "Никого не нашли. Введите почту целиком, чтобы пригласить" : "Все педагоги сада уже в группе"}</p>
          )}
        </div>
      )}
      {error && <p className="ts-section-text ts-members__error" role="alert">{error}</p>}
      <div className="ts-section">
        <label className="field-label ts-section-label">Участники</label>
        {members === null ? (
          <p className="ts-section-text">Загружаем</p>
        ) : (
          <ul className="ts-members__list" aria-label="Участники группы">
            {members.map((m) => (
              <li key={m.accountId} className="ts-members__row">
                <span className="ts-members__avatar" aria-hidden="true">{(m.name || m.email).trim().charAt(0).toUpperCase()}</span>
                <span className="ts-members__who">
                  <span className="ts-members__name">{shortName(m.name) || m.email}</span>
                  <span className="ts-members__email">{m.email}</span>
                </span>
                {canManage && m.role !== "owner" ? (
                  <>
                    <select
                      className="boards-modal-input ts-members__role"
                      value={m.role}
                      aria-label={`Роль: ${m.email}`}
                      onChange={(e) => void changeRole(m, e.target.value as "member" | "admin")}
                    >
                      <option value="member">участник</option>
                      <option value="admin">админ группы</option>
                    </select>
                    <button type="button" className="btn btn--ghost" aria-label={`Исключить: ${m.email}`} onClick={() => void remove(m)}>Исключить</button>
                  </>
                ) : (
                  <span className="chip chip--muted">{ROLE_LABEL[m.role]}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

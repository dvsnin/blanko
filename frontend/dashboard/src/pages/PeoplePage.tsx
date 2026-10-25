import { useEffect, useMemo, useState } from "react";
import "../components/BoardCover.css";
import "./ProfilePage.css";
import "./PeoplePage.css";
import ConfirmModal from "../components/ConfirmModal";
import { useUser } from "../contexts/UserContext";
import { useToast } from "../hooks/useToast";
import { navigate } from "../hooks/useHashRoute";
import { api, ApiError, type AccountListDTO } from "../api/client";
import { colorForId, initialsOf } from "../utils/cover";
import { plural } from "../utils/plural";

/* PeoplePage - «Участники сада»: все учётные записи и роли организации. Только для администратора.
   Правило одно: у сада всегда остаётся хотя бы один администратор, остальное решает админ. */

const isAdmin = (role: string) => role === "owner" || role === "admin";

export default function PeoplePage() {
  const { user } = useUser();
  const allowed = isAdmin(user.orgRole ?? "");
  const { toastMessage, toastVisible, showToast } = useToast(2600);
  const [accounts, setAccounts] = useState<AccountListDTO[]>([]);
  const [loading, setLoading] = useState(allowed);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmSelf, setConfirmSelf] = useState(false);

  useEffect(() => {
    if (!allowed) return;
    let alive = true;
    api.accounts.list()
      .then((list) => { if (alive) setAccounts(list); })
      .catch(() => { if (alive) showToast("Не удалось загрузить список"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // Загружаем один раз при входе в раздел.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return accounts;
    return accounts.filter((a) => a.name.toLowerCase().includes(needle) || a.email.toLowerCase().includes(needle));
  }, [accounts, q]);
  const admins = accounts.filter((a) => isAdmin(a.orgRole)).length;

  const setRole = async (acc: AccountListDTO, role: "admin" | "member") => {
    setBusyId(acc.id);
    try {
      const updated = await api.accounts.setRole(acc.id, role);
      setAccounts((prev) => prev.map((a) => (a.id === updated.id ? { ...a, orgRole: updated.orgRole } : a)));
      showToast(role === "admin" ? `${updated.name} теперь администратор` : `${updated.name} теперь пользователь`);
    } catch (e) {
      if (e instanceof ApiError && e.code === "last_admin") showToast("У сада должен остаться хотя бы один администратор");
      else showToast("Не удалось изменить роль");
    } finally {
      setBusyId(null);
    }
  };

  const onToggle = (acc: AccountListDTO) => {
    if (isAdmin(acc.orgRole)) {
      if (acc.id === user.id) { setConfirmSelf(true); return; }
      void setRole(acc, "member");
    } else {
      void setRole(acc, "admin");
    }
  };

  const me = accounts.find((a) => a.id === user.id);

  return (
    <main className="page profile people">
      <div className="profile__top">
        <button type="button" className="btn btn--ghost btn--icon" aria-label="Назад к доскам" onClick={() => navigate({ name: "boards" })}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <div>
          <h1 className="profile__title">Участники сада</h1>
          {allowed && !loading && (
            <p className="people__sub">{plural(accounts.length, "учётная запись", "учётные записи", "учётных записей")} · {plural(admins, "администратор", "администратора", "администраторов")}</p>
          )}
        </div>
      </div>

      {!allowed ? (
        <section className="card profile__card">
          <p className="profile__empty">Раздел доступен только администраторам</p>
        </section>
      ) : (
        <section className="card profile__card" aria-label="Учётные записи">
          <div className="people__toolbar">
            <label className={`input input--search people__search${q ? " boards-search--filled" : ""}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input type="text" value={q} placeholder="Имя или почта…" aria-label="Найти учётную запись" onChange={(e) => setQ(e.target.value)} />
            </label>
            <p className="people__hint">Администратор видит и правит всё в саду, пользователь - только свои группы и доски. Новые учётные записи появляются после первого входа.</p>
          </div>
          {loading ? (
            <p className="profile__empty">Загружаем…</p>
          ) : visible.length === 0 ? (
            <p className="profile__empty">{q ? "Никого не нашли" : "Пока никто не вошёл в кабинет"}</p>
          ) : (
            <ul className="profile__groups">
              {visible.map((a) => {
                const admin = isAdmin(a.orgRole);
                return (
                  <li key={a.id} className="profile__row people__row">
                    <span className={`profile__mark cover--${colorForId(a.id)}`} aria-hidden="true">{initialsOf(a.name)}</span>
                    <span className="people__who">
                      <span className="profile__gname">{a.name}{a.id === user.id && <span className="people__you"> (вы)</span>}</span>
                      <span className="people__email">{a.email}</span>
                    </span>
                    <span className={`chip people__role${admin ? " people__role--admin" : ""}`}>{admin ? "Администратор" : "Пользователь"}</span>
                    <button
                      type="button"
                      className={`btn ${admin ? "btn--ghost" : "btn--soft"} profile__open`}
                      disabled={busyId === a.id}
                      onClick={() => onToggle(a)}
                    >
                      {admin ? "Снять права администратора" : "Сделать администратором"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <ConfirmModal
        isOpen={confirmSelf}
        compact
        title="Снять с себя права администратора?"
        message={<p style={{ margin: 0 }}>Вы перестанете видеть чужие группы и этот раздел. Вернуть права сможет другой администратор.</p>}
        confirmLabel="Снять права"
        danger
        onCancel={() => setConfirmSelf(false)}
        onConfirm={() => { setConfirmSelf(false); if (me) void setRole(me, "member"); }}
      />

      {toastVisible && <div className="boards-toast">{toastMessage}</div>}
    </main>
  );
}

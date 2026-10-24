package handler_test

import (
	"testing"

	"github.com/dvsnin/blanko/backend/app/internal/model"
)

func memberRoles(body map[string]any) map[string]string {
	out := map[string]string{}
	for _, it := range items(body) {
		m := it.(map[string]any)
		out[m["email"].(string)] = m["role"].(string)
	}
	return out
}

func TestTeamMembers(t *testing.T) {
	e := newEnv(t)
	owner := e.account("owner@example.com")
	member := e.account("member@example.com")
	e.account("other@example.com")
	team := e.team(owner)
	e.addMember(team, member)

	t.Run("member sees the list with roles", func(t *testing.T) {
		status, body := e.post("member@example.com", "/team/members", map[string]any{"teamId": team.ID.String()})
		if status != 200 {
			t.Fatalf("status %d %v", status, body)
		}
		roles := memberRoles(body)
		if roles["owner@example.com"] != "owner" || roles["member@example.com"] != "member" || len(roles) != 2 {
			t.Fatalf("roles = %v", roles)
		}
	})

	t.Run("non member forbidden", func(t *testing.T) {
		if status, _ := e.post("other@example.com", "/team/members", map[string]any{"teamId": team.ID.String()}); status != 403 {
			t.Fatalf("status %d, want 403", status)
		}
	})
}

func TestAddTeamMember(t *testing.T) {
	e := newEnv(t)
	owner := e.account("owner@example.com")
	member := e.account("member@example.com")
	e.account("colleague@example.com")
	team := e.team(owner)
	e.addMember(team, member)

	t.Run("owner adds existing account", func(t *testing.T) {
		status, body := e.post("owner@example.com", "/team/member/add", map[string]any{"teamId": team.ID.String(), "email": "Colleague@Example.com", "role": "member"})
		if status != 201 || body["email"] != "colleague@example.com" || body["role"] != "member" {
			t.Fatalf("status %d %v", status, body)
		}
		_, list := e.post("owner@example.com", "/team/members", map[string]any{"teamId": team.ID.String()})
		if memberRoles(list)["colleague@example.com"] != "member" {
			t.Fatalf("not in list: %v", memberRoles(list))
		}
	})

	t.Run("unknown email creates account ahead of first login", func(t *testing.T) {
		status, body := e.post("owner@example.com", "/team/member/add", map[string]any{"teamId": team.ID.String(), "email": "new.teacher@example.com", "role": "admin"})
		if status != 201 || body["name"] != "new.teacher" || body["role"] != "admin" {
			t.Fatalf("status %d %v", status, body)
		}
		// Первый вход этим адресом попадает в ту же учётку и видит группу.
		_, teams := e.post("new.teacher@example.com", "/team/list", map[string]any{})
		if len(items(teams)) != 1 {
			t.Fatalf("new member sees %d teams, want 1", len(items(teams)))
		}
	})

	t.Run("adding twice is idempotent", func(t *testing.T) {
		status, _ := e.post("owner@example.com", "/team/member/add", map[string]any{"teamId": team.ID.String(), "email": "colleague@example.com", "role": "member"})
		if status != 200 {
			t.Fatalf("status %d, want 200", status)
		}
	})

	t.Run("member cannot add", func(t *testing.T) {
		if status, _ := e.post("member@example.com", "/team/member/add", map[string]any{"teamId": team.ID.String(), "email": "x@example.com", "role": "member"}); status != 403 {
			t.Fatalf("status %d, want 403", status)
		}
	})

	t.Run("bad email or role", func(t *testing.T) {
		if status, _ := e.post("owner@example.com", "/team/member/add", map[string]any{"teamId": team.ID.String(), "email": "not-an-email", "role": "member"}); status != 400 {
			t.Fatalf("email: status %d, want 400", status)
		}
		if status, _ := e.post("owner@example.com", "/team/member/add", map[string]any{"teamId": team.ID.String(), "email": "ok@example.com", "role": "owner"}); status != 400 {
			t.Fatalf("role owner: status %d, want 400", status)
		}
	})
}

func TestSetTeamMemberRole(t *testing.T) {
	e := newEnv(t)
	owner := e.account("owner@example.com")
	member := e.account("member@example.com")
	team := e.team(owner)
	e.addMember(team, member)

	t.Run("owner promotes member to admin", func(t *testing.T) {
		status, body := e.post("owner@example.com", "/team/member/role", map[string]any{"teamId": team.ID.String(), "memberId": member.ID.String(), "role": "admin"})
		if status != 200 || body["role"] != "admin" {
			t.Fatalf("status %d %v", status, body)
		}
	})

	t.Run("admin cannot change the owner", func(t *testing.T) {
		if status, _ := e.post("member@example.com", "/team/member/role", map[string]any{"teamId": team.ID.String(), "memberId": owner.ID.String(), "role": "member"}); status != 403 {
			t.Fatalf("status %d, want 403", status)
		}
	})

	t.Run("role owner is not assignable", func(t *testing.T) {
		if status, _ := e.post("owner@example.com", "/team/member/role", map[string]any{"teamId": team.ID.String(), "memberId": member.ID.String(), "role": "owner"}); status != 400 {
			t.Fatalf("status %d, want 400", status)
		}
	})
}

func TestRemoveTeamMember(t *testing.T) {
	e := newEnv(t)
	owner := e.account("owner@example.com")
	member := e.account("member@example.com")
	e.account("other@example.com")
	team := e.team(owner)
	e.addMember(team, member)

	t.Run("member cannot remove", func(t *testing.T) {
		if status, _ := e.post("member@example.com", "/team/member/remove", map[string]any{"teamId": team.ID.String(), "memberId": owner.ID.String()}); status != 403 {
			t.Fatalf("status %d, want 403", status)
		}
	})

	t.Run("owner cannot be removed", func(t *testing.T) {
		if status, _ := e.post("owner@example.com", "/team/member/remove", map[string]any{"teamId": team.ID.String(), "memberId": owner.ID.String()}); status != 403 {
			t.Fatalf("status %d, want 403", status)
		}
	})

	t.Run("owner removes member", func(t *testing.T) {
		if status, _ := e.post("owner@example.com", "/team/member/remove", map[string]any{"teamId": team.ID.String(), "memberId": member.ID.String()}); status != 204 {
			t.Fatalf("status %d, want 204", status)
		}
		_, list := e.post("owner@example.com", "/team/members", map[string]any{"teamId": team.ID.String()})
		if _, still := memberRoles(list)["member@example.com"]; still {
			t.Fatal("member still listed")
		}
		if status, _ := e.post("member@example.com", "/board/list", map[string]any{"teamId": team.ID.String()}); status != 403 {
			t.Fatalf("removed member still sees boards: %d", status)
		}
	})

	_ = model.TeamRoleMember
}

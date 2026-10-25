// Package bootstrap: одна организация и гарантированные админы из ADMIN_EMAILS.
// Выполняется при каждом старте после миграций, идемпотентен; снятие прав - только в кабинете.
package bootstrap

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/dvsnin/blanko/backend/app/internal/model"
	"github.com/dvsnin/blanko/backend/app/internal/repository"
)

func NormalizeEmails(raw string) []string {
	out := []string{}
	seen := map[string]bool{}
	for _, part := range strings.Split(raw, ",") {
		e := strings.ToLower(strings.TrimSpace(part))
		if e == "" || seen[e] {
			continue
		}
		seen[e] = true
		out = append(out, e)
	}
	return out
}

// PlanMembership: кого из ADMIN_EMAILS сделать администратором. Понижений нет: роли, назначенные
// в кабинете, живут дальше, а список из env лишь гарантирует, что эти люди всегда администраторы.
func PlanMembership(current []model.OrganizationMember, admins []string) (promote []string) {
	promote = []string{}
	elevated := map[string]bool{}
	for _, m := range current {
		if m.Role.IsAdmin() {
			elevated[strings.ToLower(m.Email)] = true
		}
	}
	for _, e := range admins {
		if !elevated[e] {
			promote = append(promote, e)
		}
	}
	return promote
}

func Run(ctx context.Context, pool *pgxpool.Pool, orgName string, adminEmails []string) error {
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		orgs := repository.NewOrganizationRepo(tx)
		accounts := repository.NewAccountRepo(tx)

		org, err := orgs.GetFirst(ctx)
		if errors.Is(err, repository.ErrNotFound) {
			if len(adminEmails) == 0 {
				log.Printf("bootstrap: ADMIN_EMAILS пуст, организация не создана, админов сада нет")
				return nil
			}
			owner, err := ensureAccount(ctx, accounts, adminEmails[0])
			if err != nil {
				return err
			}
			org = &model.Organization{Name: orgName, OwnerAccountID: owner.ID}
			if err := orgs.Create(ctx, org); err != nil {
				return fmt.Errorf("create organization: %w", err)
			}
			if err := orgs.UpsertMember(ctx, org.ID, owner.ID, model.OrgRoleOwner); err != nil {
				return fmt.Errorf("owner membership: %w", err)
			}
			log.Printf("bootstrap: создана организация %q, владелец %s", orgName, owner.Email)
		} else if err != nil {
			return fmt.Errorf("get organization: %w", err)
		}

		members, err := orgs.ListMembers(ctx, org.ID)
		if err != nil {
			return fmt.Errorf("list members: %w", err)
		}
		promote := PlanMembership(members, adminEmails)
		for _, email := range promote {
			acc, err := ensureAccount(ctx, accounts, email)
			if err != nil {
				return err
			}
			if err := orgs.UpsertMember(ctx, org.ID, acc.ID, model.OrgRoleAdmin); err != nil {
				return fmt.Errorf("promote %s: %w", email, err)
			}
			log.Printf("bootstrap: %s - администратор", email)
		}
		return nil
	})
}

func ensureAccount(ctx context.Context, accounts *repository.AccountRepo, email string) (*model.Account, error) {
	acc, err := accounts.GetByEmail(ctx, email)
	if errors.Is(err, repository.ErrNotFound) {
		acc = &model.Account{Email: email, Name: strings.SplitN(email, "@", 2)[0]}
		if err := accounts.Create(ctx, acc); err != nil {
			return nil, fmt.Errorf("create account %s: %w", email, err)
		}
		return acc, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get account %s: %w", email, err)
	}
	return acc, nil
}

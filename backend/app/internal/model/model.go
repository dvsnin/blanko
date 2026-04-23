package model

import (
	"time"

	"github.com/google/uuid"
)

// Account — учётная запись пользователя.
type Account struct {
	ID        uuid.UUID
	Email     string
	Name      string
	CreatedAt time.Time
	UpdatedAt time.Time
}

// Workspace — личное рабочее пространство пользователя (или организации).
type Workspace struct {
	ID             uuid.UUID
	Name           string
	AccountID      *uuid.UUID
	OrganizationID *uuid.UUID
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// TeamRole — роль участника команды.
type TeamRole string

const (
	TeamRoleOwner  TeamRole = "owner"
	TeamRoleAdmin  TeamRole = "admin"
	TeamRoleMember TeamRole = "member"
)

// BoardAccess — уровень доступа к доске.
type BoardAccess string

const (
	BoardAccessDeny BoardAccess = "deny"
	BoardAccessView BoardAccess = "view"
	BoardAccessEdit BoardAccess = "edit"
)

// Team — команда.
type Team struct {
	ID                uuid.UUID
	WorkspaceID       uuid.UUID
	Name              string
	MemberBoardAccess BoardAccess
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

// TeamView — агрегированная модель команды для UI.
type TeamView struct {
	Team       Team
	Role       TeamRole
	IsStarred  bool
	BoardCount int
}

// Board — доска.
type Board struct {
	ID                uuid.UUID
	PublicID          string
	Name              string
	TeamID            uuid.UUID
	AccountID         uuid.UUID
	TeamAccess        BoardAccess
	LinkAccessEnabled bool
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

// BoardView — доска с дополнительной информацией для UI.
type BoardView struct {
	Board     Board
	OwnerName string
	IsStarred bool
}

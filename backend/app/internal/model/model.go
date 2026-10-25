package model

import (
	"time"

	"github.com/google/uuid"
)

// Account - учётная запись пользователя.
type Account struct {
	ID        uuid.UUID
	Email     string
	Name      string
	Prefs     Prefs
	CreatedAt time.Time
	UpdatedAt time.Time
}

// Prefs - настройки кабинета: плоский объект со скалярами, ключи задаёт фронтенд.
type Prefs map[string]any

// TeamRole - роль участника команды.
type TeamRole string

const (
	TeamRoleOwner  TeamRole = "owner"
	TeamRoleAdmin  TeamRole = "admin"
	TeamRoleMember TeamRole = "member"
)

// BoardAccess - уровень доступа к доске.
type BoardAccess string

const (
	BoardAccessDeny BoardAccess = "deny"
	BoardAccessView BoardAccess = "view"
	BoardAccessEdit BoardAccess = "edit"
)

type OrganizationRole string

const (
	OrgRoleOwner  OrganizationRole = "owner"
	OrgRoleAdmin  OrganizationRole = "admin"
	OrgRoleMember OrganizationRole = "member"
)

func (r OrganizationRole) IsAdmin() bool {
	return r == OrgRoleOwner || r == OrgRoleAdmin
}

type Organization struct {
	ID             uuid.UUID
	Name           string
	OwnerAccountID uuid.UUID
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

type OrganizationMember struct {
	AccountID uuid.UUID
	Email     string
	Role      OrganizationRole
}

// Team - команда. Если OrganizationID == nil - личная команда без организации.
type Team struct {
	ID                uuid.UUID
	OrganizationID    *uuid.UUID
	Name              string
	MemberBoardAccess BoardAccess
	AgeGroup          *string
	Teachers          *string
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

// TeamView - агрегированная модель команды для UI.
type TeamView struct {
	Team       Team
	Role       TeamRole
	IsStarred  bool
	BoardCount int
}

// TeamMemberView - участник команды со сведениями об аккаунте.
type TeamMemberView struct {
	AccountID uuid.UUID
	Email     string
	Name      string
	Role      TeamRole
	JoinedAt  time.Time
}

// Board - доска.
type Board struct {
	ID                uuid.UUID
	PublicID          string
	Name              string
	TeamID            uuid.UUID
	AccountID         uuid.UUID
	TeamAccess        BoardAccess
	LinkAccessEnabled bool
	TemplateID        *uuid.UUID
	CreatedAt         time.Time
	UpdatedAt         time.Time
	LastOpenedAt      *time.Time
}

// BoardView - доска с дополнительной информацией для UI.
type BoardView struct {
	Board     Board
	OwnerName string
	IsStarred bool
	// CanEdit: создатель доски или owner/admin команды. Считается в сервисе.
	CanEdit bool
	// ViewerRole - роль текущего пользователя в команде доски; списки берут её тем же запросом,
	// чтобы права считались без похода в БД на каждую доску.
	ViewerRole TeamRole
}

// Template: AuthorAccountID == nil у предустановленных.
type Template struct {
	ID              uuid.UUID
	PublicID        string
	PresetKey       *string
	Name            string
	Description     string
	Topic           string
	Ages            []string
	DurationMin     int
	Glyph           *string
	AuthorAccountID *uuid.UUID
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type TemplateView struct {
	Template   Template
	AuthorName string
	IsStarred  bool
	CanEdit    bool
}

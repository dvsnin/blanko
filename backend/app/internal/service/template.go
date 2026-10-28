package service

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/dvsnin/blanko/backend/app/internal/doc"
	"github.com/dvsnin/blanko/backend/app/internal/model"
	"github.com/dvsnin/blanko/backend/app/internal/repository"
)

var (
	ErrInvalidTopic    = fmt.Errorf("%w: invalid topic", ErrValidation)
	ErrInvalidAges     = fmt.Errorf("%w: invalid ages", ErrValidation)
	ErrInvalidDuration = fmt.Errorf("%w: invalid duration", ErrValidation)
)

// validTopics - темы занятий; список дублируется в constants/templates.ts на фронте.
var validTopics = map[string]bool{
	"math": true, "literacy": true, "world": true, "speech": true,
	"logic": true, "drawing": true, "sensory": true, "routine": true,
	"music": true, "health": true, "safety": true, "social": true,
}

var validAges = map[string]bool{"3-4": true, "4-5": true, "5-6": true, "6-7": true}

const (
	templateNameMax = 255
	templateDescMax = 500
	durationMin     = 5
	durationMax     = 120
)

type TemplateInput struct {
	Name        string
	Description string
	Topic       string
	Ages        []string
	DurationMin int
}

// TemplateUpdateInput: nil-поле не меняется.
type TemplateUpdateInput struct {
	Name        *string
	Description *string
	Topic       *string
	Ages        []string
	DurationMin *int
}

func validateAges(ages []string) error {
	if len(ages) == 0 {
		return ErrInvalidAges
	}
	seen := map[string]bool{}
	for _, a := range ages {
		if !validAges[a] || seen[a] {
			return ErrInvalidAges
		}
		seen[a] = true
	}
	return nil
}

func validateTemplateInput(in TemplateInput) error {
	name := strings.TrimSpace(in.Name)
	if name == "" || utf8.RuneCountInString(name) > templateNameMax {
		return fmt.Errorf("%w: name must be 1..255 characters", ErrValidation)
	}
	if utf8.RuneCountInString(in.Description) > templateDescMax {
		return fmt.Errorf("%w: description is too long", ErrValidation)
	}
	if !validTopics[in.Topic] {
		return ErrInvalidTopic
	}
	if err := validateAges(in.Ages); err != nil {
		return err
	}
	if in.DurationMin < durationMin || in.DurationMin > durationMax {
		return ErrInvalidDuration
	}
	return nil
}

// canEditTemplate - единственная проверка права на правку и удаление: автор или админ.
func canEditTemplate(t model.Template, id Identity) bool {
	if t.AuthorAccountID != nil && *t.AuthorAccountID == id.Account.ID {
		return true
	}
	return id.OrgRole.IsAdmin()
}

// ruSortKey: сортировка по-русски без ICU-коллации в БД.
func ruSortKey(s string) string {
	return strings.ReplaceAll(strings.ToLower(s), "ё", "е")
}

// sortRu сортирует устойчиво по ключу, который считается один раз на элемент, а не на сравнение.
func sortRu[T any](items []T, key func(T) string) {
	type keyed struct {
		k string
		v T
	}
	tmp := make([]keyed, len(items))
	for i, it := range items {
		tmp[i] = keyed{k: key(it), v: it}
	}
	sort.SliceStable(tmp, func(i, j int) bool { return tmp[i].k < tmp[j].k })
	for i := range tmp {
		items[i] = tmp[i].v
	}
}

func sortTemplatesRu(views []model.TemplateView) {
	sortRu(views, func(v model.TemplateView) string { return ruSortKey(v.Template.Name) })
}

type TemplateService struct {
	pool *pgxpool.Pool
	docs *DocumentService
}

func (s *TemplateService) CanEdit(t model.Template, id Identity) bool {
	return canEditTemplate(t, id)
}

func (s *TemplateService) GetByPublicID(ctx context.Context, publicID string) (*model.Template, error) {
	t, err := repository.NewTemplateRepo(s.pool).GetByPublicID(ctx, publicID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return t, nil
}

func (s *TemplateService) List(ctx context.Context, id Identity) ([]model.TemplateView, error) {
	views, err := repository.NewTemplateRepo(s.pool).List(ctx, id.Account.ID)
	if err != nil {
		return nil, err
	}
	for i := range views {
		views[i].CanEdit = canEditTemplate(views[i].Template, id)
	}
	sortTemplatesRu(views)
	return views, nil
}

func (s *TemplateService) view(ctx context.Context, id Identity, templateID uuid.UUID) (*model.TemplateView, error) {
	v, err := repository.NewTemplateRepo(s.pool).GetView(ctx, templateID, id.Account.ID)
	if err != nil {
		return nil, mapNotFound(err)
	}
	v.CanEdit = canEditTemplate(v.Template, id)
	return v, nil
}

// Create: fromBoardID - доска-источник, нужно членство в её группе.
func (s *TemplateService) Create(ctx context.Context, id Identity, in TemplateInput, fromBoardID *uuid.UUID) (*model.TemplateView, error) {
	if err := validateTemplateInput(in); err != nil {
		return nil, err
	}
	if fromBoardID != nil {
		board, err := repository.NewBoardRepo(s.pool).GetByID(ctx, *fromBoardID)
		if err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return nil, ErrNotFound
			}
			return nil, err
		}
		if _, err := repository.NewTeamRepo(s.pool).GetRoleForAccount(ctx, board.TeamID, id.Account.ID); err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return nil, ErrForbidden
			}
			return nil, err
		}
	}
	author := id.Account.ID
	t := &model.Template{
		Name:            strings.TrimSpace(in.Name),
		Description:     strings.TrimSpace(in.Description),
		Topic:           in.Topic,
		Ages:            in.Ages,
		DurationMin:     in.DurationMin,
		AuthorAccountID: &author,
	}
	// Строка и содержимое вместе: упало копирование - шаблона нет.
	err := withTx(ctx, s.pool, func(tx pgx.Tx) error {
		if err := repository.NewTemplateRepo(tx).Create(ctx, t); err != nil {
			return err
		}
		if fromBoardID == nil {
			return nil
		}
		return s.docs.Copy(ctx, doc.KindBoard, *fromBoardID, doc.KindTemplate, t.ID)
	})
	if err != nil {
		return nil, err
	}
	return &model.TemplateView{Template: *t, AuthorName: id.Account.Name, CanEdit: true}, nil
}

func (s *TemplateService) requireEditable(ctx context.Context, repo *repository.TemplateRepo, id Identity, templateID uuid.UUID) (*model.Template, error) {
	t, err := repo.GetByID(ctx, templateID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if !canEditTemplate(*t, id) {
		return nil, ErrForbidden
	}
	return t, nil
}

func (s *TemplateService) Update(ctx context.Context, id Identity, templateID uuid.UUID, in TemplateUpdateInput) (*model.TemplateView, error) {
	repo := repository.NewTemplateRepo(s.pool)
	t, err := s.requireEditable(ctx, repo, id, templateID)
	if err != nil {
		return nil, err
	}
	merged := TemplateInput{Name: t.Name, Description: t.Description, Topic: t.Topic, Ages: t.Ages, DurationMin: t.DurationMin}
	if in.Name != nil {
		merged.Name = *in.Name
	}
	if in.Description != nil {
		merged.Description = *in.Description
	}
	if in.Topic != nil {
		merged.Topic = *in.Topic
	}
	if in.Ages != nil {
		merged.Ages = in.Ages
	}
	if in.DurationMin != nil {
		merged.DurationMin = *in.DurationMin
	}
	if err := validateTemplateInput(merged); err != nil {
		return nil, err
	}
	name := strings.TrimSpace(merged.Name)
	desc := strings.TrimSpace(merged.Description)
	fields := repository.TemplateFields{Name: &name, Description: &desc, Topic: &merged.Topic, Ages: merged.Ages, DurationMin: &merged.DurationMin}
	if err := repo.Update(ctx, templateID, fields); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return s.view(ctx, id, templateID)
}

func (s *TemplateService) Delete(ctx context.Context, id Identity, templateID uuid.UUID) error {
	repo := repository.NewTemplateRepo(s.pool)
	if _, err := s.requireEditable(ctx, repo, id, templateID); err != nil {
		return err
	}
	if err := repo.SoftDelete(ctx, templateID); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return ErrNotFound
		}
		return err
	}
	s.docs.Hub.Close(doc.KindTemplate, templateID)
	return nil
}

// Duplicate: копия карточки, автор - текущий пользователь.
func (s *TemplateService) Duplicate(ctx context.Context, id Identity, templateID uuid.UUID) (*model.TemplateView, error) {
	repo := repository.NewTemplateRepo(s.pool)
	src, err := repo.GetByID(ctx, templateID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	author := id.Account.ID
	t := &model.Template{
		Name:            duplicateName(src.Name),
		Description:     src.Description,
		Topic:           src.Topic,
		Ages:            src.Ages,
		DurationMin:     src.DurationMin,
		AuthorAccountID: &author,
	}
	err = withTx(ctx, s.pool, func(tx pgx.Tx) error {
		if err := repository.NewTemplateRepo(tx).Create(ctx, t); err != nil {
			return err
		}
		return s.docs.Copy(ctx, doc.KindTemplate, src.ID, doc.KindTemplate, t.ID)
	})
	if err != nil {
		return nil, err
	}
	return &model.TemplateView{Template: *t, AuthorName: id.Account.Name, CanEdit: true}, nil
}

func (s *TemplateService) SetStarred(ctx context.Context, id Identity, templateID uuid.UUID, starred bool) error {
	repo := repository.NewTemplateRepo(s.pool)
	if _, err := repo.GetByID(ctx, templateID); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return ErrNotFound
		}
		return err
	}
	return repo.SetStarred(ctx, id.Account.ID, templateID, starred)
}

func validateTemplateExists(ctx context.Context, repo *repository.TemplateRepo, id *uuid.UUID) error {
	if id == nil {
		return nil
	}
	ok, err := repo.Exists(ctx, *id)
	if err != nil {
		return err
	}
	if !ok {
		return ErrInvalidTemplateID
	}
	return nil
}

package schema

import (
	"testing"

	"github.com/pocketbase/pocketbase/core"
)

func TestEnsureSchemaAndSeed(t *testing.T) {
	app := core.NewBaseApp(core.BaseAppConfig{
		DataDir: t.TempDir(),
	})
	defer app.ResetBootstrapState()

	Register(app)

	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap failed: %v", err)
	}

	// Verify collections exist
	usersCol, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		t.Fatalf("users collection missing: %v", err)
	}
	if usersCol.Fields.GetByName("phone") == nil || usersCol.Fields.GetByName("province") == nil {
		t.Fatalf("users collection missing phone or province fields")
	}

	categoriesCol, err := app.FindCollectionByNameOrId("categories")
	if err != nil {
		t.Fatalf("categories collection missing: %v", err)
	}
	if categoriesCol.ListRule == nil || *categoriesCol.ListRule != "" {
		t.Fatalf("expected public ListRule on categories")
	}
	if categoriesCol.CreateRule != nil {
		t.Fatalf("expected nil CreateRule (admin only) on categories")
	}

	listingsCol, err := app.FindCollectionByNameOrId("listings")
	if err != nil {
		t.Fatalf("listings collection missing: %v", err)
	}
	imgField, ok := listingsCol.Fields.GetByName("images").(*core.FileField)
	if !ok || imgField.MaxSelect != 8 {
		t.Fatalf("expected images field with MaxSelect=8")
	}

	favoritesCol, err := app.FindCollectionByNameOrId("favorites")
	if err != nil {
		t.Fatalf("favorites collection missing: %v", err)
	}
	if favoritesCol.GetIndex("idx_favorites_user_listing") == "" {
		t.Fatalf("expected composite unique index idx_favorites_user_listing on favorites")
	}

	// Verify all 11 categories are seeded
	records, err := app.FindAllRecords(categoriesCol)
	if err != nil {
		t.Fatalf("FindAllRecords(categories) failed: %v", err)
	}
	if len(records) != len(InitialCategories) {
		t.Fatalf("expected %d seeded categories, got %d", len(InitialCategories), len(records))
	}

	// Verify idempotency when running EnsureSchemaAndSeed a second time
	if err := EnsureSchemaAndSeed(app); err != nil {
		t.Fatalf("second EnsureSchemaAndSeed failed: %v", err)
	}
	recordsAfter, err := app.FindAllRecords(categoriesCol)
	if err != nil {
		t.Fatalf("FindAllRecords after second run failed: %v", err)
	}
	if len(recordsAfter) != len(InitialCategories) {
		t.Fatalf("expected %d categories after idempotent run, got %d", len(InitialCategories), len(recordsAfter))
	}
}

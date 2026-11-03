package hooks

import (
	"strings"
	"testing"

	"marketplace-c2c/internal/schema"

	"github.com/pocketbase/pocketbase/core"
)

func TestPrepareListingRecord(t *testing.T) {
	app := core.NewBaseApp(core.BaseAppConfig{
		DataDir: t.TempDir(),
	})
	defer app.ResetBootstrapState()

	schema.Register(app)
	Register(app)

	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap failed: %v", err)
	}

	usersCol, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		t.Fatalf("users collection error: %v", err)
	}
	authUser := core.NewRecord(usersCol)
	authUser.SetEmail("vendedor@cr.com")
	authUser.SetPassword("password123456")
	authUser.Set("name", "Carlos Mora")
	authUser.Set("phone", "88887777")
	authUser.Set("province", "Heredia")
	if err := app.Save(authUser); err != nil {
		t.Fatalf("save authUser failed: %v", err)
	}

	listingsCol, err := app.FindCollectionByNameOrId("listings")
	if err != nil {
		t.Fatalf("listings collection error: %v", err)
	}

	rec := core.NewRecord(listingsCol)
	rec.Set("title", "Juego de Sala en Cedro Amargo")
	rec.Set("seller", "spoofed_user_id")

	PrepareListingRecord(rec, authUser, false)

	if got := rec.GetString("seller"); got != authUser.Id {
		t.Fatalf("expected seller to be forced to %q, got %q", authUser.Id, got)
	}
	if got := rec.GetString("status"); got != "active" {
		t.Fatalf("expected default status 'active', got %q", got)
	}
	slug := rec.GetString("slug")
	if !strings.HasPrefix(slug, "juego-de-sala-en-cedro-amargo") {
		t.Fatalf("expected slug prefix 'juego-de-sala-en-cedro-amargo', got %q", slug)
	}
}

package schema

import (
	"fmt"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	_ "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

// ProvincesCR lists the 7 official provinces of Costa Rica.
var ProvincesCR = []string{
	"San José",
	"Alajuela",
	"Cartago",
	"Heredia",
	"Guanacaste",
	"Puntarenas",
	"Limón",
}

// ListingConditions lists the allowed furniture conditions.
var ListingConditions = []string{
	"Nuevo",
	"Como Nuevo",
	"Usado",
}

// ListingSpaces lists the allowed household/office spaces.
var ListingSpaces = []string{
	"Sala",
	"Comedor",
	"Habitación",
	"Oficina - Estudio",
	"Cocina",
	"Baño",
	"Exteriores",
	"Jardín",
	"Área de Lavado",
	"Gimnasio",
	"Otros",
}

// ListingStatuses lists the allowed statuses for a listing.
var ListingStatuses = []string{
	"active",
	"sold",
	"paused",
	"pending",
}

// CategorySeed represents an initial category record.
type CategorySeed struct {
	Name string
	Slug string
	Icon string
}

// InitialCategories defines the 11 seed categories required for the marketplace.
var InitialCategories = []CategorySeed{
	{Name: "Camas", Slug: "camas", Icon: "🛏️"},
	{Name: "Sillones", Slug: "sillones", Icon: "🛋️"},
	{Name: "Juegos de Comedor", Slug: "juegos-de-comedor", Icon: "🍽️"},
	{Name: "Juegos de Sala", Slug: "juegos-de-sala", Icon: "🪑"},
	{Name: "Juegos de Terraza", Slug: "juegos-de-terraza", Icon: "🌿"},
	{Name: "Escritorios", Slug: "escritorios", Icon: "💻"},
	{Name: "Cómodas", Slug: "comodas", Icon: "🗄️"},
	{Name: "Electrodomésticos", Slug: "electrodomesticos", Icon: "🔌"},
	{Name: "Antigüedades", Slug: "antiguedades", Icon: "🏺"},
	{Name: "Infantiles", Slug: "infantiles", Icon: "🧸"},
	{Name: "Otros", Slug: "otros", Icon: "📦"},
}

// Register binds the idempotent schema setup and category seeder to app.OnBootstrap().
func Register(app core.App) {
	app.OnBootstrap().BindFunc(func(be *core.BootstrapEvent) error {
		if err := be.Next(); err != nil {
			return err
		}
		return EnsureSchemaAndSeed(be.App)
	})
}

// EnsureSchemaAndSeed creates or updates the collections and seeds the initial categories.
func EnsureSchemaAndSeed(app core.App) error {
	usersCol, err := ensureUsersCollection(app)
	if err != nil {
		return fmt.Errorf("ensure users collection: %w", err)
	}

	categoriesCol, err := ensureCategoriesCollection(app)
	if err != nil {
		return fmt.Errorf("ensure categories collection: %w", err)
	}

	listingsCol, err := ensureListingsCollection(app, categoriesCol.Id, usersCol.Id)
	if err != nil {
		return fmt.Errorf("ensure listings collection: %w", err)
	}

	if _, err := ensureFavoritesCollection(app, usersCol.Id, listingsCol.Id); err != nil {
		return fmt.Errorf("ensure favorites collection: %w", err)
	}

	if err := seedCategories(app, categoriesCol); err != nil {
		return fmt.Errorf("seed categories: %w", err)
	}

	return nil
}

func ensureUsersCollection(app core.App) (*core.Collection, error) {
	col, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		col = core.NewAuthCollection("users")
	}

	if col.Fields.GetByName("name") == nil {
		col.Fields.Add(&core.TextField{
			Name:        "name",
			Max:         150,
			Presentable: true,
		})
	}

	if col.Fields.GetByName("phone") == nil {
		col.Fields.Add(&core.TextField{
			Name: "phone",
			Max:  30,
		})
	}

	if f := col.Fields.GetByName("province"); f == nil {
		col.Fields.Add(&core.SelectField{
			Name:      "province",
			Values:    ProvincesCR,
			MaxSelect: 1,
		})
	} else if sf, ok := f.(*core.SelectField); ok {
		sf.Values = ProvincesCR
		sf.MaxSelect = 1
	}

	// Enable Email/Password and OAuth2
	col.PasswordAuth.Enabled = true
	if len(col.PasswordAuth.IdentityFields) == 0 {
		col.PasswordAuth.IdentityFields = []string{"email"}
	}
	col.OAuth2.Enabled = true

	// Allow public view of seller profiles (email remains protected by emailVisibility)
	col.ListRule = types.Pointer("")
	col.ViewRule = types.Pointer("")
	col.CreateRule = types.Pointer("")
	col.UpdateRule = types.Pointer("id = @request.auth.id")
	col.DeleteRule = types.Pointer("id = @request.auth.id")

	if err := app.Save(col); err != nil {
		return nil, err
	}
	return col, nil
}

func ensureCategoriesCollection(app core.App) (*core.Collection, error) {
	col, err := app.FindCollectionByNameOrId("categories")
	if err != nil {
		col = core.NewBaseCollection("categories")
	}

	addOrUpdateField(col, &core.TextField{
		Name:        "name",
		Required:    true,
		Max:         100,
		Presentable: true,
	})
	addOrUpdateField(col, &core.TextField{
		Name:     "slug",
		Required: true,
		Max:      100,
	})
	addOrUpdateField(col, &core.TextField{
		Name:     "icon",
		Required: false,
		Max:      100,
	})
	ensureAutodateFields(col)

	col.AddIndex("idx_categories_slug", true, "slug", "")

	// Public read (""), admin-only write (nil)
	col.ListRule = types.Pointer("")
	col.ViewRule = types.Pointer("")
	col.CreateRule = nil
	col.UpdateRule = nil
	col.DeleteRule = nil

	if err := app.Save(col); err != nil {
		return nil, err
	}
	return col, nil
}

func ensureListingsCollection(app core.App, categoriesColId, usersColId string) (*core.Collection, error) {
	col, err := app.FindCollectionByNameOrId("listings")
	if err != nil {
		col = core.NewBaseCollection("listings")
	}

	addOrUpdateField(col, &core.TextField{
		Name:        "title",
		Required:    true,
		Min:         5,
		Max:         200,
		Presentable: true,
	})
	addOrUpdateField(col, &core.TextField{
		Name:     "slug",
		Required: false,
		Max:      250,
	})
	addOrUpdateField(col, &core.EditorField{
		Name:     "description",
		Required: true,
	})
	minPrice := 0.0
	addOrUpdateField(col, &core.NumberField{
		Name:     "price",
		Required: true,
		Min:      &minPrice,
	})
	addOrUpdateField(col, &core.SelectField{
		Name:      "condition",
		Required:  true,
		MaxSelect: 1,
		Values:    ListingConditions,
	})
	addOrUpdateField(col, &core.SelectField{
		Name:      "space",
		Required:  true,
		MaxSelect: 1,
		Values:    ListingSpaces,
	})
	addOrUpdateField(col, &core.SelectField{
		Name:      "province",
		Required:  true,
		MaxSelect: 1,
		Values:    ProvincesCR,
	})
	addOrUpdateField(col, &core.RelationField{
		Name:         "category",
		Required:     true,
		CollectionId: categoriesColId,
		MaxSelect:    1,
	})
	addOrUpdateField(col, &core.RelationField{
		Name:          "seller",
		Required:      true,
		CollectionId:  usersColId,
		MaxSelect:     1,
		CascadeDelete: true,
	})
	addOrUpdateField(col, &core.FileField{
		Name:      "images",
		Required:  false,
		MaxSelect: 8,
		MaxSize:   10 * 1024 * 1024, // 10MB per image
		MimeTypes: []string{
			"image/jpeg",
			"image/png",
			"image/webp",
		},
		Thumbs: []string{
			"300x300f",
			"800x600f",
		},
	})
	addOrUpdateField(col, &core.SelectField{
		Name:      "status",
		Required:  true,
		MaxSelect: 1,
		Values:    ListingStatuses,
	})
	minViews := 0.0
	addOrUpdateField(col, &core.NumberField{
		Name:     "views",
		Required: false,
		OnlyInt:  true,
		Min:      &minViews,
	})
	ensureAutodateFields(col)

	col.AddIndex("idx_listings_slug", true, "slug", "slug != ''")
	col.AddIndex("idx_listings_status_created", false, "status, created", "")

	// API Rules
	col.ListRule = types.Pointer(`status = "active" || @request.auth.id = seller.id`)
	col.ViewRule = types.Pointer(`status = "active" || @request.auth.id = seller.id`)
	col.CreateRule = types.Pointer(`@request.auth.id != "" && @request.body.seller = @request.auth.id`)
	col.UpdateRule = types.Pointer(`@request.auth.id = seller.id`)
	col.DeleteRule = types.Pointer(`@request.auth.id = seller.id`)

	if err := app.Save(col); err != nil {
		return nil, err
	}
	return col, nil
}

func ensureFavoritesCollection(app core.App, usersColId, listingsColId string) (*core.Collection, error) {
	col, err := app.FindCollectionByNameOrId("favorites")
	if err != nil {
		col = core.NewBaseCollection("favorites")
	}

	addOrUpdateField(col, &core.RelationField{
		Name:          "user",
		Required:      true,
		CollectionId:  usersColId,
		MaxSelect:     1,
		CascadeDelete: true,
	})
	addOrUpdateField(col, &core.RelationField{
		Name:          "listing",
		Required:      true,
		CollectionId:  listingsColId,
		MaxSelect:     1,
		CascadeDelete: true,
	})
	ensureAutodateFields(col)

	// Composite unique index (user, listing)
	col.AddIndex("idx_favorites_user_listing", true, "`user`, `listing`", "")

	// API Rules: List/View/Create/Delete restricted to @request.auth.id = user.id
	rule := `@request.auth.id != "" && @request.auth.id = user.id`
	col.ListRule = types.Pointer(rule)
	col.ViewRule = types.Pointer(rule)
	col.CreateRule = types.Pointer(rule)
	col.UpdateRule = types.Pointer(rule)
	col.DeleteRule = types.Pointer(rule)

	if err := app.Save(col); err != nil {
		return nil, err
	}
	return col, nil
}

func seedCategories(app core.App, categoriesCol *core.Collection) error {
	for _, item := range InitialCategories {
		existing, err := app.FindFirstRecordByFilter(
			categoriesCol.Id,
			"slug = {:slug}",
			dbx.Params{"slug": item.Slug},
		)
		if err == nil && existing != nil {
			continue
		}

		rec := core.NewRecord(categoriesCol)
		rec.Set("name", item.Name)
		rec.Set("slug", item.Slug)
		rec.Set("icon", item.Icon)
		if err := app.Save(rec); err != nil {
			return fmt.Errorf("seed category %q: %w", item.Slug, err)
		}
	}
	return nil
}

func addOrUpdateField(col *core.Collection, field core.Field) {
	if existing := col.Fields.GetByName(field.GetName()); existing != nil {
		field.SetId(existing.GetId())
	}
	col.Fields.Add(field)
}

func ensureAutodateFields(col *core.Collection) {
	if col.Fields.GetByName("created") == nil {
		col.Fields.Add(&core.AutodateField{
			Name:     "created",
			OnCreate: true,
		})
	}
	if col.Fields.GetByName("updated") == nil {
		col.Fields.Add(&core.AutodateField{
			Name:     "updated",
			OnCreate: true,
			OnUpdate: true,
		})
	}
}

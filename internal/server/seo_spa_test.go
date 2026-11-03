package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"marketplace-c2c/internal/hooks"
	"marketplace-c2c/internal/schema"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

func TestSEOAndViewEndpoints(t *testing.T) {
	app := core.NewBaseApp(core.BaseAppConfig{
		DataDir: t.TempDir(),
	})
	defer app.ResetBootstrapState()

	schema.Register(app)
	hooks.Register(app)

	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap failed: %v", err)
	}

	// Create a temporary index.html with placeholders
	tmpPublic := t.TempDir()
	indexContent := `<!doctype html>
<html lang="es">
<head>
  <title>__SEO_TITLE__</title>
  <meta name="description" content="__SEO_DESCRIPTION__" />
  <meta property="og:title" content="__OG_TITLE__" />
  <meta property="og:description" content="__OG_DESCRIPTION__" />
  <meta property="og:image" content="__OG_IMAGE__" />
  <meta property="og:url" content="__OG_URL__" />
  <meta property="og:type" content="__OG_TYPE__" />
  <script type="application/ld+json">__SEO_JSON_LD__</script>
</head>
<body><div id="app"></div></body>
</html>`
	if err := os.WriteFile(filepath.Join(tmpPublic, "index.html"), []byte(indexContent), 0644); err != nil {
		t.Fatalf("failed writing index.html: %v", err)
	}

	cfg := Config{
		PublicDir:     tmpPublic,
		FallbackIndex: filepath.Join(tmpPublic, "index.html"),
	}

	// Seed a user and an active listing
	usersCol, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		t.Fatalf("find users collection: %v", err)
	}
	seller := core.NewRecord(usersCol)
	seller.SetEmail("ana@cr.com")
	seller.SetPassword("password123456")
	seller.Set("name", "Ana Rojas")
	seller.Set("phone", "88990011")
	seller.Set("province", "San José")
	if err := app.Save(seller); err != nil {
		t.Fatalf("save seller: %v", err)
	}

	catRecord, err := app.FindFirstRecordByData("categories", "slug", "camas")
	if err != nil {
		t.Fatalf("find category: %v", err)
	}

	listingsCol, err := app.FindCollectionByNameOrId("listings")
	if err != nil {
		t.Fatalf("find listings: %v", err)
	}
	listing := core.NewRecord(listingsCol)
	listing.Set("title", "Cama Matrimonial de Guanacaste")
	listing.Set("slug", "cama-matrimonial-de-guanacaste-123")
	listing.Set("description", "<p>Hermosa cama de madera sólida en excelente estado.</p>")
	listing.Set("price", 195000)
	listing.Set("condition", "Como Nuevo")
	listing.Set("space", "Habitación")
	listing.Set("province", "Heredia")
	listing.Set("category", catRecord.Id)
	listing.Set("seller", seller.Id)
	listing.Set("status", "active")
	listing.Set("views", 0)
	if err := app.Save(listing); err != nil {
		t.Fatalf("save listing: %v", err)
	}

	// Build router via apis.NewRouter
	pbRouter, err := apis.NewRouter(app)
	if err != nil {
		t.Fatalf("NewRouter failed: %v", err)
	}
	se := &core.ServeEvent{
		App:    app,
		Router: pbRouter,
	}
	BindRoutes(se, cfg)

	mux, err := pbRouter.BuildMux()
	if err != nil {
		t.Fatalf("BuildMux failed: %v", err)
	}

	// 1. Test POST /api/listings/{id}/view atomic increment
	reqView := httptest.NewRequest(http.MethodPost, "/api/listings/"+listing.Id+"/view", nil)
	recView := httptest.NewRecorder()
	mux.ServeHTTP(recView, reqView)

	if recView.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on view increment, got %d: %s", recView.Code, recView.Body.String())
	}
	var viewResp map[string]any
	if err := json.Unmarshal(recView.Body.Bytes(), &viewResp); err != nil {
		t.Fatalf("unmarshal viewResp: %v", err)
	}
	if int(viewResp["views"].(float64)) != 1 {
		t.Fatalf("expected views = 1, got %v", viewResp["views"])
	}

	// 2. Test GET /anuncio/{id} dynamic SEO + JSON-LD injection
	reqSEO := httptest.NewRequest(http.MethodGet, "http://mueblesusados.cr/anuncio/"+listing.Id, nil)
	recSEO := httptest.NewRecorder()
	mux.ServeHTTP(recSEO, reqSEO)

	if recSEO.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on /anuncio/{id}, got %d", recSEO.Code)
	}
	body := recSEO.Body.String()
	if !strings.Contains(body, "Cama Matrimonial de Guanacaste - ₡195,000") {
		t.Fatalf("expected formatted title and price in HTML, got:\n%s", body)
	}
	if !strings.Contains(body, `"@type":"Product"`) || !strings.Contains(body, `"priceCurrency":"CRC"`) || !strings.Contains(body, `"price":"195000"`) {
		t.Fatalf("expected Product JSON-LD with CRC currency and price 195000, got:\n%s", body)
	}
	if !strings.Contains(body, `<meta property="og:type" content="product" />`) {
		t.Fatalf("expected og:type product in HTML, got:\n%s", body)
	}

	// 3. Test SPA fallback for /explorar
	reqFallback := httptest.NewRequest(http.MethodGet, "http://mueblesusados.cr/explorar", nil)
	recFallback := httptest.NewRecorder()
	mux.ServeHTTP(recFallback, reqFallback)

	if recFallback.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on /explorar SPA fallback, got %d", recFallback.Code)
	}
	if !strings.Contains(recFallback.Body.String(), DefaultSiteTitle) {
		t.Fatalf("expected default site title on /explorar fallback")
	}
}

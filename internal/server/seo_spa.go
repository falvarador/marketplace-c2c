package server

import (
	"encoding/json"
	"fmt"
	"html"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

const (
	DefaultSiteTitle       = "Muebles Usados Costa Rica | Compra y Venta de Muebles C2C"
	DefaultSiteDescription = "Portal clasificado de compra y venta de muebles nuevos, como nuevos y usados en las 7 provincias de Costa Rica. Contactá directo por WhatsApp."
)

var htmlTagRegex = regexp.MustCompile(`<[^>]*>`)

// Config holds optional settings for the SPA and SEO server.
type Config struct {
	PublicDir     string
	FallbackIndex string
}

// DefaultConfig returns the standard production/dev server paths.
func DefaultConfig() Config {
	return Config{
		PublicDir:     "./pb_public",
		FallbackIndex: "./index.html",
	}
}

// ProductJSONLD represents Schema.org Product structured data.
type ProductJSONLD struct {
	Context       string      `json:"@context"`
	Type          string      `json:"@type"`
	Name          string      `json:"name"`
	Description   string      `json:"description"`
	SKU           string      `json:"sku,omitempty"`
	Image         string      `json:"image,omitempty"`
	ItemCondition string      `json:"itemCondition"`
	Offers        OfferJSONLD `json:"offers"`
}

// OfferJSONLD represents Schema.org Offer structured data.
type OfferJSONLD struct {
	Type          string `json:"@type"`
	PriceCurrency string `json:"priceCurrency"`
	Price         string `json:"price"`
	ItemCondition string `json:"itemCondition"`
	Availability  string `json:"availability"`
	URL           string `json:"url"`
}

// Register binds the atomic view endpoint and the SPA/SEO handlers to app.OnServe().
func Register(app core.App) {
	RegisterWithConfig(app, DefaultConfig())
}

// RegisterWithConfig binds the endpoints using the given configuration.
func RegisterWithConfig(app core.App, cfg Config) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		BindRoutes(se, cfg)
		return se.Next()
	})
}

// BindRoutes attaches the routes onto a ServeEvent router.
func BindRoutes(se *core.ServeEvent, cfg Config) {
	// 1. Atomic view increment endpoint
	se.Router.POST("/api/listings/{id}/view", func(e *core.RequestEvent) error {
		return HandleIncrementView(e)
	})

	// 2. Dynamic SEO/OpenGraph/JSON-LD routes for listings
	se.Router.GET("/anuncio/{id}", func(e *core.RequestEvent) error {
		return HandleListingSEO(e, cfg)
	})
	se.Router.GET("/mueble/{id}", func(e *core.RequestEvent) error {
		return HandleListingSEO(e, cfg)
	})

	// 3. Static asset server & SPA fallback with default metadata
	se.Router.GET("/{path...}", func(e *core.RequestEvent) error {
		return HandleSPAOrStatic(e, cfg)
	})
}

// HandleIncrementView atomically increments the views count of a listing.
func HandleIncrementView(e *core.RequestEvent) error {
	idOrSlug := strings.TrimSpace(e.Request.PathValue("id"))
	if idOrSlug == "" {
		return e.NotFoundError("Anuncio no encontrado", nil)
	}

	record, err := findListingByIDOrSlug(e.App, idOrSlug)
	if err != nil || record == nil {
		return e.NotFoundError("Anuncio no encontrado", nil)
	}

	_, err = e.App.DB().NewQuery(
		"UPDATE listings SET views = COALESCE(views, 0) + 1 WHERE id = {:id}",
	).Bind(dbx.Params{"id": record.Id}).Execute()
	if err != nil {
		return e.InternalServerError("No se pudo incrementar el contador de vistas", err)
	}

	updated, err := e.App.FindRecordById("listings", record.Id)
	views := record.GetInt("views") + 1
	if err == nil && updated != nil {
		views = updated.GetInt("views")
	}

	return e.JSON(http.StatusOK, map[string]any{
		"id":    record.Id,
		"views": views,
	})
}

// HandleListingSEO serves index.html with injected SEO/OpenGraph/Product JSON-LD for active listings.
func HandleListingSEO(e *core.RequestEvent, cfg Config) error {
	idOrSlug := strings.TrimSpace(e.Request.PathValue("id"))
	tpl, err := loadIndexTemplate(cfg)
	if err != nil {
		return e.InternalServerError("No se encontró la plantilla index.html", err)
	}

	baseURL := resolveBaseURL(e.Request)
	reqURL := baseURL + e.Request.URL.Path

	record, err := findListingByIDOrSlug(e.App, idOrSlug)
	if err != nil || record == nil || record.GetString("status") != "active" {
		rendered := InjectDefaultSEO(tpl, baseURL, reqURL)
		return e.HTML(http.StatusOK, rendered)
	}

	rendered := InjectListingSEO(tpl, record, baseURL, reqURL)
	return e.HTML(http.StatusOK, rendered)
}

// HandleSPAOrStatic serves static files from PublicDir or falls back to index.html with default SEO tags.
func HandleSPAOrStatic(e *core.RequestEvent, cfg Config) error {
	reqPath := e.Request.URL.Path
	if strings.HasPrefix(reqPath, "/api/") || strings.HasPrefix(reqPath, "/_/") {
		return e.Next()
	}

	cleanRel := strings.TrimPrefix(filepath.Clean(reqPath), "/")
	if cleanRel != "" && cleanRel != "." && cleanRel != "index.html" && cfg.PublicDir != "" {
		candidate := filepath.Join(cfg.PublicDir, cleanRel)
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			http.ServeFile(e.Response, e.Request, candidate)
			return nil
		}
	}

	tpl, err := loadIndexTemplate(cfg)
	if err != nil {
		return e.InternalServerError("No se encontró index.html", err)
	}

	baseURL := resolveBaseURL(e.Request)
	reqURL := baseURL + reqPath
	rendered := InjectDefaultSEO(tpl, baseURL, reqURL)
	return e.HTML(http.StatusOK, rendered)
}

func findListingByIDOrSlug(app core.App, idOrSlug string) (*core.Record, error) {
	rec, err := app.FindRecordById("listings", idOrSlug)
	if err == nil && rec != nil {
		return rec, nil
	}
	return app.FindFirstRecordByFilter("listings", "slug = {:slug}", dbx.Params{"slug": idOrSlug})
}

func loadIndexTemplate(cfg Config) (string, error) {
	if cfg.PublicDir != "" {
		pubIndex := filepath.Join(cfg.PublicDir, "index.html")
		if b, err := os.ReadFile(pubIndex); err == nil {
			return string(b), nil
		}
	}
	if cfg.FallbackIndex != "" {
		if b, err := os.ReadFile(cfg.FallbackIndex); err == nil {
			return string(b), nil
		}
	}
	return "", fmt.Errorf("index.html not found in %q or %q", cfg.PublicDir, cfg.FallbackIndex)
}

// InjectListingSEO replaces all SEO placeholders in the index.html template for an active listing.
func InjectListingSEO(tpl string, record *core.Record, baseURL, canonicalURL string) string {
	title := strings.TrimSpace(record.GetString("title"))
	price := record.GetFloat("price")
	formattedPrice := FormatCRC(price)
	province := record.GetString("province")

	fullTitle := fmt.Sprintf("%s - %s", title, formattedPrice)
	if province != "" {
		fullTitle = fmt.Sprintf("%s (%s) | Muebles Usados CR", fullTitle, province)
	} else {
		fullTitle = fmt.Sprintf("%s | Muebles Usados CR", fullTitle)
	}

	plainDesc := TruncateText(StripHTML(record.GetString("description")), 160)
	if plainDesc == "" {
		plainDesc = fmt.Sprintf("%s en %s por %s. Contactá al vendedor por WhatsApp.", title, province, formattedPrice)
	}

	imageURL := baseURL + "/favicon.svg"
	images := record.GetStringSlice("images")
	if len(images) > 0 && images[0] != "" {
		imageURL = fmt.Sprintf(
			"%s/api/files/%s/%s/%s?thumb=800x600f",
			strings.TrimRight(baseURL, "/"),
			record.Collection().Id,
			record.Id,
			images[0],
		)
	}

	conditionSchema := MapConditionToSchema(record.GetString("condition"))
	ld := ProductJSONLD{
		Context:       "https://schema.org",
		Type:          "Product",
		Name:          title,
		Description:   plainDesc,
		SKU:           record.Id,
		Image:         imageURL,
		ItemCondition: conditionSchema,
		Offers: OfferJSONLD{
			Type:          "Offer",
			PriceCurrency: "CRC",
			Price:         strconv.FormatInt(int64(math.Round(price)), 10),
			ItemCondition: conditionSchema,
			Availability:  "https://schema.org/InStock",
			URL:           canonicalURL,
		},
	}
	ldBytes, _ := json.Marshal(ld)

	replacer := strings.NewReplacer(
		"__SEO_TITLE__", html.EscapeString(fullTitle),
		"__SEO_DESCRIPTION__", html.EscapeString(plainDesc),
		"__OG_TITLE__", html.EscapeString(fullTitle),
		"__OG_DESCRIPTION__", html.EscapeString(plainDesc),
		"__OG_IMAGE__", html.EscapeString(imageURL),
		"__OG_URL__", html.EscapeString(canonicalURL),
		"__OG_TYPE__", "product",
		"__SEO_JSON_LD__", string(ldBytes),
	)
	return replacer.Replace(tpl)
}

// InjectDefaultSEO replaces all SEO placeholders with default marketplace values.
func InjectDefaultSEO(tpl, baseURL, canonicalURL string) string {
	defaultImg := strings.TrimRight(baseURL, "/") + "/favicon.svg"
	webSiteLD := map[string]any{
		"@context":    "https://schema.org",
		"@type":       "WebSite",
		"name":        "Muebles Usados Costa Rica",
		"description": DefaultSiteDescription,
		"url":         baseURL,
	}
	ldBytes, _ := json.Marshal(webSiteLD)

	replacer := strings.NewReplacer(
		"__SEO_TITLE__", html.EscapeString(DefaultSiteTitle),
		"__SEO_DESCRIPTION__", html.EscapeString(DefaultSiteDescription),
		"__OG_TITLE__", html.EscapeString(DefaultSiteTitle),
		"__OG_DESCRIPTION__", html.EscapeString(DefaultSiteDescription),
		"__OG_IMAGE__", html.EscapeString(defaultImg),
		"__OG_URL__", html.EscapeString(canonicalURL),
		"__OG_TYPE__", "website",
		"__SEO_JSON_LD__", string(ldBytes),
	)
	return replacer.Replace(tpl)
}

// FormatCRC formats a numeric price in Costa Rican Colones (e.g., ₡195,000).
func FormatCRC(amount float64) string {
	rounded := int64(math.Round(amount))
	negative := rounded < 0
	if negative {
		rounded = -rounded
	}
	raw := strconv.FormatInt(rounded, 10)
	var parts []string
	for len(raw) > 3 {
		parts = append([]string{raw[len(raw)-3:]}, parts...)
		raw = raw[:len(raw)-3]
	}
	parts = append([]string{raw}, parts...)
	formatted := "₡" + strings.Join(parts, ",")
	if negative {
		return "-" + formatted
	}
	return formatted
}

// MapConditionToSchema maps the Spanish condition label to a Schema.org OfferItemCondition URL.
func MapConditionToSchema(condition string) string {
	switch strings.TrimSpace(condition) {
	case "Nuevo":
		return "https://schema.org/NewCondition"
	case "Como Nuevo":
		return "https://schema.org/UsedCondition"
	default:
		return "https://schema.org/UsedCondition"
	}
}

// StripHTML removes HTML tags and collapses whitespace.
func StripHTML(input string) string {
	withoutTags := htmlTagRegex.ReplaceAllString(input, " ")
	fields := strings.Fields(html.UnescapeString(withoutTags))
	return strings.Join(fields, " ")
}

// TruncateText truncates a string to maxRunes characters cleanly.
func TruncateText(input string, maxRunes int) string {
	runes := []rune(strings.TrimSpace(input))
	if len(runes) <= maxRunes {
		return string(runes)
	}
	if maxRunes <= 3 {
		return string(runes[:maxRunes])
	}
	return strings.TrimSpace(string(runes[:maxRunes-1])) + "…"
}

func resolveBaseURL(r *http.Request) string {
	if r == nil {
		return "http://localhost:8090"
	}
	scheme := "http"
	if r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https") {
		scheme = "https"
	}
	host := r.Host
	if host == "" {
		host = "localhost:8090"
	}
	return scheme + "://" + host
}

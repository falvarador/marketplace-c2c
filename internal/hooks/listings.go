package hooks

import (
	"regexp"
	"strings"

	"github.com/pocketbase/pocketbase/core"
)

var (
	nonAlphanumericRegex = regexp.MustCompile(`[^a-z0-9]+`)
	spanishReplacer      = strings.NewReplacer(
		"á", "a", "é", "e", "í", "i", "ó", "o", "ú", "u", "ü", "u", "ñ", "n",
		"Á", "a", "É", "e", "Í", "i", "Ó", "o", "Ú", "u", "Ü", "u", "Ñ", "n",
	)
)

// Register configures OnRecordCreateRequest and OnRecordUpdateRequest hooks for listings.
func Register(app core.App) {
	app.OnRecordCreateRequest("listings").BindFunc(func(e *core.RecordRequestEvent) error {
		PrepareListingRecord(e.Record, e.Auth, e.HasSuperuserAuth())
		return e.Next()
	})

	app.OnRecordUpdateRequest("listings").BindFunc(func(e *core.RecordRequestEvent) error {
		PrepareListingRecord(e.Record, e.Auth, e.HasSuperuserAuth())
		return e.Next()
	})
}

// PrepareListingRecord enforces seller ownership, default status, and clean slug generation.
func PrepareListingRecord(record *core.Record, authRecord *core.Record, isSuperuser bool) {
	if record == nil {
		return
	}

	if authRecord != nil && !isSuperuser {
		record.Set("seller", authRecord.Id)
	}

	if strings.TrimSpace(record.GetString("status")) == "" {
		record.Set("status", "active")
	}

	slug := strings.TrimSpace(record.GetString("slug"))
	if slug == "" {
		title := record.GetString("title")
		record.Set("slug", GenerateSlug(title, record.Id))
	} else {
		record.Set("slug", Slugify(slug))
	}
}

// GenerateSlug produces a URL-friendly slug combining the title and record ID.
func GenerateSlug(title, recordID string) string {
	base := Slugify(title)
	idPart := strings.TrimSpace(recordID)
	if len(idPart) > 8 {
		idPart = idPart[:8]
	}
	if base == "" && idPart != "" {
		return idPart
	}
	if idPart != "" {
		return base + "-" + strings.ToLower(idPart)
	}
	return base
}

// Slugify converts an arbitrary Spanish string into a clean lowercase kebab-case slug.
func Slugify(input string) string {
	clean := spanishReplacer.Replace(strings.TrimSpace(input))
	clean = strings.ToLower(clean)
	clean = nonAlphanumericRegex.ReplaceAllString(clean, "-")
	clean = strings.Trim(clean, "-")
	if len(clean) > 80 {
		clean = strings.Trim(clean[:80], "-")
	}
	return clean
}

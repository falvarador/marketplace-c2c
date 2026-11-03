package main

import (
	"log"

	"marketplace-c2c/internal/hooks"
	"marketplace-c2c/internal/schema"
	"marketplace-c2c/internal/server"

	"github.com/pocketbase/pocketbase"
)

func main() {
	app := pocketbase.New()

	schema.Register(app)
	hooks.Register(app)
	server.Register(app)

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}

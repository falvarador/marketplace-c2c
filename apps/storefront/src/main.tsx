import { render } from "preact"
import { App } from "./app"
import "./styles.css"

const root = document.getElementById("app")

if (!root) {
  throw new Error('The storefront entry point requires an element with id="app".')
}

render(<App />, root)

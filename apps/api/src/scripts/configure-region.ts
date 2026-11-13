import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createRegionsWorkflow,
  updateRegionsWorkflow,
} from "@medusajs/medusa/core-flows"

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function parseList(name: string): string[] {
  return requiredEnv(name)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
}

export default async function configureRegion({
  container,
}: {
  container: MedusaContainer
}): Promise<void> {
  const region = {
    name: requiredEnv("MARKETPLACE_REGION_NAME"),
    currency_code: requiredEnv("MARKETPLACE_CURRENCY_CODE").toLowerCase(),
    countries: parseList("MARKETPLACE_COUNTRIES").map((country) =>
      country.toLowerCase(),
    ),
    payment_providers: parseList("MARKETPLACE_PAYMENT_PROVIDER_IDS"),
  }
  if (region.countries.some((country) => !/^[a-z]{2}$/.test(country))) {
    throw new Error("MARKETPLACE_COUNTRIES must contain ISO alpha-2 codes.")
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: existingRegions } = await query.graph({
    entity: "region",
    fields: ["id"],
    filters: { name: region.name },
  })

  if (existingRegions.length > 1) {
    throw new Error(`Multiple regions are named "${region.name}".`)
  }

  if (existingRegions[0]) {
    await updateRegionsWorkflow(container).run({
      input: {
        selector: { id: existingRegions[0].id },
        update: region,
      },
    })
  } else {
    await createRegionsWorkflow(container).run({
      input: { regions: [region] },
    })
  }
}

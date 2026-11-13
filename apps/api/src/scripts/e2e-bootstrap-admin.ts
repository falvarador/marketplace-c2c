import type { MedusaContainer } from "@medusajs/framework/types"
import { createUserAccountWorkflow } from "@medusajs/medusa/core-flows"

export default async function bootstrapE2EAdmin({
  container,
}: {
  container: MedusaContainer
}): Promise<void> {
  const authIdentityId = process.env.E2E_AUTH_IDENTITY_ID
  const email = process.env.E2E_USER_EMAIL
  if (!authIdentityId || !email) {
    throw new Error("E2E_AUTH_IDENTITY_ID and E2E_USER_EMAIL are required.")
  }

  await createUserAccountWorkflow(container).run({
    input: {
      authIdentityId,
      userData: {
        email,
        first_name: "E2E",
        last_name: "Operator",
      },
    },
  })
}

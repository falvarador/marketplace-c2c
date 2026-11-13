import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  MARKETPLACE_POLICY_MODULE,
  MarketplacePolicyModuleService,
} from "../../../modules/marketplace-policy"
import type { TransactionMode } from "../../../utils/transaction-mode"

export type UpsertCategoryMarketplacePolicyInput = {
  category_id: string
  transaction_mode: TransactionMode | null
}

type PreviousPolicy = {
  id: string
  transaction_mode: TransactionMode | null
}

type CompensationData = {
  id: string
  created: boolean
  previous?: PreviousPolicy
}

export const upsertCategoryMarketplacePolicyStep = createStep<
  UpsertCategoryMarketplacePolicyInput,
  { record: { id: string; transaction_mode: TransactionMode | null }; created: boolean },
  CompensationData
>(
  "upsert-category-marketplace-policy",
  async (input, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: categories } = await query.graph({
      entity: "product_category",
      fields: ["id"],
      filters: { id: input.category_id },
    })
    if (!categories[0]) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "Product category not found.",
      )
    }

    const { data: categoryPolicies } = await query.graph({
      entity: "product_category",
      fields: [
        "category_marketplace_policy.id",
        "category_marketplace_policy.transaction_mode",
      ],
      filters: { id: input.category_id },
    })
    const existing = categoryPolicies[0]?.category_marketplace_policy
    const service = container.resolve<MarketplacePolicyModuleService>(
      MARKETPLACE_POLICY_MODULE,
    )
    if (existing) {
      const previous = existing as PreviousPolicy
      const record = await service.updateCategoryMarketplacePolicies({
        id: previous.id,
        transaction_mode: input.transaction_mode,
      })
      return new StepResponse(
        { record, created: false },
        { id: previous.id, created: false, previous },
      )
    }

    const record = await service.createCategoryMarketplacePolicies({
      transaction_mode: input.transaction_mode,
    })
    return new StepResponse(
      { record, created: true },
      { id: record.id, created: true },
    )
  },
  async (compensation, { container }) => {
    if (!compensation) {
      return
    }
    const service = container.resolve<MarketplacePolicyModuleService>(
      MARKETPLACE_POLICY_MODULE,
    )
    if (compensation.created) {
      await service.deleteCategoryMarketplacePolicies(compensation.id)
    } else if (compensation.previous) {
      await service.updateCategoryMarketplacePolicies(compensation.previous)
    }
  },
)

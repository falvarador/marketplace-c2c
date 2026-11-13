import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createStep,
  StepResponse,
} from "@medusajs/framework/workflows-sdk"
import { ensureSellerOwnsProduct } from "@mercurjs/core/api/vendor/products/helpers"
import {
  MARKETPLACE_POLICY_MODULE,
  MarketplacePolicyModuleService,
} from "../../../modules/marketplace-policy"

export type UpsertProductMarketplaceDataInput = {
  seller_id: string
  product_id: string
  country_code?: string | null
  region?: string | null
  locality?: string | null
}

type PreviousData = {
  id: string
  country_code: string | null
  region: string | null
  locality: string | null
}

type ProductMarketplaceDataOutput = {
  record: { id: string }
  created: boolean
}

type CompensationData = {
  id: string
  created: boolean
  previous?: PreviousData
}

export const upsertProductMarketplaceDataStep = createStep<
  UpsertProductMarketplaceDataInput,
  ProductMarketplaceDataOutput,
  CompensationData
>(
  "upsert-product-marketplace-data",
  async (input: UpsertProductMarketplaceDataInput, { container }) => {
    await ensureSellerOwnsProduct(container, input.seller_id, [input.product_id])

    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: existing } = await query.graph({
      entity: "product_marketplace_data",
      fields: ["id", "country_code", "region", "locality"],
      filters: { product: { id: input.product_id } },
    })
    const service = container.resolve<MarketplacePolicyModuleService>(
      MARKETPLACE_POLICY_MODULE,
    )
    const data = {
      country_code: input.country_code,
      region: input.region,
      locality: input.locality,
    }

    if (existing[0]) {
      const previous: PreviousData = existing[0]
      const record = await service.updateProductMarketplaceDatas({
        id: previous.id,
        ...data,
      })
      return new StepResponse(
        { record, created: false },
        { id: previous.id, created: false, previous },
      )
    }

    const record = await service.createProductMarketplaceDatas(data)
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
      await service.deleteProductMarketplaceDatas(compensation.id)
      return
    }

    if (compensation.previous) {
      await service.updateProductMarketplaceDatas(compensation.previous)
    }
  },
)

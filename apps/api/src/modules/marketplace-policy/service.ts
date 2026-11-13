import { MedusaService } from "@medusajs/framework/utils"
import CategoryMarketplacePolicy from "./models/category-marketplace-policy"
import ProductMarketplaceData from "./models/product-marketplace-data"

export class MarketplacePolicyModuleService extends MedusaService({
  CategoryMarketplacePolicy,
  ProductMarketplaceData,
}) {}

export default MarketplacePolicyModuleService

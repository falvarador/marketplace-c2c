import { Module } from "@medusajs/framework/utils"
import MarketplacePolicyModuleService from "./service"

export { MarketplacePolicyModuleService }

export const MARKETPLACE_POLICY_MODULE = "marketplacePolicy"

export default Module(MARKETPLACE_POLICY_MODULE, {
  service: MarketplacePolicyModuleService,
})

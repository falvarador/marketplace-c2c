import { Module } from "@medusajs/framework/utils"
import ClassifiedEngagementModuleService from "./service"

export { ClassifiedEngagementModuleService }

export const CLASSIFIED_ENGAGEMENT_MODULE = "classifiedEngagement"

export default Module(CLASSIFIED_ENGAGEMENT_MODULE, {
  service: ClassifiedEngagementModuleService,
})

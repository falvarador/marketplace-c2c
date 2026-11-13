import { MedusaService } from "@medusajs/framework/utils"
import Lead from "./models/lead"
import ReservationRequest from "./models/reservation-request"

export class ClassifiedEngagementModuleService extends MedusaService({
  Lead,
  ReservationRequest,
}) {}

export default ClassifiedEngagementModuleService

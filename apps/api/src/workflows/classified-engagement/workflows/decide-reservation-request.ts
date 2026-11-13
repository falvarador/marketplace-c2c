import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  decideReservationRequestStep,
  type DecideReservationRequestInput,
} from "../steps/decide-reservation-request"

export const decideReservationRequestWorkflow = createWorkflow(
  "decide-classified-reservation-request",
  (input: DecideReservationRequestInput) =>
    new WorkflowResponse(decideReservationRequestStep(input)),
)

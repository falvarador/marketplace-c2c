import { updateOrdersStep } from "@medusajs/medusa/core-flows"
import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

export type ConfirmExternalPaymentInput = {
  order_id: string
  metadata: Record<string, unknown>
}

export const confirmExternalPaymentWorkflow = createWorkflow(
  "confirm-external-payment",
  (input: ConfirmExternalPaymentInput) =>
    new WorkflowResponse(
      updateOrdersStep({
        selector: { id: input.order_id },
        update: { metadata: input.metadata },
      }),
    ),
)

import { randomUUID } from "node:crypto"
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"
import {
  AbstractPaymentProvider,
  MedusaError,
  ModuleProvider,
  Modules,
  PaymentActions,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"

export class ExternalSinpePaymentProvider extends AbstractPaymentProvider {
  static identifier = "external_sinpe"

  constructor(
    container: Record<string, unknown>,
    options: Record<string, unknown>,
  ) {
    super(container, options)
  }

  async initiatePayment(
    _input: InitiatePaymentInput,
  ): Promise<InitiatePaymentOutput> {
    return { id: randomUUID(), data: { method: "sinpe_movil" } }
  }

  async authorizePayment(
    input: AuthorizePaymentInput,
  ): Promise<AuthorizePaymentOutput> {
    return {
      data: input.data ?? { method: "sinpe_movil" },
      status: PaymentSessionStatus.PENDING_AUTHORIZATION,
    }
  }

  async getPaymentStatus(
    input: GetPaymentStatusInput,
  ): Promise<GetPaymentStatusOutput> {
    return {
      data: input.data ?? { method: "sinpe_movil" },
      status: PaymentSessionStatus.PENDING_AUTHORIZATION,
    }
  }

  async retrievePayment(
    _input: RetrievePaymentInput,
  ): Promise<RetrievePaymentOutput> {
    return {}
  }

  async updatePayment(
    input: UpdatePaymentInput,
  ): Promise<UpdatePaymentOutput> {
    return { data: input.data ?? { method: "sinpe_movil" } }
  }

  async deletePayment(
    input: DeletePaymentInput,
  ): Promise<DeletePaymentOutput> {
    return { data: input.data ?? { method: "sinpe_movil" } }
  }

  async cancelPayment(
    input: CancelPaymentInput,
  ): Promise<CancelPaymentOutput> {
    return { data: input.data ?? { method: "sinpe_movil" } }
  }

  async capturePayment(
    _input: CapturePaymentInput,
  ): Promise<CapturePaymentOutput> {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "SINPE Móvil payments are confirmed externally and cannot be captured.",
    )
  }

  async refundPayment(
    _input: RefundPaymentInput,
  ): Promise<RefundPaymentOutput> {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "SINPE Móvil refunds must be handled directly by the seller.",
    )
  }

  async getWebhookActionAndData(
    _data: ProviderWebhookPayload["payload"],
  ): Promise<WebhookActionResult> {
    return { action: PaymentActions.NOT_SUPPORTED }
  }
}

export default ModuleProvider(Modules.PAYMENT, {
  services: [ExternalSinpePaymentProvider],
})

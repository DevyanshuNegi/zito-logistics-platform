import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';

type InitiateStkPushInput = {
  amount: number;
  phoneNumber?: string | null;
  reference: string;
  description?: string;
};

type QueryStkPushStatusInput = {
  checkoutRequestId: string;
  reference: string;
};

type QueryTransactionStatusInput = {
  transactionId: string;
  reference: string;
  remarks?: string;
};

type RequestReversalInput = {
  amount: number;
  transactionId: string;
  reference: string;
  remarks?: string;
};

type InitiateB2CDisbursementInput = {
  amount: number;
  phoneNumber?: string | null;
  reference: string;
  remarks?: string;
  commandId?: string;
};

type InitiateB2BDisbursementInput = {
  amount: number;
  partyNumber?: string | null;
  reference: string;
  remarks?: string;
  commandId?: string;
  accountReference?: string | null;
};

type MpesaCallbackMetadata = Record<string, string | number | null>;

export type MpesaLifecycleResult = {
  provider: 'MPESA';
  action:
    | 'STK_PUSH'
    | 'STK_QUERY'
    | 'TRANSACTION_STATUS'
    | 'REVERSAL'
    | 'B2C'
    | 'B2B'
    | 'CALLBACK'
    | 'RESULT'
    | 'TIMEOUT';
  mode: 'SIMULATED' | 'LIVE';
  success: boolean;
  providerStatus: string;
  merchantRequestId?: string | null;
  checkoutRequestId?: string | null;
  providerReceiptNumber?: string | null;
  transactionId?: string | null;
  conversationId?: string | null;
  originatorConversationId?: string | null;
  customerMessage?: string | null;
  resultCode?: string | number | null;
  resultDesc?: string | null;
  amount?: number | null;
  payload?: unknown;
  metadata?: MpesaCallbackMetadata;
};

@Injectable()
export class MpesaService {
  async initiateStkPush({
    amount,
    phoneNumber,
    reference,
    description,
  }: InitiateStkPushInput): Promise<MpesaLifecycleResult> {
    if (!phoneNumber) {
      throw new BadRequestException('M-Pesa requires a phone number');
    }

    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

    if (!this.hasCollectionConfig()) {
      return {
        provider: 'MPESA',
        action: 'STK_PUSH',
        mode: 'SIMULATED',
        success: true,
        providerStatus: 'PENDING',
        checkoutRequestId: `SIM-STK-${Date.now()}`,
        merchantRequestId: `SIM-MERCHANT-${Date.now()}`,
        customerMessage: `Simulated M-Pesa STK push for ${normalizedPhone}`,
        amount,
        payload: {
          amount,
          phoneNumber: normalizedPhone,
          reference,
          description: description ?? `Zito payment ${reference}`,
        },
      };
    }

    const timestamp = this.buildTimestamp();
    const body = {
      BusinessShortCode: this.getBusinessShortCode(),
      Password: this.buildPassword(timestamp),
      Timestamp: timestamp,
      TransactionType: process.env.MPESA_TRANSACTION_TYPE || 'CustomerPayBillOnline',
      Amount: Math.round(amount),
      PartyA: normalizedPhone,
      PartyB: process.env.MPESA_PARTYB || this.getBusinessShortCode(),
      PhoneNumber: normalizedPhone,
      CallBackURL: this.getCallbackUrl(),
      AccountReference: reference,
      TransactionDesc: description ?? `Zito payment ${reference}`,
    };

    const response = await this.postJson(
      '/mpesa/stkpush/v1/processrequest',
      body,
      await this.requestAccessToken(),
    );

    const success = String(response?.ResponseCode ?? '') === '0';

    return {
      provider: 'MPESA',
      action: 'STK_PUSH',
      mode: 'LIVE',
      success,
      providerStatus: success ? 'PENDING' : 'FAILED',
      merchantRequestId: this.readString(response?.MerchantRequestID),
      checkoutRequestId: this.readString(response?.CheckoutRequestID),
      customerMessage:
        this.readString(response?.CustomerMessage) ??
        this.readString(response?.ResponseDescription),
      resultCode: this.readCodeValue(response?.ResponseCode),
      resultDesc:
        this.readString(response?.ResponseDescription) ??
        this.readString(response?.CustomerMessage),
      amount,
      payload: response,
    };
  }

  async queryStkPushStatus({
    checkoutRequestId,
    reference,
  }: QueryStkPushStatusInput): Promise<MpesaLifecycleResult> {
    if (!this.hasCollectionConfig()) {
      return {
        provider: 'MPESA',
        action: 'STK_QUERY',
        mode: 'SIMULATED',
        success: true,
        providerStatus: 'SUCCESS',
        checkoutRequestId,
        merchantRequestId: reference,
        providerReceiptNumber: `SIMRCPT${Date.now()}`,
        resultCode: 0,
        resultDesc: 'Simulated STK query resolved successfully',
        payload: {
          CheckoutRequestID: checkoutRequestId,
          AccountReference: reference,
        },
      };
    }

    const timestamp = this.buildTimestamp();
    const body = {
      BusinessShortCode: this.getBusinessShortCode(),
      Password: this.buildPassword(timestamp),
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    };

    const response = await this.postJson(
      '/mpesa/stkpushquery/v1/query',
      body,
      await this.requestAccessToken(),
    );

    const resultCode = this.readNumericCode(response?.ResultCode ?? response?.ResponseCode);
    const success = resultCode === 0;
    const providerStatus =
      success
        ? 'SUCCESS'
        : response?.ResultCode == null && String(response?.ResponseCode ?? '') === '0'
          ? 'PENDING'
          : 'FAILED';

    return {
      provider: 'MPESA',
      action: 'STK_QUERY',
      mode: 'LIVE',
      success,
      providerStatus,
      checkoutRequestId,
      merchantRequestId: reference,
      resultCode: this.readCodeValue(response?.ResultCode ?? response?.ResponseCode),
      resultDesc:
        this.readString(response?.ResultDesc) ??
        this.readString(response?.ResponseDescription),
      payload: response,
    };
  }

  async queryTransactionStatus({
    transactionId,
    reference,
    remarks,
  }: QueryTransactionStatusInput): Promise<MpesaLifecycleResult> {
    if (!this.hasOperationsConfig()) {
      return {
        provider: 'MPESA',
        action: 'TRANSACTION_STATUS',
        mode: 'SIMULATED',
        success: true,
        providerStatus: 'STATUS_QUERY_REQUESTED',
        transactionId,
        conversationId: `SIM-CONV-${Date.now()}`,
        originatorConversationId: `SIM-ORIG-${Date.now()}`,
        resultCode: 0,
        resultDesc: 'Simulated transaction status query accepted',
        payload: {
          transactionId,
          reference,
          remarks,
        },
      };
    }

    const body = {
      Initiator: this.getInitiatorName(),
      SecurityCredential: this.getSecurityCredential(),
      CommandID: 'TransactionStatusQuery',
      TransactionID: transactionId,
      PartyA: process.env.MPESA_PARTYB || this.getBusinessShortCode(),
      IdentifierType: process.env.MPESA_IDENTIFIER_TYPE || '4',
      ResultURL: this.getResultUrl(),
      QueueTimeOutURL: this.getTimeoutUrl(),
      Remarks: remarks ?? `Status query for ${reference}`,
      Occasion: reference,
    };

    const response = await this.postJson(
      '/mpesa/transactionstatus/v1/query',
      body,
      await this.requestAccessToken(),
    );

    const success = String(response?.ResponseCode ?? '') === '0';

    return {
      provider: 'MPESA',
      action: 'TRANSACTION_STATUS',
      mode: 'LIVE',
      success,
      providerStatus: success ? 'STATUS_QUERY_REQUESTED' : 'STATUS_QUERY_FAILED',
      transactionId,
      conversationId: this.readString(response?.ConversationID),
      originatorConversationId: this.readString(response?.OriginatorConversationID),
      resultCode: this.readCodeValue(response?.ResponseCode),
      resultDesc: this.readString(response?.ResponseDescription),
      payload: response,
    };
  }

  async requestReversal({
    amount,
    transactionId,
    reference,
    remarks,
  }: RequestReversalInput): Promise<MpesaLifecycleResult> {
    if (!this.hasOperationsConfig()) {
      return {
        provider: 'MPESA',
        action: 'REVERSAL',
        mode: 'SIMULATED',
        success: true,
        providerStatus: 'REVERSED',
        transactionId,
        providerReceiptNumber: transactionId,
        conversationId: `SIM-CONV-${Date.now()}`,
        originatorConversationId: `SIM-ORIG-${Date.now()}`,
        resultCode: 0,
        resultDesc: 'Simulated reversal completed successfully',
        amount,
        payload: {
          amount,
          reference,
          remarks,
        },
      };
    }

    const body = {
      Initiator: this.getInitiatorName(),
      SecurityCredential: this.getSecurityCredential(),
      CommandID: 'TransactionReversal',
      TransactionID: transactionId,
      Amount: Math.round(amount),
      ReceiverParty: process.env.MPESA_PARTYB || this.getBusinessShortCode(),
      RecieverIdentifierType: process.env.MPESA_IDENTIFIER_TYPE || '4',
      ResultURL: this.getResultUrl(),
      QueueTimeOutURL: this.getTimeoutUrl(),
      Remarks: remarks ?? `Reversal for ${reference}`,
      Occasion: reference,
    };

    const response = await this.postJson(
      '/mpesa/reversal/v1/request',
      body,
      await this.requestAccessToken(),
    );

    const success = String(response?.ResponseCode ?? '') === '0';

    return {
      provider: 'MPESA',
      action: 'REVERSAL',
      mode: 'LIVE',
      success,
      providerStatus: success ? 'REVERSAL_REQUESTED' : 'REVERSAL_FAILED',
      transactionId,
      providerReceiptNumber: transactionId,
      conversationId: this.readString(response?.ConversationID),
      originatorConversationId: this.readString(response?.OriginatorConversationID),
      resultCode: this.readCodeValue(response?.ResponseCode),
      resultDesc: this.readString(response?.ResponseDescription),
      amount,
      payload: response,
    };
  }

  async initiateB2CDisbursement({
    amount,
    phoneNumber,
    reference,
    remarks,
    commandId,
  }: InitiateB2CDisbursementInput): Promise<MpesaLifecycleResult> {
    if (!phoneNumber) {
      throw new BadRequestException('M-Pesa B2C disbursement requires a phone number');
    }

    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

    if (!this.hasOperationsConfig()) {
      const transactionId = `SIMB2C${Date.now()}`;
      return {
        provider: 'MPESA',
        action: 'B2C',
        mode: 'SIMULATED',
        success: true,
        providerStatus: 'SUCCESS',
        providerReceiptNumber: transactionId,
        transactionId,
        conversationId: `SIM-CONV-${Date.now()}`,
        originatorConversationId: `SIM-ORIG-${Date.now()}`,
        resultCode: 0,
        resultDesc: 'Simulated B2C disbursement completed successfully',
        amount,
        payload: {
          amount,
          phoneNumber: normalizedPhone,
          reference,
          commandId: commandId ?? process.env.MPESA_B2C_COMMAND_ID ?? 'BusinessPayment',
        },
      };
    }

    const body = {
      InitiatorName: this.getInitiatorName(),
      SecurityCredential: this.getSecurityCredential(),
      CommandID: commandId ?? process.env.MPESA_B2C_COMMAND_ID ?? 'BusinessPayment',
      Amount: Math.round(amount),
      PartyA: process.env.MPESA_PARTYB || this.getBusinessShortCode(),
      PartyB: normalizedPhone,
      Remarks: remarks ?? `B2C disbursement for ${reference}`,
      QueueTimeOutURL: this.getTimeoutUrl(),
      ResultURL: this.getResultUrl(),
      Occasion: reference,
    };

    const response = await this.postJson(
      '/mpesa/b2c/v1/paymentrequest',
      body,
      await this.requestAccessToken(),
    );

    const success = String(response?.ResponseCode ?? '') === '0';

    return {
      provider: 'MPESA',
      action: 'B2C',
      mode: 'LIVE',
      success,
      providerStatus: success ? 'INITIATED' : 'FAILED',
      conversationId: this.readString(response?.ConversationID),
      originatorConversationId: this.readString(response?.OriginatorConversationID),
      resultCode: this.readCodeValue(response?.ResponseCode),
      resultDesc: this.readString(response?.ResponseDescription),
      amount,
      payload: response,
    };
  }

  async initiateB2BDisbursement({
    amount,
    partyNumber,
    reference,
    remarks,
    commandId,
    accountReference,
  }: InitiateB2BDisbursementInput): Promise<MpesaLifecycleResult> {
    if (!partyNumber?.trim()) {
      throw new BadRequestException('M-Pesa B2B disbursement requires a beneficiary party number');
    }

    if (!this.hasOperationsConfig()) {
      const transactionId = `SIMB2B${Date.now()}`;
      return {
        provider: 'MPESA',
        action: 'B2B',
        mode: 'SIMULATED',
        success: true,
        providerStatus: 'SUCCESS',
        providerReceiptNumber: transactionId,
        transactionId,
        conversationId: `SIM-CONV-${Date.now()}`,
        originatorConversationId: `SIM-ORIG-${Date.now()}`,
        resultCode: 0,
        resultDesc: 'Simulated B2B disbursement completed successfully',
        amount,
        payload: {
          amount,
          partyNumber,
          reference,
          accountReference,
          commandId:
            commandId ?? process.env.MPESA_B2B_COMMAND_ID ?? 'BusinessPayBill',
        },
      };
    }

    const body = {
      Initiator: this.getInitiatorName(),
      SecurityCredential: this.getSecurityCredential(),
      CommandID: commandId ?? process.env.MPESA_B2B_COMMAND_ID ?? 'BusinessPayBill',
      SenderIdentifierType: process.env.MPESA_SENDER_IDENTIFIER_TYPE || '4',
      RecieverIdentifierType: process.env.MPESA_RECEIVER_IDENTIFIER_TYPE || '4',
      Amount: Math.round(amount),
      PartyA: process.env.MPESA_PARTYB || this.getBusinessShortCode(),
      PartyB: partyNumber,
      AccountReference: accountReference ?? reference,
      Remarks: remarks ?? `B2B disbursement for ${reference}`,
      QueueTimeOutURL: this.getTimeoutUrl(),
      ResultURL: this.getResultUrl(),
    };

    const response = await this.postJson(
      '/mpesa/b2b/v1/paymentrequest',
      body,
      await this.requestAccessToken(),
    );

    const success = String(response?.ResponseCode ?? '') === '0';

    return {
      provider: 'MPESA',
      action: 'B2B',
      mode: 'LIVE',
      success,
      providerStatus: success ? 'INITIATED' : 'FAILED',
      conversationId: this.readString(response?.ConversationID),
      originatorConversationId: this.readString(response?.OriginatorConversationID),
      resultCode: this.readCodeValue(response?.ResponseCode),
      resultDesc: this.readString(response?.ResponseDescription),
      amount,
      payload: response,
    };
  }

  parseCallbackPayload(payload: Record<string, unknown>): MpesaLifecycleResult {
    const callback = (payload?.Body as { stkCallback?: Record<string, unknown> } | undefined)
      ?.stkCallback;
    const metadata = this.extractCallbackMetadata(callback?.CallbackMetadata);
    const resultCode = this.readNumericCode(callback?.ResultCode);
    const success = resultCode === 0;

    return {
      provider: 'MPESA',
      action: 'CALLBACK',
      mode: 'LIVE',
      success,
      providerStatus: success ? 'SUCCESS' : 'FAILED',
      merchantRequestId: this.readString(callback?.MerchantRequestID),
      checkoutRequestId: this.readString(callback?.CheckoutRequestID),
      providerReceiptNumber: this.readString(metadata.MpesaReceiptNumber),
      transactionId: this.readString(metadata.MpesaReceiptNumber),
      resultCode,
      resultDesc: this.readString(callback?.ResultDesc),
      amount: this.readAmount(metadata.Amount),
      payload,
      metadata,
    };
  }

  parseResultPayload(
    payload: Record<string, unknown>,
    stage: 'RESULT' | 'TIMEOUT',
  ): MpesaLifecycleResult {
    const result = (payload?.Result as Record<string, unknown> | undefined) ?? payload;
    const resultParameters = this.extractResultParameters(result?.ResultParameters);
    const resultCode = this.readNumericCode(result?.ResultCode);
    const success = stage === 'TIMEOUT' ? false : resultCode === 0;

    return {
      provider: 'MPESA',
      action: stage,
      mode: 'LIVE',
      success,
      providerStatus:
        stage === 'TIMEOUT'
          ? 'TIMEOUT'
          : success
            ? 'SUCCESS'
            : 'FAILED',
      transactionId:
        this.readString(result?.TransactionID) ??
        this.readString(resultParameters.TransactionID) ??
        this.readString(resultParameters.ReceiptNo),
      providerReceiptNumber:
        this.readString(resultParameters.ReceiptNo) ??
        this.readString(result?.TransactionID),
      conversationId: this.readString(result?.ConversationID),
      originatorConversationId: this.readString(result?.OriginatorConversationID),
      resultCode,
      resultDesc:
        this.readString(result?.ResultDesc) ??
        (stage === 'TIMEOUT' ? 'M-Pesa async request timed out' : null),
      payload,
      metadata: resultParameters,
    };
  }

  private async requestAccessToken() {
    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

    if (!consumerKey || !consumerSecret) {
      throw new BadGatewayException('M-Pesa OAuth credentials are not configured');
    }

    const response = await fetch(
      `${this.getBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`,
      {
        method: 'GET',
        headers: {
          Authorization: `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`,
        },
      },
    );

    if (!response.ok) {
      throw new BadGatewayException(
        `M-Pesa OAuth request failed with status ${response.status}`,
      );
    }

    const payload = (await response.json()) as { access_token?: string };
    if (!payload.access_token) {
      throw new BadGatewayException('M-Pesa OAuth response did not include an access token');
    }

    return payload.access_token;
  }

  private async postJson(
    path: string,
    body: Record<string, unknown>,
    accessToken: string,
  ) {
    const response = await fetch(`${this.getBaseUrl()}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      throw new BadGatewayException(
        this.readString(payload.errorMessage) ??
          this.readString(payload.ResponseDescription) ??
          `M-Pesa request failed with status ${response.status}`,
      );
    }

    return payload;
  }

  private hasCollectionConfig() {
    return Boolean(
      process.env.MPESA_CONSUMER_KEY &&
        process.env.MPESA_CONSUMER_SECRET &&
        process.env.MPESA_SHORTCODE &&
        process.env.MPESA_PASSKEY &&
        process.env.MPESA_CALLBACK_URL,
    );
  }

  private hasOperationsConfig() {
    return Boolean(
      this.hasCollectionConfig() &&
        process.env.MPESA_INITIATOR_NAME &&
        process.env.MPESA_SECURITY_CREDENTIAL &&
        process.env.MPESA_RESULT_URL &&
        process.env.MPESA_TIMEOUT_URL,
    );
  }

  private getBaseUrl() {
    return process.env.MPESA_ENVIRONMENT === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';
  }

  private getBusinessShortCode() {
    const shortCode = process.env.MPESA_SHORTCODE;
    if (!shortCode) {
      throw new BadGatewayException('MPESA_SHORTCODE is not configured');
    }
    return shortCode;
  }

  private getCallbackUrl() {
    const callbackUrl = process.env.MPESA_CALLBACK_URL;
    if (!callbackUrl) {
      throw new BadGatewayException('MPESA_CALLBACK_URL is not configured');
    }
    return callbackUrl;
  }

  private getResultUrl() {
    const resultUrl = process.env.MPESA_RESULT_URL;
    if (!resultUrl) {
      throw new BadGatewayException('MPESA_RESULT_URL is not configured');
    }
    return resultUrl;
  }

  private getTimeoutUrl() {
    const timeoutUrl = process.env.MPESA_TIMEOUT_URL;
    if (!timeoutUrl) {
      throw new BadGatewayException('MPESA_TIMEOUT_URL is not configured');
    }
    return timeoutUrl;
  }

  private getInitiatorName() {
    const initiator = process.env.MPESA_INITIATOR_NAME;
    if (!initiator) {
      throw new BadGatewayException('MPESA_INITIATOR_NAME is not configured');
    }
    return initiator;
  }

  private getSecurityCredential() {
    const securityCredential = process.env.MPESA_SECURITY_CREDENTIAL;
    if (!securityCredential) {
      throw new BadGatewayException('MPESA_SECURITY_CREDENTIAL is not configured');
    }
    return securityCredential;
  }

  private buildTimestamp() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = `${now.getMonth() + 1}`.padStart(2, '0');
    const dd = `${now.getDate()}`.padStart(2, '0');
    const hh = `${now.getHours()}`.padStart(2, '0');
    const min = `${now.getMinutes()}`.padStart(2, '0');
    const ss = `${now.getSeconds()}`.padStart(2, '0');
    return `${yyyy}${mm}${dd}${hh}${min}${ss}`;
  }

  private buildPassword(timestamp: string) {
    const passkey = process.env.MPESA_PASSKEY;
    if (!passkey) {
      throw new BadGatewayException('MPESA_PASSKEY is not configured');
    }
    return Buffer.from(`${this.getBusinessShortCode()}${passkey}${timestamp}`).toString(
      'base64',
    );
  }

  private normalizePhoneNumber(phoneNumber: string) {
    const numeric = phoneNumber.replace(/[^\d+]/g, '');
    if (numeric.startsWith('+254')) {
      return numeric.slice(1);
    }
    if (numeric.startsWith('254')) {
      return numeric;
    }
    if (numeric.startsWith('0')) {
      return `254${numeric.slice(1)}`;
    }
    if (numeric.startsWith('7') || numeric.startsWith('1')) {
      return `254${numeric}`;
    }
    throw new BadRequestException('Phone number must be a valid Kenyan MSISDN');
  }

  private extractCallbackMetadata(
    metadata: unknown,
  ): MpesaCallbackMetadata {
    const items =
      (metadata as { Item?: Array<{ Name?: string; Value?: string | number }> } | undefined)
        ?.Item ?? [];

    return items.reduce<MpesaCallbackMetadata>((accumulator, item) => {
      if (item?.Name) {
        accumulator[item.Name] = item.Value ?? null;
      }
      return accumulator;
    }, {});
  }

  private extractResultParameters(parameters: unknown): MpesaCallbackMetadata {
    const items =
      (parameters as {
        ResultParameter?: Array<{ Key?: string; Value?: string | number }>;
      } | undefined)?.ResultParameter ?? [];

    return items.reduce<MpesaCallbackMetadata>((accumulator, item) => {
      if (item?.Key) {
        accumulator[item.Key] = item.Value ?? null;
      }
      return accumulator;
    }, {});
  }

  private readString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
  }

  private readNumericCode(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }

  private readCodeValue(value: unknown) {
    return this.readString(value) ?? this.readNumericCode(value);
  }

  private readAmount(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }
}

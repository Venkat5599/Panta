import type { Logger } from "@premium/core";
import { type BaseUnits, type DecimalAmount, parseBaseUnits } from "./amounts.ts";
import { PantaHttp, type PantaHttpOptions } from "./http.ts";
import {
  ApiKeyResponse,
  AuthTokenResponse,
  CreateMarketQuoteResponse,
  type CreateMarketQuoteRequest,
  Market,
  MarketList,
  OrderQuoteResponse,
  PositionList,
  RegisterMarketResponse,
  type Side,
  TradeReportResponse,
  UnsignedTransactionResponse,
} from "./schemas.ts";

/**
 * Every endpoint path in one place.
 *
 * Panta's docs describe the workflows but not the exact routes, so several of
 * these are inferred from the playground's tab list. When the day-zero spike
 * reveals the real routes, this object is the only thing that changes.
 */
export const PATHS = {
  register: "/auth/register/",
  token: "/auth/token/",
  apiKeys: "/account/keys/",
  whoami: "/whoami/",

  markets: "/markets/",
  market: (id: string | number) => `/markets/${id}/`,

  createQuote: "/markets/create/quote/",
  createBuild: "/markets/create/build/",
  createRegister: "/markets/register/",

  orderQuote: "/orders/quote/",
  orderBuild: "/orders/build/",
  orderSubmit: "/orders/submit/",

  positions: "/positions/",
  claimBuild: "/claim/build/",
  creatorFeesBuild: "/claim/creator-fees/build/",

  trades: "/trades/",
  trade: (signature: string) => `/trades/${signature}/`,
} as const;

/** Both quote and build steps can hand back a transaction under different keys. */
function transactionOf(res: UnsignedTransactionResponse, context: string): string {
  const tx = res.transaction ?? res.tx;
  if (!tx) {
    throw new Error(
      `Panta returned no transaction for ${context}. Keys present: ${Object.keys(res).join(", ")}`,
    );
  }
  return tx;
}

export interface PantaClientOptions extends PantaHttpOptions {
  logger?: Logger;
}

export class PantaClient {
  private readonly http: PantaHttp;
  private readonly logger: Logger | undefined;

  constructor(options: PantaClientOptions = {}) {
    this.http = new PantaHttp(options);
    this.logger = options.logger;
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  registerAccount(email: string, password: string): Promise<AuthTokenResponse> {
    return this.http.post(PATHS.register, { email, password }, AuthTokenResponse);
  }

  async getToken(email: string, password: string): Promise<string> {
    const res = await this.http.post(PATHS.token, { email, password }, AuthTokenResponse);
    const token = res.access ?? res.token;
    if (!token) {
      throw new Error(
        `Panta auth returned no token. Keys present: ${Object.keys(res).join(", ")}`,
      );
    }
    return token;
  }

  createApiKey(bearerToken: string, name = "premium-factory"): Promise<ApiKeyResponse> {
    return this.http.post(PATHS.apiKeys, { name }, ApiKeyResponse, {
      auth: { bearerToken },
    });
  }

  // ── Markets ───────────────────────────────────────────────────────────────

  /** Read-only and retryable. Catch-up on boot diffs against this. */
  listMarkets(): Promise<MarketList> {
    return this.http.get(PATHS.markets, MarketList);
  }

  getMarket(id: string | number): Promise<Market> {
    return this.http.get(PATHS.market(id), Market);
  }

  // ── Market creation ───────────────────────────────────────────────────────

  /**
   * Quote the creation fee.
   *
   * Returned as branded BaseUnits so it cannot later be passed where a decimal
   * amount belongs. ARCHITECTURE.md §7 names that confusion as the most likely
   * silent bug in this integration.
   */
  async quoteMarketCreation(
    request: CreateMarketQuoteRequest,
  ): Promise<{ feeBaseUnits: BaseUnits; raw: CreateMarketQuoteResponse }> {
    const res = await this.http.post(
      PATHS.createQuote,
      request,
      CreateMarketQuoteResponse,
      { retryable: true }, // a quote has no side effect
    );
    const fee = res.fee ?? res.creationFee ?? res.creation_fee;
    if (fee === undefined) {
      throw new Error(
        `Panta creation quote returned no fee. Keys present: ${Object.keys(res).join(", ")}`,
      );
    }
    return { feeBaseUnits: parseBaseUnits(fee), raw: res };
  }

  /** Build the unsigned creation transaction. Signing happens locally, never here. */
  async buildMarketCreation(request: CreateMarketQuoteRequest & Record<string, unknown>) {
    const res = await this.http.post(
      PATHS.createBuild,
      request,
      UnsignedTransactionResponse,
      { retryable: true }, // building is pure; only broadcasting spends
    );
    return transactionOf(res, "market creation");
  }

  /**
   * Register a broadcast creation.
   *
   * Retryable on purpose: the signature makes it idempotent upstream, and a
   * created-but-unregistered market is worse than a duplicate request.
   */
  registerMarket(signature: string, extra: Record<string, unknown> = {}) {
    return this.http.post(
      PATHS.createRegister,
      { signature, ...extra },
      RegisterMarketResponse,
      { retryable: true },
    );
  }

  // ── Trading ───────────────────────────────────────────────────────────────

  /** Quote a fill. `amount` is a decimal string — the primary-buy encoding. */
  quoteOrder(marketId: string | number, side: Side, amount: DecimalAmount) {
    return this.http.post(
      PATHS.orderQuote,
      { marketId, side, amount },
      OrderQuoteResponse,
      { retryable: true },
    );
  }

  async buildOrder(marketId: string | number, side: Side, amount: DecimalAmount) {
    const res = await this.http.post(
      PATHS.orderBuild,
      { marketId, side, amount },
      UnsignedTransactionResponse,
      { retryable: true },
    );
    return transactionOf(res, "order");
  }

  /**
   * Submit a broadcast trade.
   *
   * NOT retryable. Every other write here is either pure or idempotent by
   * signature; this one moves USDC, and a blind replay could spend twice.
   * A failure surfaces to the caller to decide.
   */
  submitOrder(signature: string, extra: Record<string, unknown> = {}) {
    return this.http.post(PATHS.orderSubmit, { signature, ...extra }, undefined, {
      retryable: false,
    });
  }

  // ── Positions and claims ──────────────────────────────────────────────────

  getPositions(wallet: string): Promise<PositionList> {
    return this.http.get(PATHS.positions, PositionList, { wallet });
  }

  async buildClaim(marketId: string | number, wallet: string) {
    const res = await this.http.post(
      PATHS.claimBuild,
      { marketId, wallet },
      UnsignedTransactionResponse,
      { retryable: true },
    );
    return transactionOf(res, "claim");
  }

  /** Our revenue line, claimed on chain. */
  async buildCreatorFeesClaim(wallet: string) {
    const res = await this.http.post(
      PATHS.creatorFeesBuild,
      { wallet },
      UnsignedTransactionResponse,
      { retryable: true },
    );
    return transactionOf(res, "creator fees claim");
  }

  // ── Attribution ───────────────────────────────────────────────────────────

  /**
   * Report a trade so it counts as ours.
   *
   * Must be wired from the FIRST trade — attribution cannot be backfilled, and
   * the history it produces is our primary metric (PRD.md §4). Retryable
   * because reporting the same signature twice is a no-op upstream, whereas
   * losing a report loses traction evidence permanently.
   */
  reportTrade(signature: string, extra: Record<string, unknown> = {}) {
    this.logger?.info("reporting trade for attribution", { signature });
    return this.http.post(
      PATHS.trades,
      { signature, ...extra },
      TradeReportResponse,
      { retryable: true },
    );
  }

  /** The only acceptable source for a published volume figure (PRD.md X4). */
  getTrade(signature: string): Promise<TradeReportResponse> {
    return this.http.get(PATHS.trade(signature), TradeReportResponse);
  }
}

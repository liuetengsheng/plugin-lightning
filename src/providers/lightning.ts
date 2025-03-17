import {
    type IAgentRuntime,
    type Provider,
    type Memory,
    type State,
    elizaLogger,
  } from "@elizaos/core";
  import {
    authenticatedLndGrpc,
    type AuthenticatedLnd,
    type GetIdentityResult,
    type GetChannelsResult,
    getIdentity,
    getChannels,
    createInvoice,
    pay,
    type PayResult,
    type CreateInvoiceResult,
    closeChannel,
    type CloseChannelResult,
    openChannel,
    type OpenChannelResult,
    getChainAddresses,
    type GetChainAddressesResult,
    createChainAddress,
    type CreateChainAddressResult,
    getChainBalance,
    type GetChainBalanceResult,
  } from "astra-lightning";
  import type {
    PayArgs,
    CreateInvoiceArgs,
    GetChannelsArgs,
    CloseChannelArgs,
    OpenChannelArgs,
    CreateChainAddressArgs,
  } from "../types";
  
  export class LightningProvider {
    private lndClient: AuthenticatedLnd;
  
    constructor(cert: string, macaroon: string, socket: string) {
      if (!cert || !macaroon || !socket) {
        throw new Error("Missing required LND credentials");
      }
      try {
        elizaLogger.info(
          `Initializing LND client with cert, macaroon and socket: ${socket}`
        );
        const { lnd } = authenticatedLndGrpc({
          cert: cert,
          macaroon: macaroon,
          socket: socket,
        });
        this.lndClient = lnd;
        elizaLogger.info("LND client initialized successfully");
      } catch (error: any) {
        elizaLogger.error(
          `Failed to initialize LND client: ${error.message}`,
          error
        );
        throw new Error(`Failed to initialize LND client: ${error.message}`);
      }
    }
  
    async getLndIdentity(): Promise<GetIdentityResult> {
      try {
        elizaLogger.info(`getLndIdentity called`);
        const result = await getIdentity({ lnd: this.lndClient });
        elizaLogger.info(`getLndIdentity result: ${JSON.stringify(result)}`);
        return result;
      } catch (error: any) {
        elizaLogger.error(
          `Error in getLndIdentity handler: ${error.message}`,
          error
        );
        throw new Error(`Failed to get LND identity: ${error.message}`);
      }
    }
  
    async getLndChannel(args: GetChannelsArgs = {}): Promise<GetChannelsResult> {
      try {
        elizaLogger.info(`getLndChannel called with args: ${JSON.stringify(args)}`);
        const result = await getChannels({
          lnd: this.lndClient,
          is_active: args.is_active,
          is_offline: args.is_offline,
          is_private: args.is_private,
          is_public: args.is_public,
          partner_public_key: args.partner_public_key,
        });
        elizaLogger.info(`getLndChannel result: ${JSON.stringify(result)}`);
        return result;
      } catch (error: any) {
        elizaLogger.error(
          `Error in getLndChannel handler: ${error.message}`,
          error
        );
        throw new Error(`Failed to get LND channels: ${error.message}`);
      }
    }
  
    async createInvoice(createInvoiceArgs: CreateInvoiceArgs): Promise<CreateInvoiceResult> {
      try {
        elizaLogger.info(
          `createInvoice called with args: ${JSON.stringify(createInvoiceArgs)}`
        );
        const result = await createInvoice({
          lnd: this.lndClient,
          ...createInvoiceArgs,
        });
        elizaLogger.info(`createInvoice result: ${JSON.stringify(result)}`);
        return result;
      } catch (error: any) {
        elizaLogger.error(
          `Error in createInvoice handler: ${error.message}`,
          error
        );
        throw new Error(`Failed to create invoice: ${error.message}`);
      }
    }
  
    async payInvoice(payInvoiceArgs: PayArgs): Promise<PayResult> {
      try {
        elizaLogger.info(`payInvoice called with args: ${JSON.stringify(payInvoiceArgs)}`);
        const result = await pay({
          lnd: this.lndClient,
          ...payInvoiceArgs,
        });
        elizaLogger.info(`payInvoice result: ${JSON.stringify(result)}`);
        return result;
      } catch (error: any) {
        elizaLogger.error(`Error in payInvoice handler: ${error.message}`, error);
        throw new Error(`Failed to pay invoice: ${error.message}`);
      }
    }
  
    async closeChannel(args: CloseChannelArgs): Promise<CloseChannelResult> {
      try {
        elizaLogger.info(`closeChannel called with args: ${JSON.stringify(args)}`);
        if (!args.id && !(args.transaction_id && args.transaction_vout)) {
          throw new Error(
            "Either channel id or transaction details (id and vout) are required"
          );
        }
  
        // 构造基础参数
        const baseArgs = {
          lnd: this.lndClient,
          ...(args.id ? { id: args.id } : {}),
          ...(args.transaction_id && args.transaction_vout
            ? {
                transaction_id: args.transaction_id,
                transaction_vout: args.transaction_vout,
              }
            : {}),
        };
  
        let result: CloseChannelResult;
        if (args.is_force_close) {
          // 强制关闭：移除协作关闭相关的参数（如 address、public_key、socket）
          const forceCloseArgs = {
            ...baseArgs,
            is_force_close: true,
            ...(args.max_tokens_per_vbyte ? { max_tokens_per_vbyte: args.max_tokens_per_vbyte } : {}),
            ...(args.tokens_per_vbyte ? { tokens_per_vbyte: args.tokens_per_vbyte } : {}),
            ...(args.target_confirmations ? { target_confirmations: args.target_confirmations } : {}),
          };
          Object.keys(forceCloseArgs).forEach((key) => {
            if (forceCloseArgs[key] === undefined) delete forceCloseArgs[key];
          });
          elizaLogger.info(`closeChannel forceCloseArgs: ${JSON.stringify(forceCloseArgs)}`);
          result = await closeChannel(forceCloseArgs as any);
        } else {
          // 协作关闭：保留 address、public_key、socket 等协作关闭参数
          const coopCloseArgs = {
            ...baseArgs,
            is_force_close: false,
            ...(args.is_graceful_close ? { is_graceful_close: true } : {}),
            ...(args.address ? { address: args.address } : {}),
            ...(args.max_tokens_per_vbyte ? { max_tokens_per_vbyte: args.max_tokens_per_vbyte } : {}),
            ...(args.tokens_per_vbyte ? { tokens_per_vbyte: args.tokens_per_vbyte } : {}),
            ...(args.target_confirmations ? { target_confirmations: args.target_confirmations } : {}),
            ...(args.public_key ? { public_key: args.public_key } : {}),
            ...(args.socket ? { socket: args.socket } : {}),
          };
          Object.keys(coopCloseArgs).forEach((key) => {
            if (coopCloseArgs[key] === undefined) delete coopCloseArgs[key];
          });
          elizaLogger.info(`closeChannel coopCloseArgs: ${JSON.stringify(coopCloseArgs)}`);
          result = await closeChannel(coopCloseArgs as any);
        }
        elizaLogger.info(`closeChannel result: ${JSON.stringify(result)}`);
        return result;
      } catch (error: any) {
        elizaLogger.error(`Error in closeChannel handler: ${error.message}`, error);
        throw new Error(`Failed to close channel: ${error.message}`);
      }
    }
  
    async getChainAddresses(): Promise<GetChainAddressesResult> {
      try {
        elizaLogger.info(`getChainAddresses called`);
        const result = await getChainAddresses({ lnd: this.lndClient });
        elizaLogger.info(`getChainAddresses result: ${JSON.stringify(result)}`);
        return result;
      } catch (error: any) {
        elizaLogger.error(
          `Error in getChainAddresses handler: ${error.message}`,
          error
        );
        throw new Error(`Failed to get chain addresses: ${error.message}`);
      }
    }
  
    async openChannel(args: OpenChannelArgs): Promise<OpenChannelResult> {
      try {
        elizaLogger.info(`openChannel called with args: ${JSON.stringify(args)}`);
        if (!args.local_tokens || !args.partner_public_key) {
          throw new Error("local_tokens and partner_public_key are required");
        }
        if (!args.cooperative_close_address) {
          const { addresses } = await this.getChainAddresses();
          const mainAddress = addresses.find((addr) => !addr.is_change);
          if (mainAddress) {
            args.cooperative_close_address = mainAddress.address;
          }
        }
        const result = await openChannel({
          lnd: this.lndClient,
          ...args,
        });
        elizaLogger.info(`openChannel result: ${JSON.stringify(result)}`);
        return result;
      } catch (error: any) {
        elizaLogger.error(`Error in openChannel handler: ${error.message}`, error);
        throw new Error(`Failed to open channel: ${error.message}`);
      }
    }
  
    async createChainAddress(args: CreateChainAddressArgs = {}): Promise<CreateChainAddressResult> {
      try {
        elizaLogger.info(`createChainAddress called with args: ${JSON.stringify(args)}`);
        // 默认使用 p2wpkh 格式
        const format = args.format || "p2wpkh";
        const result = await createChainAddress({
          lnd: this.lndClient,
          format,
          is_unused: args.is_unused,
        });
        elizaLogger.info(`createChainAddress result: ${JSON.stringify(result)}`);
        return result;
      } catch (error: any) {
        elizaLogger.error(`Error in createChainAddress handler: ${error.message}`, error);
        throw new Error(`Failed to create chain address: ${error.message}`);
      }
    }
  
    async getChainBalance(): Promise<GetChainBalanceResult> {
      try {
        elizaLogger.info(`getChainBalance called`);
        const result = await getChainBalance({ lnd: this.lndClient });
        elizaLogger.info(`getChainBalance result: ${JSON.stringify(result)}`);
        return result;
      } catch (error: any) {
        elizaLogger.error(`Error in getChainBalance handler: ${error.message}`, error);
        throw new Error(`Failed to get chain balance: ${error.message}`);
      }
    }
  }
  
  export const initLightningProvider = async (runtime: IAgentRuntime) => {
    try {
      elizaLogger.info(`Initializing LightningProvider`);
      const cert = runtime.getSetting("LND_TLS_CERT");
      const macaroon = runtime.getSetting("LND_MACAROON");
      const socket = runtime.getSetting("LND_SOCKET");
      const provider = new LightningProvider(cert, macaroon, socket);
      elizaLogger.info(`LightningProvider initialized successfully`);
      return provider;
    } catch (error: any) {
      elizaLogger.error(`Error initializing LightningProvider: ${error.message}`, error);
      throw error;
    }
  };
  
  export const lndProvider: Provider = {
    async get(runtime: IAgentRuntime, _message: Memory, state?: State): Promise<string | null> {
      try {
        elizaLogger.info("lndProvider.get called");
        const lightningProvider = await initLightningProvider(runtime);
        const { public_key: nodePubkey } = await lightningProvider.getLndIdentity();
        const { channels } = await lightningProvider.getLndChannel();
        const agentName = state?.agentName || "The agent";
        const result = `${agentName}'s Lightning Node publickey: ${nodePubkey}\nChannel count: ${channels.length}`;
        elizaLogger.info(`lndProvider.get result: ${result}`);
        return result;
      } catch (error: any) {
        elizaLogger.error(`Error in Lightning provider: ${error.message}`, error);
        return null;
      }
    },
  };
  
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
import type { PayArgs, CreateInvoiceArgs, GetChannelsArgs, CloseChannelArgs, OpenChannelArgs, CreateChainAddressArgs } from "../types";

export class LightningProvider {
    private lndClient: AuthenticatedLnd;
    
    constructor(cert: string, macaroon: string, socket: string) {
        if (!cert || !macaroon || !socket) {
            elizaLogger.error("Missing required LND credentials", {
                hasCert: !!cert,
                hasMacaroon: !!macaroon,
                hasSocket: !!socket
            });
            throw new Error("Missing required LND credentials");
        }
        try {
            elizaLogger.log("Initializing LND client with credentials");
            const { lnd } = authenticatedLndGrpc({
                cert: cert,
                macaroon: macaroon,
                socket: socket,
            });
            this.lndClient = lnd;
            elizaLogger.log("LND client initialized successfully");
        } catch (error) {
            elizaLogger.error("Failed to initialize LND client:", {
                error: error.message,
                stack: error.stack
            });
            throw new Error(
                `Failed to initialize LND client: ${error.message}`,
            );
        }
    }

    async getLndIdentity(): Promise<GetIdentityResult> {
        elizaLogger.log("Getting LND identity");
        try {
            const result = await getIdentity({ lnd: this.lndClient });
            elizaLogger.log("LND identity retrieved successfully:", {
                public_key: result.public_key
            });
            return result;
        } catch (error) {
            elizaLogger.error("Failed to get LND identity:", {
                error: error.message,
                stack: error.stack
            });
            throw new Error(`Failed to get LND identity: ${error.message}`);
        }
    }

    // 更新 getLndChannel 方法以支持过滤参数
    async getLndChannel(args: GetChannelsArgs = {}): Promise<GetChannelsResult> {
        elizaLogger.log("Getting LND channels with args:", args);
        try {
            const result = await getChannels({ 
                lnd: this.lndClient,
                is_active: args.is_active,
                is_offline: args.is_offline,
                is_private: args.is_private,
                is_public: args.is_public,
                partner_public_key: args.partner_public_key
            });
            elizaLogger.log("LND channels retrieved successfully:", {
                totalChannels: result.channels.length,
                activeChannels: result.channels.filter(c => c.is_active).length,
                privateChannels: result.channels.filter(c => c.is_private).length
            });
            return result;
        } catch (error) {
            elizaLogger.error("Failed to get LND channels:", {
                error: error.message,
                stack: error.stack,
                args
            });
            throw new Error(`Failed to get LND channels: ${error.message}`);
        }
    }

    async createInvoice(
        createInvoiceArgs: CreateInvoiceArgs,
    ): Promise<CreateInvoiceResult> {
        elizaLogger.log("Creating invoice with args:", createInvoiceArgs);
        try {
            const result = await createInvoice({
                lnd: this.lndClient,
                ...createInvoiceArgs,
            });
            elizaLogger.log("Invoice created successfully:", {
                id: result.id,
                request: result.request,
                tokens: result.tokens
            });
            return result;
        } catch (error) {
            elizaLogger.error("Failed to create invoice:", {
                error: error.message,
                stack: error.stack,
                args: createInvoiceArgs
            });
            throw new Error(`Failed to create invoice: ${error.message}`);
        }
    }

    async payInvoice(payInvoiceArgs: PayArgs): Promise<PayResult> {
        elizaLogger.log("Paying invoice with args:", {
            request: payInvoiceArgs.request,
            outgoing_channel: payInvoiceArgs.outgoing_channel,
            tokens: payInvoiceArgs.tokens
        });
        try {
            const result = await pay({
                lnd: this.lndClient,
                ...payInvoiceArgs,
            });
            elizaLogger.log("Invoice paid successfully:", {
                id: result.id,
                is_confirmed: result.is_confirmed,
                tokens: result.tokens,
                fee: result.fee
            });
            return result;
        } catch (error) {
            elizaLogger.error("Failed to pay invoice:", {
                error: error.message,
                stack: error.stack,
                args: payInvoiceArgs
            });
            throw error;
        }
    }

    async closeChannel(args: CloseChannelArgs): Promise<CloseChannelResult> {
        elizaLogger.log("Closing channel with args:", args);
        try {
            if (!args.id && !(args.transaction_id && args.transaction_vout)) {
                elizaLogger.error("Validation failed: Missing required parameters", {
                    hasId: !!args.id,
                    hasTransactionId: !!args.transaction_id,
                    hasTransactionVout: !!args.transaction_vout
                });
                throw new Error("Either channel id or transaction details (id and vout) are required");
            }

            // 构造基础参数
            const baseArgs = {
                lnd: this.lndClient,
                ...(args.id ? { id: args.id } : {}),
                ...(args.transaction_id && args.transaction_vout ? {
                    transaction_id: args.transaction_id,
                    transaction_vout: args.transaction_vout
                } : {})
            };

            let closeArgs;
            if (args.is_force_close) {
                elizaLogger.log("Performing force close");
                // 强制关闭参数
                closeArgs = {
                    ...baseArgs,
                    is_force_close: true as const,
                    // 强制关闭不需要其他参数
                };
            } else {
                elizaLogger.log("Performing cooperative close");
                // 协作关闭参数
                closeArgs = {
                    ...baseArgs,
                    is_force_close: false as const,
                    address: args.address,
                    target_confirmations: args.target_confirmations,
                    tokens_per_vbyte: args.tokens_per_vbyte
                };
            }

            const result = await closeChannel(closeArgs);
            elizaLogger.log("Channel closed successfully:", {
                transaction_id: result.transaction_id,
                transaction_vout: result.transaction_vout,
                is_force_close: args.is_force_close
            });
            return result;
        } catch (error) {
            elizaLogger.error("Failed to close channel:", {
                error: error.message,
                stack: error.stack,
                args
            });
            throw new Error(`Failed to close channel: ${error.message}`);
        }
    }
      

    async getChainAddresses(): Promise<GetChainAddressesResult> {
        elizaLogger.log("Getting chain addresses");
        try {
            const result = await getChainAddresses({
                lnd: this.lndClient
            });
            elizaLogger.log("Chain addresses retrieved successfully:", {
                totalAddresses: result.addresses.length,
                changeAddresses: result.addresses.filter(addr => addr.is_change).length
            });
            return result;
        } catch (error) {
            elizaLogger.error("Failed to get chain addresses:", {
                error: error.message,
                stack: error.stack
            });
            throw new Error(`Failed to get chain addresses: ${error.message}`);
        }
    }

    async openChannel(args: OpenChannelArgs): Promise<OpenChannelResult> {
        elizaLogger.log("Opening channel with args:", {
            local_tokens: args.local_tokens,
            partner_public_key: args.partner_public_key,
            is_private: args.is_private,
            description: args.description
        });
        try {
            if (!args.local_tokens || !args.partner_public_key) {
                elizaLogger.error("Validation failed: Missing required parameters", {
                    hasLocalTokens: !!args.local_tokens,
                    hasPartnerPublicKey: !!args.partner_public_key
                });
                throw new Error("local_tokens and partner_public_key are required");
            }

            // 如果没有提供地址，尝试获取一个
            if (!args.cooperative_close_address) {
                elizaLogger.log("No cooperative close address provided, fetching one");
                const { addresses } = await this.getChainAddresses();
                // 优先使用非找零地址
                const mainAddress = addresses.find(addr => !addr.is_change);
                if (mainAddress) {
                    args.cooperative_close_address = mainAddress.address;
                    elizaLogger.log("Using fetched cooperative close address:", {
                        address: args.cooperative_close_address
                    });
                }
            }
            
            const result = await openChannel({
                lnd: this.lndClient,
                ...args
            });
            elizaLogger.log("Channel opened successfully:", {
                transaction_id: result.transaction_id,
                transaction_vout: result.transaction_vout
            });
            return result;
        } catch (error) {
            elizaLogger.error("Failed to open channel:", {
                error: error.message,
                stack: error.stack,
                args
            });
            throw new Error(`Failed to open channel: ${error.message}`);
        }
    }

    async createChainAddress(args: CreateChainAddressArgs = {}): Promise<CreateChainAddressResult> {
        elizaLogger.log("Creating chain address with args:", {
            format: args.format || "p2wpkh",
            is_unused: args.is_unused
        });
        try {
            // 默认使用 p2wpkh 格式
            const format = args.format || "p2wpkh";
            
            const result = await createChainAddress({
                lnd: this.lndClient,
                format,
                is_unused: args.is_unused
            });
            elizaLogger.log("Chain address created successfully:", {
                address: result.address,
                format
            });
            return result;
        } catch (error) {
            elizaLogger.error("Failed to create chain address:", {
                error: error.message,
                stack: error.stack,
                args
            });
            throw new Error(`Failed to create chain address: ${error.message}`);
        }
    }

    async getChainBalance(): Promise<GetChainBalanceResult> {
        elizaLogger.log("Getting chain balance");
        try {
            const result = await getChainBalance({
                lnd: this.lndClient
            });
            elizaLogger.log("Chain balance retrieved successfully:", {
                chain_balance: result.chain_balance
            });
            return result;
        } catch (error) {
            elizaLogger.error("Failed to get chain balance:", {
                error: error.message,
                stack: error.stack
            });
            throw new Error(`Failed to get chain balance: ${error.message}`);
        }
    }
}

export const initLightningProvider = async (runtime: IAgentRuntime) => {
    elizaLogger.log("Initializing LightningProvider");
    const cert = runtime.getSetting("LND_TLS_CERT");
    const macaroon = runtime.getSetting("LND_MACAROON");
    const socket = runtime.getSetting("LND_SOCKET");
    elizaLogger.log("Retrieved LND credentials:", {
        hasCert: !!cert,
        hasMacaroon: !!macaroon,
        hasSocket: !!socket
    });
    return new LightningProvider(cert, macaroon, socket);
};

export const lndProvider: Provider = {
    async get(
        runtime: IAgentRuntime,
        _message: Memory,
        state?: State,
    ): Promise<string | null> {
        elizaLogger.log("LND provider get called with params:", {
            message: _message,
            state,
            hasState: !!state
        });
        try {
            const lightningProvider = await initLightningProvider(runtime);
            elizaLogger.log("LightningProvider initialized successfully");
            
            const { public_key: nodePubkey } = await lightningProvider.getLndIdentity();
            elizaLogger.log("Retrieved node public key:", { nodePubkey });
            
            const { channels } = await lightningProvider.getLndChannel();
            elizaLogger.log("Retrieved channels:", {
                totalChannels: channels.length,
                activeChannels: channels.filter(c => c.is_active).length
            });
            
            const agentName = state?.agentName || "The agent";
            const response = `${agentName}'s Lightning Node publickey: ${nodePubkey}\nChannel count: ${channels.length}`;
            elizaLogger.log("Generated provider response:", { response });
            return response;
        } catch (error) {
            elizaLogger.error("Error in Lightning provider:", {
                error: error.message,
                stack: error.stack,
                message: _message,
                state
            });
            return null;
        }
    },
};

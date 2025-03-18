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
            elizaLogger.error("Missing required LND credentials");
            throw new Error("Missing required LND credentials");
        }
        try {
            const { lnd } = authenticatedLndGrpc({
                cert: cert,
                macaroon: macaroon,
                socket: socket,
            });
            this.lndClient = lnd;
            elizaLogger.info("LND client initialized");
        } catch (error) {
            elizaLogger.error("LND client initialization failed:", error);
            throw error;
        }
    }

    async getLndIdentity(): Promise<GetIdentityResult> {
        try {
            const result = await getIdentity({ lnd: this.lndClient });
            elizaLogger.info("Node identity:", { public_key: result.public_key });
            return result;
        } catch (error) {
            elizaLogger.error("Get identity failed:", error);
            throw error;
        }
    }

    async getLndChannel(args: GetChannelsArgs = {}): Promise<GetChannelsResult> {
        try {
            const result = await getChannels({ 
                lnd: this.lndClient,
                ...args
            });
            elizaLogger.info("Channels status:", {
                total: result.channels.length,
                active: result.channels.filter(c => c.is_active).length
            });
            return result;
        } catch (error) {
            elizaLogger.error("Get channels failed:", error);
            throw error;
        }
    }

    async createInvoice(createInvoiceArgs: CreateInvoiceArgs): Promise<CreateInvoiceResult> {
        try {
            const result = await createInvoice({
                lnd: this.lndClient,
                ...createInvoiceArgs,
            });
            elizaLogger.info("Invoice created:", { tokens: result.tokens });
            return result;
        } catch (error) {
            elizaLogger.error("Create invoice failed:", error);
            throw error;
        }
    }

    async payInvoice(payInvoiceArgs: PayArgs): Promise<PayResult> {
        try {
            const result = await pay({
                lnd: this.lndClient,
                ...payInvoiceArgs,
            });
            elizaLogger.info("Payment completed:", {
                tokens: result.tokens,
                fee: result.fee
            });
            return result;
        } catch (error) {
            elizaLogger.error("Payment failed:", error);
            throw error;
        }
    }

    async closeChannel(args: CloseChannelArgs): Promise<CloseChannelResult> {
        try {
            if (!args.id && !(args.transaction_id && args.transaction_vout)) {
                throw new Error("Either channel id or transaction details are required");
            }

            // 记录操作信息
            elizaLogger.info("Closing channel:", { 
                type: args.is_force_close ? "force" : "cooperative",
                id: args.id || `${args.transaction_id}:${args.transaction_vout}`
            });

            // 强制关闭的参数
            if (args.is_force_close) {
                const forceCloseArgs = {
                    lnd: this.lndClient,
                    is_force_close: true as const,
                    ...(args.id ? { id: args.id } : {
                        transaction_id: args.transaction_id!,
                        transaction_vout: args.transaction_vout!
                    })
                };
                const result = await closeChannel(forceCloseArgs);
                elizaLogger.info("Channel force closed:", { transaction_id: result.transaction_id });
                return result;
            } 
            
            // 协作关闭的参数
            else {
                const coopCloseArgs = {
                    lnd: this.lndClient,
                    is_force_close: false as const,
                    ...(args.id ? { id: args.id } : {
                        transaction_id: args.transaction_id!,
                        transaction_vout: args.transaction_vout!
                    }),
                    ...(args.address ? { address: args.address } : {}),
                    ...(args.target_confirmations ? { target_confirmations: args.target_confirmations } : {}),
                    ...(args.tokens_per_vbyte ? { tokens_per_vbyte: args.tokens_per_vbyte } : {})
                };
                const result = await closeChannel(coopCloseArgs);
                elizaLogger.info("Channel cooperatively closed:", { transaction_id: result.transaction_id });
                return result;
            }
        } catch (error) {
            elizaLogger.error("Close channel failed:", error);
            throw error;
        }
    }

    async getChainAddresses(): Promise<GetChainAddressesResult> {
        try {
            const result = await getChainAddresses({
                lnd: this.lndClient
            });
            elizaLogger.info("Chain addresses:", {
                total: result.addresses.length,
                change: result.addresses.filter(addr => addr.is_change).length
            });
            return result;
        } catch (error) {
            elizaLogger.error("Get chain addresses failed:", error);
            throw error;
        }
    }

    async openChannel(args: OpenChannelArgs): Promise<OpenChannelResult> {
        try {
            if (!args.local_tokens || !args.partner_public_key) {
                throw new Error("local_tokens and partner_public_key are required");
            }

            if (!args.cooperative_close_address) {
                const { addresses } = await this.getChainAddresses();
                const mainAddress = addresses.find(addr => !addr.is_change);
                if (mainAddress) {
                    args.cooperative_close_address = mainAddress.address;
                }
            }
            
            elizaLogger.info("Opening channel:", {
                tokens: args.local_tokens,
                partner: args.partner_public_key,
                is_private: args.is_private
            });

            const result = await openChannel({
                lnd: this.lndClient,
                ...args
            });
            elizaLogger.info("Channel opened:", { transaction_id: result.transaction_id });
            return result;
        } catch (error) {
            elizaLogger.error("Open channel failed:", error);
            throw error;
        }
    }

    async createChainAddress(args: CreateChainAddressArgs = {}): Promise<CreateChainAddressResult> {
        try {
            const format = args.format || "p2wpkh";
            const result = await createChainAddress({
                lnd: this.lndClient,
                format,
                is_unused: args.is_unused
            });
            elizaLogger.info("Chain address created:", { format });
            return result;
        } catch (error) {
            elizaLogger.error("Create chain address failed:", error);
            throw error;
        }
    }

    async getChainBalance(): Promise<GetChainBalanceResult> {
        try {
            const result = await getChainBalance({
                lnd: this.lndClient
            });
            elizaLogger.info("Chain balance:", { balance: result.chain_balance });
            return result;
        } catch (error) {
            elizaLogger.error("Get chain balance failed:", error);
            throw error;
        }
    }
}

export const initLightningProvider = async (runtime: IAgentRuntime) => {
    const cert = runtime.getSetting("LND_TLS_CERT");
    const macaroon = runtime.getSetting("LND_MACAROON");
    const socket = runtime.getSetting("LND_SOCKET");
    return new LightningProvider(cert, macaroon, socket);
};

export const lndProvider: Provider = {
    async get(
        runtime: IAgentRuntime,
        _message: Memory,
        state?: State,
    ): Promise<string | null> {
        try {
            const lightningProvider = await initLightningProvider(runtime);
            const { public_key: nodePubkey } = await lightningProvider.getLndIdentity();
            const { channels } = await lightningProvider.getLndChannel();
            
            const agentName = state?.agentName || "The agent";
            return `${agentName}'s Lightning Node publickey: ${nodePubkey}\nChannel count: ${channels.length}`;
        } catch (error) {
            elizaLogger.error("Provider get failed:", error);
            return null;
        }
    },
};

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
        } catch (error) {
            elizaLogger.error("LND client initialization failed:", {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    async getLndIdentity(): Promise<GetIdentityResult> {
        try {
            const result = await getIdentity({ lnd: this.lndClient });
            elizaLogger.info("Node identity retrieved:", { public_key: result.public_key });
            return result;
        } catch (error) {
            elizaLogger.error("Get identity failed:", {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    async getLndChannel(args: GetChannelsArgs = {}): Promise<GetChannelsResult> {
        try {
            const result = await getChannels({ 
                lnd: this.lndClient,
                ...args
            });
            elizaLogger.info("Channels retrieved:", {
                total: result.channels.length,
                active: result.channels.filter(c => c.is_active).length
            });
            return result;
        } catch (error) {
            elizaLogger.error("Get channels failed:", {
                error: error.message,
                stack: error.stack,
                args
            });
            throw error;
        }
    }

    async createInvoice(createInvoiceArgs: CreateInvoiceArgs): Promise<CreateInvoiceResult> {
        try {
            const result = await createInvoice({
                lnd: this.lndClient,
                ...createInvoiceArgs,
            });
            elizaLogger.info("Invoice created:", {
                tokens: result.tokens,
                id: result.id
            });
            return result;
        } catch (error) {
            elizaLogger.error("Create invoice failed:", {
                error: error.message,
                stack: error.stack,
                args: createInvoiceArgs
            });
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
                fee: result.fee,
                id: result.id
            });
            return result;
        } catch (error) {
            elizaLogger.error("Payment failed:", {
                error: error.message,
                stack: error.stack,
                args: payInvoiceArgs
            });
            throw error;
        }
    }

    async closeChannel(args: CloseChannelArgs): Promise<CloseChannelResult> {
        try {
            if (!args.id && !(args.transaction_id && args.transaction_vout)) {
                elizaLogger.error("Missing required parameters for channel close", {
                    id: args.id,
                    transaction_id: args.transaction_id,
                    transaction_vout: args.transaction_vout
                });
                throw new Error("Either channel id or transaction details are required");
            }

            const result = await closeChannel({
                lnd: this.lndClient,
                ...args
            });

            elizaLogger.info("Channel closed:", {
                transaction_id: result.transaction_id,
                type: args.is_force_close ? "force" : "cooperative"
            });
            return result;
        } catch (error) {
            elizaLogger.error("Close channel failed:", {
                error: error.message,
                stack: error.stack,
                args
            });
            throw error;
        }
    }
      
    async getChainAddresses(): Promise<GetChainAddressesResult> {
        try {
            const result = await getChainAddresses({
                lnd: this.lndClient
            });
            elizaLogger.info("Chain addresses retrieved:", {
                total: result.addresses.length,
                change: result.addresses.filter(addr => addr.is_change).length
            });
            return result;
        } catch (error) {
            elizaLogger.error("Get chain addresses failed:", {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    async openChannel(args: OpenChannelArgs): Promise<OpenChannelResult> {
        try {
            if (!args.local_tokens || !args.partner_public_key) {
                elizaLogger.error("Missing required parameters for channel open", {
                    local_tokens: args.local_tokens,
                    partner_public_key: args.partner_public_key
                });
                throw new Error("local_tokens and partner_public_key are required");
            }

            if (!args.cooperative_close_address) {
                const { addresses } = await this.getChainAddresses();
                const mainAddress = addresses.find(addr => !addr.is_change);
                if (mainAddress) {
                    args.cooperative_close_address = mainAddress.address;
                }
            }
            
            const result = await openChannel({
                lnd: this.lndClient,
                ...args
            });

            elizaLogger.info("Channel opened:", {
                transaction_id: result.transaction_id,
                local_tokens: args.local_tokens,
                partner_public_key: args.partner_public_key
            });
            return result;
        } catch (error) {
            elizaLogger.error("Open channel failed:", {
                error: error.message,
                stack: error.stack,
                args
            });
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
            elizaLogger.info("Chain address created:", {
                address: result.address,
                format
            });
            return result;
        } catch (error) {
            elizaLogger.error("Create chain address failed:", {
                error: error.message,
                stack: error.stack,
                args
            });
            throw error;
        }
    }

    async getChainBalance(): Promise<GetChainBalanceResult> {
        try {
            const result = await getChainBalance({
                lnd: this.lndClient
            });
            elizaLogger.info("Chain balance retrieved:", {
                balance: result.chain_balance
            });
            return result;
        } catch (error) {
            elizaLogger.error("Get chain balance failed:", {
                error: error.message,
                stack: error.stack
            });
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

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
            throw new Error(
                `Failed to initialize LND client: ${error.message}`,
            );
        }
    }

    async getLndIdentity(): Promise<GetIdentityResult> {
        try {
            return await getIdentity({ lnd: this.lndClient });
        } catch (error) {
            throw new Error(`Failed to get LND identity: ${error.message}`);
        }
    }

    // 更新 getLndChannel 方法以支持过滤参数
    async getLndChannel(args: GetChannelsArgs = {}): Promise<GetChannelsResult> {
        try {
            return await getChannels({ 
                lnd: this.lndClient,
                is_active: args.is_active,
                is_offline: args.is_offline,
                is_private: args.is_private,
                is_public: args.is_public,
                partner_public_key: args.partner_public_key
            });
        } catch (error) {
            throw new Error(`Failed to get LND channels: ${error.message}`);
        }
    }

    async createInvoice(
        createInvoiceArgs: CreateInvoiceArgs,
    ): Promise<CreateInvoiceResult> {
        try {
            return await createInvoice({
                lnd: this.lndClient,
                ...createInvoiceArgs,
            });
        } catch (error) {
            throw new Error(`Failed to create invoice: ${error.message}`);
        }
    }

    async payInvoice(payInvoiceArgs: PayArgs): Promise<PayResult> {
        const ret = await pay({
            lnd: this.lndClient,
            ...payInvoiceArgs,
        });
        return ret;
    }

    async closeChannel(args: CloseChannelArgs): Promise<CloseChannelResult> {
        try {
            if (!args.id && !(args.transaction_id && args.transaction_vout)) {
                throw new Error("Either channel id or transaction details (id and vout) are required");
            }
            
            const result = await closeChannel({
                lnd: this.lndClient,
                ...args
            });
            return result;
        } catch (error) {
            throw new Error(`Failed to close channel: ${error.message}`);
        }
    }

    async getChainAddresses(): Promise<GetChainAddressesResult> {
        try {
            return await getChainAddresses({
                lnd: this.lndClient
            });
        } catch (error) {
            throw new Error(`Failed to get chain addresses: ${error.message}`);
        }
    }

    async openChannel(args: OpenChannelArgs): Promise<OpenChannelResult> {
        try {
            if (!args.local_tokens || !args.partner_public_key) {
                throw new Error("local_tokens and partner_public_key are required");
            }

            // 如果没有提供地址，尝试获取一个
            if (!args.cooperative_close_address) {
                const { addresses } = await this.getChainAddresses();
                // 优先使用非找零地址
                const mainAddress = addresses.find(addr => !addr.is_change);
                if (mainAddress) {
                    args.cooperative_close_address = mainAddress.address;
                }
            }
            
            return await openChannel({
                lnd: this.lndClient,
                ...args
            });
        } catch (error) {
            throw new Error(`Failed to open channel: ${error.message}`);
        }
    }

    async createChainAddress(args: CreateChainAddressArgs = {}): Promise<CreateChainAddressResult> {
        try {
            // 默认使用 p2wpkh 格式
            const format = args.format || "p2wpkh";
            
            return await createChainAddress({
                lnd: this.lndClient,
                format,
                is_unused: args.is_unused
            });
        } catch (error) {
            throw new Error(`Failed to create chain address: ${error.message}`);
        }
    }

    async getChainBalance(): Promise<GetChainBalanceResult> {
        try {
            return await getChainBalance({
                lnd: this.lndClient
            });
        } catch (error) {
            throw new Error(`Failed to get chain balance: ${error.message}`);
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
            const { public_key: nodePubkey } =
                await lightningProvider.getLndIdentity();
            const { channels } = await lightningProvider.getLndChannel();
            const agentName = state?.agentName || "The agent";
            return `${agentName}'s Lightning Node publickey: ${nodePubkey}\nChannel count: ${channels.length}`;
        } catch (error) {
            elizaLogger.error("Error in Lightning provider:", error.message);
            return null;
        }
    },
};

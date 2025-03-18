import { IAgentRuntime, Provider, Memory, State, Plugin } from '@elizaos/core';
import { GetIdentityResult, GetChannelsResult, CreateInvoiceResult, PayResult, CloseChannelResult as CloseChannelResult$1, GetChainAddressesResult as GetChainAddressesResult$1, OpenChannelResult as OpenChannelResult$1, CreateChainAddressResult as CreateChainAddressResult$1, GetChainBalanceResult as GetChainBalanceResult$1 } from 'astra-lightning';

type CreateInvoiceArgs = {
    /** CLTV Delta */
    cltv_delta?: number;
    /** Invoice Description */
    description?: string;
    /** Hashed Description of Payment Hex String */
    description_hash?: string;
    /** Expires At ISO 8601 Date */
    expires_at?: string;
    /** Use Blinded Paths For Inbound Routes */
    is_encrypting_routes?: boolean;
    /** Is Fallback Address Included */
    is_fallback_included?: boolean;
    /** Is Fallback Address Nested */
    is_fallback_nested?: boolean;
    /** Invoice Includes Private Channels */
    is_including_private_channels?: boolean;
    /** Payment Preimage Hex String */
    secret?: string;
    /** Millitokens */
    mtokens?: string;
    routes?: any;
    /** Tokens */
    tokens?: number;
    asset_id?: string;
    peer_pubkey?: string;
    tpr?: any;
};
type PayArgs = {
    /** Pay Through Specific Final Hop Public Key Hex */
    incoming_peer?: string;
    /** Maximum Additional Fee Tokens To Pay */
    max_fee?: number;
    /** Maximum Fee Millitokens to Pay */
    max_fee_mtokens?: string;
    /** Maximum Millitokens For A Multi-Path Path */
    max_path_mtokens?: string;
    /** Maximum Simultaneous Paths */
    max_paths?: number;
    /** Max CLTV Timeout */
    max_timeout_height?: number;
    messages?: {
        /** Message Type number */
        type: string;
        /** Message Raw Value Hex Encoded */
        value: string;
    }[];
    /** Millitokens to Pay */
    mtokens?: string;
    /** Pay Through Outbound Standard Channel Id */
    outgoing_channel?: string;
    /** Pay Out of Outgoing Channel Ids */
    outgoing_channels?: string[];
    path?: {
        /** Payment Hash Hex */
        id: string;
        routes: {
            /** Total Fee Tokens To Pay */
            fee: number;
            /** Total Fee Millitokens To Pay */
            fee_mtokens: string;
            hops: {
                /** Standard Format Channel Id */
                channel: string;
                /** Channel Capacity Tokens */
                channel_capacity: number;
                /** Fee */
                fee: number;
                /** Fee Millitokens */
                fee_mtokens: string;
                /** Forward Tokens */
                forward: number;
                /** Forward Millitokens */
                forward_mtokens: string;
                /** Public Key Hex */
                public_key?: string;
                /** Timeout Block Height */
                timeout: number;
            }[];
            messages?: {
                /** Message Type number */
                type: string;
                /** Message Raw Value Hex Encoded */
                value: string;
            }[];
            /** Total Millitokens To Pay */
            mtokens: string;
            /** Payment Identifier Hex */
            payment?: string;
            /** Expiration Block Height */
            timeout: number;
            /** Total Tokens To Pay */
            tokens: number;
        }[];
    };
    /** Time to Spend Finding a Route Milliseconds */
    pathfinding_timeout?: number;
    /** BOLT 11 Payment Request */
    request?: string;
    /** Total Tokens To Pay to Payment Request */
    tokens?: number;
};
type GetChannelsArgs = {
    /** Limit Results To Only Active Channels */
    is_active?: boolean;
    /** Limit Results To Only Offline Channels */
    is_offline?: boolean;
    /** Limit Results To Only Private Channels */
    is_private?: boolean;
    /** Limit Results To Only Public Channels */
    is_public?: boolean;
    /** Only Channels With Public Key */
    partner_public_key?: string;
};
type ChannelPendingPayment = {
    id: string;
    in_channel?: string;
    in_payment?: number;
    is_forward?: boolean;
    is_outgoing: boolean;
    out_channel?: string;
    out_payment?: number;
    payment?: number;
    timeout: number;
    tokens: number;
};
type Channel = {
    capacity: number;
    commit_transaction_fee: number;
    commit_transaction_weight: number;
    cooperative_close_address?: string;
    cooperative_close_delay_height?: number;
    description?: string;
    id: string;
    is_active: boolean;
    is_closing: boolean;
    is_opening: boolean;
    is_partner_initiated: boolean;
    is_private: boolean;
    is_trusted_funding?: boolean;
    local_balance: number;
    local_csv?: number;
    local_dust?: number;
    local_given?: number;
    local_max_htlcs?: number;
    local_max_pending_mtokens?: string;
    local_min_htlc_mtokens?: string;
    local_reserve: number;
    other_ids: string[];
    partner_public_key: string;
    past_states: number;
    pending_payments: ChannelPendingPayment[];
    received: number;
    remote_balance: number;
    remote_csv?: number;
    remote_dust?: number;
    remote_given?: number;
    remote_max_htlcs?: number;
    remote_max_pending_mtokens?: string;
    remote_min_htlc_mtokens?: string;
    remote_reserve: number;
    sent: number;
    time_offline?: number;
    time_online?: number;
    transaction_id: string;
    transaction_vout: number;
    type?: string;
    unsettled_balance: number;
};
type CloseChannelArgs = {
    /** Request Sending Local Channel Funds To Address */
    address?: string;
    /** Standard Format Channel Id */
    id?: string;
    /** Is Force Close */
    is_force_close?: boolean;
    /** Is Waiting For Pending Payments to Coop Close */
    is_graceful_close?: boolean;
    /** Fail Cooperative Close Above Fee Rate */
    max_tokens_per_vbyte?: number;
    /** Peer Public Key */
    public_key?: string;
    /** Peer Socket */
    socket?: string;
    /** Confirmation Target */
    target_confirmations?: number;
    /** Target Tokens Per Virtual Byte */
    tokens_per_vbyte?: number;
    /** Transaction Id Hex */
    transaction_id?: string;
    /** Transaction Output Index */
    transaction_vout?: number;
};
type CloseChannelResult = {
    /** Closing Transaction Id Hex */
    transaction_id: string;
    /** Closing Transaction Vout */
    transaction_vout: number;
};
type OpenChannelInput = {
    transaction_id: string;
    transaction_vout: number;
};
type OpenChannelArgs = {
    /** Routing Base Fee Millitokens Charged */
    base_fee_mtokens?: string;
    /** Chain Fee Tokens Per VByte */
    chain_fee_tokens_per_vbyte?: number;
    /** Restrict Cooperative Close To Address */
    cooperative_close_address?: string;
    /** Immutable Channel Description */
    description?: string;
    /** Routing Fee Rate In Millitokens Per Million */
    fee_rate?: number;
    /** Tokens to Gift To Partner */
    give_tokens?: number;
    /** Fund With Specific Inputs */
    inputs?: OpenChannelInput[];
    /** Allow Peer to Have Minimal Reserve */
    is_allowing_minimal_reserve?: boolean;
    /** Use Maximal Chain Funds For Local Funding */
    is_max_funding?: boolean;
    /** Channel is Private */
    is_private?: boolean;
    /** Channel is Simplified Taproot Type */
    is_simplified_taproot?: boolean;
    /** Accept Funding as Trusted */
    is_trusted_funding?: boolean;
    /** Total Channel Capacity Tokens */
    local_tokens: number;
    /** Spend UTXOs With Minimum Confirmations */
    min_confirmations?: number;
    /** Minimum HTLC Millitokens */
    min_htlc_mtokens?: string;
    /** Peer Output CSV Delay */
    partner_csv_delay?: number;
    /** Public Key Hex */
    partner_public_key: string;
    /** Peer Connection Host:Port */
    partner_socket?: string;
};
type OpenChannelResult = {
    /** Funding Transaction Id */
    transaction_id: string;
    /** Funding Transaction Output Index */
    transaction_vout: number;
};
type ChainAddress = {
    /** Chain Address String */
    address: string;
    /** Is Internal Change Address */
    is_change: boolean;
    /** Balance of Funds Controlled by Output Script */
    tokens: number;
};
type GetChainAddressesResult = {
    /** Chain Addresses */
    addresses: ChainAddress[];
};
type CreateChainAddressArgs = {
    /** Receive Address Type */
    format?: "np2wpkh" | "p2tr" | "p2wpkh";
    /** Get As-Yet Unused Address */
    is_unused?: boolean;
};
type CreateChainAddressResult = {
    /** Chain Address String */
    address: string;
};
type GetChainBalanceResult = {
    /** Confirmed Chain Balance Tokens */
    chain_balance: number;
};

declare class LightningProvider {
    private lndClient;
    constructor(cert: string, macaroon: string, socket: string);
    getLndIdentity(): Promise<GetIdentityResult>;
    getLndChannel(args?: GetChannelsArgs): Promise<GetChannelsResult>;
    createInvoice(createInvoiceArgs: CreateInvoiceArgs): Promise<CreateInvoiceResult>;
    payInvoice(payInvoiceArgs: PayArgs): Promise<PayResult>;
    closeChannel(args: CloseChannelArgs): Promise<CloseChannelResult$1>;
    getChainAddresses(): Promise<GetChainAddressesResult$1>;
    openChannel(args: OpenChannelArgs): Promise<OpenChannelResult$1>;
    createChainAddress(args?: CreateChainAddressArgs): Promise<CreateChainAddressResult$1>;
    getChainBalance(): Promise<GetChainBalanceResult$1>;
}
declare const initLightningProvider: (runtime: IAgentRuntime) => Promise<LightningProvider>;
declare const lndProvider: Provider;

declare const createInvoiceTemplate = "You are an AI assistant specialized in processing requests to create Lightning Network invoices. Your task is to extract specific information from user messages and format it into a structured JSON response.\n\nFirst, review the recent messages from the conversation:\n\n<recent_messages>\n{{recentMessages}}\n</recent_messages>\n\nYour goal is to extract the following information for the invoice creation:\n1. Tokens or Millitokens (amount to request).\n2. Description (optional, a user-provided note about the invoice).\n\nBefore providing the final JSON output, show your reasoning process inside <analysis> tags. Follow these steps:\n\n1. Identify the relevant information from the user's message:\n   - Quote the part of the message mentioning the amount (tokens or millitokens).\n   - Quote the part mentioning the description (if provided).\n\n2. Validate each piece of information:\n   - Tokens or millitokens: Ensure at least one is provided and can be parsed as a valid number.\n   - Description: This field is optional; if present, it should be a string.\n\n3. If any required information is missing or invalid, prepare an appropriate error message.\n\n4. If all information is valid, summarize your findings.\n\nRespond with a JSON markdown block containing only the extracted values. All fields are required:\n\n```json\n{\n    \"description\"?: string;\n    /** Expires At ISO 8601 Date */\n    \"expires_at\"?: string;\n    \"tokens\": \"<Tokens Number | null>\"\n}\n```\n\nIf the input is valid, provide the structured JSON response. Otherwise, output an error message describing what is missing or invalid.\n\nNow, process the user's request and provide your response.\n";

declare class CreateInvoiceAction {
    private lightningProvider;
    constructor(lightningProvider: LightningProvider);
    createInvoice(params: CreateInvoiceArgs): Promise<CreateInvoiceResult>;
}
declare const createInvoiceAction: {
    name: string;
    description: string;
    handler: (runtime: IAgentRuntime, _message: Memory, state: State, _options: Record<string, unknown>, callback?: (response: {
        text: string;
        content?: {
            success: boolean;
            invoice?: string;
        };
    }) => void) => Promise<boolean>;
    template: string;
    validate: (runtime: IAgentRuntime) => Promise<boolean>;
    examples: {
        user: string;
        content: {
            text: string;
            action: string;
        };
    }[][];
    similes: string[];
};

declare const lightningPlugin: Plugin;

export { type ChainAddress, type Channel, type ChannelPendingPayment, type CloseChannelArgs, type CloseChannelResult, type CreateChainAddressArgs, type CreateChainAddressResult, CreateInvoiceAction, type CreateInvoiceArgs, type GetChainAddressesResult, type GetChainBalanceResult, type GetChannelsArgs, LightningProvider, type OpenChannelArgs, type OpenChannelInput, type OpenChannelResult, type PayArgs, createInvoiceAction, createInvoiceTemplate, lightningPlugin as default, initLightningProvider, lightningPlugin, lndProvider };

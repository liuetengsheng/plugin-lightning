export type CreateInvoiceArgs = {
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

export type PayArgs = {
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

export type GetChannelsArgs = {
   // 空对象，不需要任何参数
};

export type ChannelPendingPayment = {
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

export type Channel = {
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

export type CloseChannelArgs = {
    /** Standard Format Channel Id */
    id: string;
};

export type CloseChannelResult = {
    /** Closing Transaction Id Hex */
    transaction_id: string;
    /** Closing Transaction Vout */
    transaction_vout: number;
};

export type OpenChannelInput = {
    transaction_id: string;
    transaction_vout: number;
};

export type OpenChannelArgs = {
    /** Total Channel Capacity Tokens */
    local_tokens: number;
    /** Public Key Hex */
    partner_public_key: string;
    /** Peer Connection Host:Port */
    partner_socket: string;
};

export type OpenChannelResult = {
    /** Funding Transaction Id */
    transaction_id: string;
    /** Funding Transaction Output Index */
    transaction_vout: number;
};

export type ChainAddress = {
    /** Chain Address String */
    address: string;
    /** Is Internal Change Address */
    is_change: boolean;
    /** Balance of Funds Controlled by Output Script */
    tokens: number;
};

export type GetChainAddressesResult = {
    /** Chain Addresses */
    addresses: ChainAddress[];
};

export type CreateChainAddressArgs = {
    /** Receive Address Type */
    format?: "np2wpkh" | "p2tr" | "p2wpkh";
    /** Get As-Yet Unused Address */
    is_unused?: boolean;
};

export type CreateChainAddressResult = {
    /** Chain Address String */
    address: string;
};

export type GetChainBalanceResult = {
    /** Confirmed Chain Balance Tokens */
    chain_balance: number;
};

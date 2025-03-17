export const createInvoiceTemplate = `You are an AI assistant specialized in processing requests to create Lightning Network invoices. Your task is to extract specific information from user messages and format it into a structured JSON response.

First, review the recent messages from the conversation:

<recent_messages>
{{recentMessages}}
</recent_messages>

Your goal is to extract the following information for the invoice creation:
1. Tokens or Millitokens (amount to request).
2. Description (optional, a user-provided note about the invoice).

Before providing the final JSON output, show your reasoning process inside <analysis> tags. Follow these steps:

1. Identify the relevant information from the user's message:
   - Quote the part of the message mentioning the amount (tokens or millitokens).
   - Quote the part mentioning the description (if provided).

2. Validate each piece of information:
   - Tokens or millitokens: Ensure at least one is provided and can be parsed as a valid number.
   - Description: This field is optional; if present, it should be a string.

3. If any required information is missing or invalid, prepare an appropriate error message.

4. If all information is valid, summarize your findings.

Respond with a JSON markdown block containing only the extracted values. All fields are required:

\`\`\`json
{
    "description"?: string;
    /** Expires At ISO 8601 Date */
    "expires_at"?: string;
    "tokens": "<Tokens Number | null>"
}
\`\`\`

If the input is valid, provide the structured JSON response. Otherwise, output an error message describing what is missing or invalid.

Now, process the user's request and provide your response.
`;

export const payInvoiceTemplate = `You are an AI assistant specialized in processing requests to make a payment.. Your task is to extract specific information from user messages and format it into a structured JSON response.

First, review the recent messages from the conversation:

<recent_messages>
{{recentMessages}}
</recent_messages>

### Instructions:
1. **Review the user's message:** Analyze the input text to identify the required payment details.
2. **Extract the following fields:**
   - "request": This is the **BOLT 11 Payment Request String**. It typically starts with "lnbc", "lntb", "lnbcrt", or similar prefixes and can contain letters and numbers.
   - "outgoing_channel" (optional): This is the Outbound Standard Channel Id String. If not provided, this can be left as "null".

3. **Validation:**
   - Ensure "request" is valid and starts with one of: "lnbc" (mainnet), "lntb" (testnet), "lnbcrt" (regtest), or "lnsb" (signet).
   - If "outgoing_channel" is present, ensure it is a valid string.

4. **Output:** If all required fields are valid, respond with the following JSON format:

\`\`\`json
    {
       "request": "<Extracted BOLT 11 Payment Request String>",
       "outgoing_channel": "<Extracted Channel Id or null>"
     }
\`\`\`

5. If any information is invalid or missing, respond with an error message explaining what is wrong.

Now, process the user's request and provide your response.
`;

export const getChannelsTemplate = `You are an AI assistant specialized in processing requests to get lightning network channels information. Your task is to extract specific information from user messages and format it into a structured JSON response.

First, review the recent messages from the conversation:

<recent_messages>
{{recentMessages}}
</recent_messages>

Your goal is to extract the following optional filter parameters:
1. is_active (boolean)
2. is_offline (boolean)
3. is_private (boolean)
4. is_public (boolean)
5. partner_public_key (string)

Respond with a JSON markdown block containing the extracted values:

\`\`\`json
{
    "is_active"?: boolean;
    "is_offline"?: boolean;
    "is_private"?: boolean;
    "is_public"?: boolean;
    "partner_public_key"?: string;
}
\`\`\`

Now, process the user's request and provide your response.
`;

export const closeChannelTemplate = `You are an AI assistant specialized in processing requests to close a lightning network channel. Your task is to extract specific information from user messages and format it into a structured JSON response.

First, review the recent messages from the conversation:

<recent_messages>
{{recentMessages}}
</recent_messages>

Your goal is to extract the following information for channel closing:
1. Channel ID or Transaction Details (required - either channel_id OR transaction_id + transaction_vout)
2. Closing Options (optional):
   - address (送金地址)
   - is_force_close (是否强制关闭)
   - is_graceful_close (是否等待待处理支付完成后再关闭)
   - max_tokens_per_vbyte (最大每字节手续费)
   - tokens_per_vbyte (目标每字节手续费)
   - target_confirmations (目标确认数)
   - public_key (节点公钥)
   - socket (节点地址)

Respond with a JSON markdown block containing the extracted values:

\`\`\`json
{
    "id"?: string;
    "transaction_id"?: string;
    "transaction_vout"?: number;
    "address"?: string;
    "is_force_close"?: boolean;
    "is_graceful_close"?: boolean;
    "max_tokens_per_vbyte"?: number;
    "tokens_per_vbyte"?: number;
    "target_confirmations"?: number;
    "public_key"?: string;
    "socket"?: string;
}
\`\`\`

Now, process the user's request and provide your response.
`;

export const openChannelTemplate = `You are an AI assistant specialized in processing requests to open a new lightning network channel. Your task is to extract specific information from user messages and format it into a structured JSON response.

First, review the recent messages from the conversation:

<recent_messages>
{{recentMessages}}
</recent_messages>

Your goal is to extract the following information for channel opening:
1. Required Parameters:
   - local_tokens (通道总容量)
   - partner_public_key (对方节点公钥)

2. Optional Parameters:
   - base_fee_mtokens (路由基础费用，毫聪)
   - chain_fee_tokens_per_vbyte (链上每字节费用)
   - cooperative_close_address (指定协作关闭地址，如果不提供将自动获取)
   - description (通道描述)
   - fee_rate (路由费率，百万分之一)
   - give_tokens (赠送给对方的聪数)
   - is_allowing_minimal_reserve (允许最小储备)
   - is_max_funding (使用最大可用资金)
   - is_private (是否私有通道)
   - is_simplified_taproot (是否简化 Taproot 通道)
   - is_trusted_funding (是否信任资金)
   - min_confirmations (UTXO最小确认数)
   - min_htlc_mtokens (最小HTLC毫聪)
   - partner_csv_delay (对方CSV延迟)
   - partner_socket (对方节点地址)

Respond with a JSON markdown block containing the extracted values:

\`\`\`json
{
    "local_tokens": number,
    "partner_public_key": string,
    "base_fee_mtokens"?: string,
    "chain_fee_tokens_per_vbyte"?: number,
    "cooperative_close_address"?: string,
    "description"?: string,
    "fee_rate"?: number,
    "give_tokens"?: number,
    "is_allowing_minimal_reserve"?: boolean,
    "is_max_funding"?: boolean,
    "is_private"?: boolean,
    "is_simplified_taproot"?: boolean,
    "is_trusted_funding"?: boolean,
    "min_confirmations"?: number,
    "min_htlc_mtokens"?: string,
    "partner_csv_delay"?: number,
    "partner_socket"?: string
}
\`\`\`

Now, process the user's request and provide your response.
`;

export const createChainAddressTemplate = `You are an AI assistant specialized in processing requests to create a new Bitcoin chain address. Your task is to extract specific information from user messages and format it into a structured JSON response.

First, review the recent messages from the conversation:

<recent_messages>
{{recentMessages}}
</recent_messages>

Your goal is to extract the following information for address creation:
1. Required Parameters:
   - format (地址类型，默认为 "p2wpkh")
   - is_unused (是否获取未使用的地址，可选)

Respond with a JSON markdown block containing the extracted values:

\`\`\`json
{
    "format"?: "p2wpkh" | "np2wpkh" | "p2tr",
    "is_unused"?: boolean
}
\`\`\`

Now, process the user's request and provide your response.
`;

export const getChainBalanceTemplate = `You are an AI assistant specialized in processing requests to get Bitcoin chain balance. Your task is to extract specific information from user messages and format it into a structured JSON response.

First, review the recent messages from the conversation:

<recent_messages>
{{recentMessages}}
</recent_messages>

Your goal is to extract the following information for balance checking:
1. Required Parameters:
   - None (this action will return the total confirmed chain balance)

Respond with a JSON markdown block containing the extracted values:

\`\`\`json
{
    // 这个动作不需要任何参数
}
\`\`\`

Now, process the user's request and provide your response.
`;

import type { IAgentRuntime, Memory, State } from "@elizaos/core";
import {
    composeContext,
    generateObject,
    ModelClass,
    elizaLogger,
} from "@elizaos/core";

import {
    initLightningProvider,
    type LightningProvider,
} from "../providers/lightning";
import type { OpenChannelArgs, OpenChannelResult } from "../types";
import { openChannelTemplate } from "../templates";
import { z } from "zod";

export { openChannelTemplate };

export class OpenChannelAction {
    constructor(private lightningProvider: LightningProvider) {
        this.lightningProvider = lightningProvider;
        elizaLogger.info("OpenChannelAction initialized");
    }

    async openChannel(params: OpenChannelArgs): Promise<OpenChannelResult> {
        elizaLogger.info("OpenChannelAction.openChannel called with params:", {
            local_tokens: params.local_tokens,
            partner_public_key: params.partner_public_key,
            is_private: params.is_private,
            description: params.description
        });

        try {
            // 验证必要参数
            if (!params.local_tokens || !params.partner_public_key) {
                elizaLogger.error("Validation failed: Missing required parameters", {
                    hasLocalTokens: !!params.local_tokens,
                    hasPartnerPublicKey: !!params.partner_public_key
                });
                throw new Error("local_tokens and partner_public_key are required");
            }

            const result = await this.lightningProvider.openChannel(params);
            elizaLogger.info("Channel opened successfully:", {
                transaction_id: result.transaction_id,
                transaction_vout: result.transaction_vout,
                local_tokens: params.local_tokens,
                partner_public_key: params.partner_public_key
            });
            return result;
        } catch (error) {
            elizaLogger.error("Error in openChannel:", {
                error: error.message,
                stack: error.stack,
                params
            });
            throw error;
        }
    }
}

// 定义 schema 类型
const openChannelSchema = z.object({
    local_tokens: z.number(),
    partner_public_key: z.string(),
    base_fee_mtokens: z.string().optional(),
    chain_fee_tokens_per_vbyte: z.number().optional(),
    cooperative_close_address: z.string().optional(),
    description: z.string().optional(),
    fee_rate: z.number().optional(),
    give_tokens: z.number().optional(),
    is_allowing_minimal_reserve: z.boolean().optional(),
    is_max_funding: z.boolean().optional(),
    is_private: z.boolean().optional(),
    is_simplified_taproot: z.boolean().optional(),
    is_trusted_funding: z.boolean().optional(),
    min_confirmations: z.number().optional(),
    min_htlc_mtokens: z.string().optional(),
    partner_csv_delay: z.number().optional(),
    partner_socket: z.string().optional(),
});

type OpenChannelContent = z.infer<typeof openChannelSchema>;

export const openChannelAction = {
    name: "OPEN_CHANNEL",
    description: "Open a new lightning network channel.",
    handler: async (
        runtime: IAgentRuntime,
        _message: Memory,
        state: State,
        _options: Record<string, unknown>,
        callback?: (response: {
            text: string;
            content?: { success: boolean; transaction?: { id: string; vout: number } };
        }) => void
    ) => {
        elizaLogger.info("openChannel action handler called with params:", {
            message: _message,
            state,
            options: _options,
            hasCallback: !!callback
        });
        
        try {
            const lightningProvider = await initLightningProvider(runtime);
            elizaLogger.info("LightningProvider initialized successfully");
            
            const action = new OpenChannelAction(lightningProvider);
            elizaLogger.info("OpenChannelAction created");

            // Compose bridge context
            const openChannelContext = composeContext({
                state,
                template: openChannelTemplate,
            });
            elizaLogger.info("Bridge context composed:", { context: openChannelContext });
            
            const content = await generateObject({
                runtime,
                context: openChannelContext,
                schema: openChannelSchema as z.ZodType,
                modelClass: ModelClass.LARGE,
            });
            elizaLogger.info("Generated content:", { content });

            const openChannelContent = content.object as OpenChannelContent;
            elizaLogger.info("Parsed content:", openChannelContent);

            // 验证必要参数
            if (!openChannelContent.local_tokens || !openChannelContent.partner_public_key) {
                elizaLogger.error("Validation failed: Missing required parameters", {
                    hasLocalTokens: !!openChannelContent.local_tokens,
                    hasPartnerPublicKey: !!openChannelContent.partner_public_key
                });
                if (callback) {
                    const errorResponse = {
                        text: "Error: local_tokens and partner_public_key are required",
                    };
                    elizaLogger.info("Error callback response:", errorResponse);
                    callback(errorResponse);
                }
                return false;
            }

            const result = await action.openChannel(openChannelContent);
            elizaLogger.info("Channel opened successfully:", {
                transaction_id: result.transaction_id,
                transaction_vout: result.transaction_vout,
                local_tokens: openChannelContent.local_tokens,
                partner_public_key: openChannelContent.partner_public_key,
                is_private: openChannelContent.is_private,
                description: openChannelContent.description
            });
            
            if (callback) {
                const addressInfo = openChannelContent.cooperative_close_address 
                    ? `\nCooperative close address: ${openChannelContent.cooperative_close_address}`
                    : "\nUsing automatically fetched cooperative close address";
                
                const response = {
                    text: `Successfully opened channel with capacity ${openChannelContent.local_tokens} sats to ${openChannelContent.partner_public_key}.${addressInfo}\nTransaction ID: ${result.transaction_id}, Vout: ${result.transaction_vout}`,
                    content: { 
                        success: true,
                        transaction: {
                            id: result.transaction_id,
                            vout: result.transaction_vout
                        }
                    },
                };
                elizaLogger.info("Success callback response:", response);
                callback(response);
            }
            return true;
        } catch (error) {
            elizaLogger.error("Error in openChannel handler:", {
                error: error.message,
                stack: error.stack,
                message: _message,
                state,
                options: _options
            });
            if (callback) {
                const errorResponse = {
                    text: `Error: ${error.message || "An error occurred"}`,
                };
                elizaLogger.info("Error callback response:", errorResponse);
                callback(errorResponse);
            }
            return false;
        }
    },
    template: openChannelTemplate,
    validate: async (runtime: IAgentRuntime) => {
        elizaLogger.info("Validating openChannel action");
        const cert = runtime.getSetting("LND_TLS_CERT");
        const macaroon = runtime.getSetting("LND_MACAROON");
        const socket = runtime.getSetting("LND_SOCKET");
        const isValid = !!cert && !!macaroon && !!socket;
        elizaLogger.info("Validation result:", { 
            isValid,
            hasCert: !!cert,
            hasMacaroon: !!macaroon,
            hasSocket: !!socket
        });
        return isValid;
    },
    examples: [
        [
            {
                user: "user",
                content: {
                    text: "Open a channel with 1000000 sats to 03xxxxxx",
                    action: "OPEN_CHANNEL",
                },
            },
        ],
    ],
    similes: ["OPEN_CHANNEL", "CREATE_CHANNEL"],
};

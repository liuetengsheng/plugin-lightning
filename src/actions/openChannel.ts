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
    }

    async openChannel(params: OpenChannelArgs): Promise<OpenChannelResult> {
        try {
            if (!params.local_tokens) {
                elizaLogger.error("Validation failed: Missing required parameter local_tokens");
                throw new Error("local_tokens is required");
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
                error: typeof error === 'object' ? error : { message: String(error) },
                errorString: String(error),
                errorJSON: JSON.stringify(error, Object.getOwnPropertyNames(error)),
                stack: error?.stack,
                params
            });
            throw error;
        }
    }
}

// 简化schema，只需要local_tokens
const openChannelSchema = z.object({
    local_tokens: z.number()
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
        try {
            const lightningProvider = await initLightningProvider(runtime);
            const action = new OpenChannelAction(lightningProvider);

            // 从环境变量获取partner_public_key和partner_socket
            const partner_public_key = runtime.getSetting("PARTNER_PUBLIC_KEY");
            const partner_socket = runtime.getSetting("PARTNER_SOCKET");
            
            if (!partner_public_key) {
                throw new Error("Missing required environment variable: PARTNER_PUBLIC_KEY");
            }
            
            if (!partner_socket) {
                throw new Error("Missing required environment variable: PARTNER_SOCKET");
            }

            // 简化的桥接上下文
            const openChannelContext = composeContext({
                state,
                template: openChannelTemplate,
            });
            
            const content = await generateObject({
                runtime,
                context: openChannelContext,
                schema: openChannelSchema as z.ZodType,
                modelClass: ModelClass.LARGE,
            });

            const openChannelContent = content.object as OpenChannelContent;

            // 验证必要参数
            if (!openChannelContent.local_tokens) {
                elizaLogger.error("Validation failed: Missing required parameter local_tokens");
                if (callback) {
                    callback({
                        text: "Error: local_tokens is required"
                    });
                }
                return false;
            }

            // 构建完整的channel参数
            const channelParams: OpenChannelArgs = {
                local_tokens: openChannelContent.local_tokens,
                partner_public_key: partner_public_key,
                partner_socket: partner_socket
            };

            elizaLogger.info("Opening channel with params:", {
                local_tokens: channelParams.local_tokens,
                partner_public_key: channelParams.partner_public_key,
                partner_socket: channelParams.partner_socket
            });

            const result = await action.openChannel(channelParams);
            elizaLogger.info("Channel opened successfully:", {
                transaction_id: result.transaction_id,
                transaction_vout: result.transaction_vout,
                local_tokens: openChannelContent.local_tokens
            });
            
            if (callback) {
                const response = {
                    text: `Successfully opened channel with capacity ${openChannelContent.local_tokens} sats to ${partner_public_key}.\nTransaction ID: ${result.transaction_id}, Vout: ${result.transaction_vout}`,
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
                error: typeof error === 'object' ? error : { message: String(error) },
                errorString: String(error),
                errorJSON: JSON.stringify(error, Object.getOwnPropertyNames(error)),
                stack: error?.stack
            });
            
            if (callback) {
                const errorResponse = {
                    text: `Error: ${error?.message || String(error) || "An error occurred"}`,
                };
                elizaLogger.info("Error callback response:", errorResponse);
                callback(errorResponse);
            }
            return false;
        }
    },
    template: openChannelTemplate,
    validate: async (runtime: IAgentRuntime) => {
        const cert = runtime.getSetting("LND_TLS_CERT");
        const macaroon = runtime.getSetting("LND_MACAROON");
        const socket = runtime.getSetting("LND_SOCKET");
        const partner_public_key = runtime.getSetting("PARTNER_PUBLIC_KEY");
        const partner_socket = runtime.getSetting("PARTNER_SOCKET");
        
        const isValid = !!cert && !!macaroon && !!socket && !!partner_public_key && !!partner_socket;
        
        if (!isValid) {
            const missing = [];
            if (!cert) missing.push("LND_TLS_CERT");
            if (!macaroon) missing.push("LND_MACAROON");
            if (!socket) missing.push("LND_SOCKET");
            if (!partner_public_key) missing.push("PARTNER_PUBLIC_KEY");
            if (!partner_socket) missing.push("PARTNER_SOCKET");
            
            elizaLogger.error("Missing required environment variables:", { missing });
        }
        
        return isValid;
    },
    examples: [
        [
            {
                user: "user",
                content: {
                    text: "Open a channel with 1000000 sats",
                    action: "OPEN_CHANNEL",
                },
            },
        ],
    ],
    similes: ["OPEN_CHANNEL", "CREATE_CHANNEL"],
};

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
import type { CloseChannelArgs, CloseChannelResult } from "../types";
import { closeChannelTemplate } from "../templates";
import { z } from "zod";

export { closeChannelTemplate };

export class CloseChannelAction {
    constructor(private lightningProvider: LightningProvider) {
        this.lightningProvider = lightningProvider;
        elizaLogger.log("CloseChannelAction initialized");
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
                lnd: this.lightningProvider.lndClient,
                ...(args.id ? { id: args.id } : {}),
                ...(args.transaction_id && args.transaction_vout ? {
                    transaction_id: args.transaction_id,
                    transaction_vout: args.transaction_vout
                } : {})
            };

            if (args.is_force_close) {
                elizaLogger.log("Performing force close");
                // 强制关闭参数
                const forceCloseArgs = {
                    ...baseArgs,
                    is_force_close: true as const
                };

                const result = await this.lightningProvider.closeChannel(forceCloseArgs);
                elizaLogger.log("Channel force closed successfully:", {
                    transaction_id: result.transaction_id,
                    transaction_vout: result.transaction_vout
                });
                return result;
            } else {
                elizaLogger.log("Performing cooperative close");
                // 协作关闭参数
                const coopCloseArgs = {
                    ...baseArgs,
                    address: args.address,
                    is_force_close: false as const,
                    is_partner_initiated: false,
                    target_confirmations: args.target_confirmations,
                    tokens_per_vbyte: args.tokens_per_vbyte
                };

                const result = await this.lightningProvider.closeChannel(coopCloseArgs);
                elizaLogger.log("Channel cooperatively closed successfully:", {
                    transaction_id: result.transaction_id,
                    transaction_vout: result.transaction_vout
                });
                return result;
            }
        } catch (error) {
            elizaLogger.error("Failed to close channel:", {
                error: error.message,
                stack: error.stack,
                args
            });
            throw new Error(`Failed to close channel: ${error.message}`);
        }
    }
}

// 定义 schema 类型
const closeChannelSchema = z.object({
    id: z.string().optional(),
    transaction_id: z.string().optional(),
    transaction_vout: z.number().optional(),
    address: z.string().optional(),
    is_force_close: z.boolean().optional(),
    is_graceful_close: z.boolean().optional(),
    max_tokens_per_vbyte: z.number().optional(),
    tokens_per_vbyte: z.number().optional(),
    target_confirmations: z.number().optional(),
    public_key: z.string().optional(),
    socket: z.string().optional(),
});

type CloseChannelContent = z.infer<typeof closeChannelSchema>;

export const closeChannelAction = {
    name: "CLOSE_CHANNEL",
    description: "Close a lightning network channel.",
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
        elizaLogger.log("closeChannel action handler called with params:", {
            message: _message,
            state,
            options: _options,
            hasCallback: !!callback
        });
        
        try {
            const lightningProvider = await initLightningProvider(runtime);
            elizaLogger.log("LightningProvider initialized successfully");
            
            const action = new CloseChannelAction(lightningProvider);
            elizaLogger.log("CloseChannelAction created");

            // Compose bridge context
            const closeChannelContext = composeContext({
                state,
                template: closeChannelTemplate,
            });
            elizaLogger.log("Bridge context composed:", { context: closeChannelContext });
            
            const content = await generateObject({
                runtime,
                context: closeChannelContext,
                schema: closeChannelSchema as z.ZodType,
                modelClass: ModelClass.LARGE,
            });
            elizaLogger.log("Generated content:", { content });

            const closeChannelContent = content.object as CloseChannelContent;
            elizaLogger.log("Parsed content:", closeChannelContent);

            // 验证必要参数
            if (!closeChannelContent.id && 
                !(closeChannelContent.transaction_id && closeChannelContent.transaction_vout)) {
                elizaLogger.error("Validation failed: Missing required parameters", {
                    hasId: !!closeChannelContent.id,
                    hasTransactionId: !!closeChannelContent.transaction_id,
                    hasTransactionVout: !!closeChannelContent.transaction_vout
                });
                if (callback) {
                    const errorResponse = {
                        text: "Error: Either channel id or transaction details (id and vout) are required",
                    };
                    elizaLogger.log("Error callback response:", errorResponse);
                    callback(errorResponse);
                }
                return false;
            }

            const result = await action.closeChannel(closeChannelContent);
            elizaLogger.log("Channel closed successfully:", {
                transaction_id: result.transaction_id,
                transaction_vout: result.transaction_vout,
                is_force_close: closeChannelContent.is_force_close,
                is_graceful_close: closeChannelContent.is_graceful_close
            });
            
            if (callback) {
                const response = {
                    text: `Successfully closed channel. Transaction ID: ${result.transaction_id}, Vout: ${result.transaction_vout}`,
                    content: { 
                        success: true,
                        transaction: {
                            id: result.transaction_id,
                            vout: result.transaction_vout
                        }
                    },
                };
                elizaLogger.log("Success callback response:", response);
                callback(response);
            }
            return true;
        } catch (error) {
            elizaLogger.error("Error in closeChannel handler:", {
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
                elizaLogger.log("Error callback response:", errorResponse);
                callback(errorResponse);
            }
            return false;
        }
    },
    template: closeChannelTemplate,
    validate: async (runtime: IAgentRuntime) => {
        elizaLogger.log("Validating closeChannel action");
        const cert = runtime.getSetting("LND_TLS_CERT");
        const macaroon = runtime.getSetting("LND_MACAROON");
        const socket = runtime.getSetting("LND_SOCKET");
        const isValid = !!cert && !!macaroon && !!socket;
        elizaLogger.log("Validation result:", { 
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
                    text: "Close channel with ID 123456",
                    action: "CLOSE_CHANNEL",
                },
            },
        ],
    ],
    similes: ["CLOSE_CHANNEL", "SHUTDOWN_CHANNEL"],
};






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
    }

    async closeChannel(args: CloseChannelArgs): Promise<CloseChannelResult> {
        try {
            // 验证基本参数
            if (!args.id && !(args.transaction_id && args.transaction_vout)) {
                elizaLogger.error("Missing required parameters", {
                    id: args.id,
                    transaction_id: args.transaction_id,
                    transaction_vout: args.transaction_vout
                });
                throw new Error("Either channel id or transaction details are required");
            }

            // 验证协作关闭所需的参数
            if (!args.is_force_close && (!args.public_key || !args.socket)) {
                elizaLogger.error("Missing parameters for cooperative close", {
                    public_key: args.public_key,
                    socket: args.socket
                });
                throw new Error("Cooperative close requires public_key and socket");
            }
            
            const result = await this.lightningProvider.closeChannel({
                ...args,
                is_force_close: args.is_force_close || false
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
                channel: args.id || `${args.transaction_id}:${args.transaction_vout}`
            });
            throw error;
        }
    }
}

// 修改 schema 定义，添加必要的验证
const closeChannelSchema = z.object({
    id: z.string().optional(),
    transaction_id: z.string().optional(),
    transaction_vout: z.number().optional(),
    is_force_close: z.boolean().optional().default(false),
    // 协作关闭的参数
    public_key: z.string().optional(),
    socket: z.string().optional(),
    // 可选参数
    address: z.string().optional(),
    target_confirmations: z.number().optional(),
    tokens_per_vbyte: z.number().optional(),
    is_graceful_close: z.boolean().optional(),
    max_tokens_per_vbyte: z.number().optional()
}).refine(
    data => !!(data.id || (data.transaction_id && data.transaction_vout)),
    "Either channel id or transaction details are required"
).refine(
    data => data.is_force_close || !!(data.public_key && data.socket),
    "Cooperative close requires public_key and socket"
);

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
        try {
            const lightningProvider = await initLightningProvider(runtime);
            const action = new CloseChannelAction(lightningProvider);
            
            const closeChannelContext = composeContext({
                state,
                template: closeChannelTemplate,
            });
            
            const content = await generateObject({
                runtime,
                context: closeChannelContext,
                schema: closeChannelSchema as z.ZodType,
                modelClass: ModelClass.LARGE,
            });

            const closeChannelContent = content.object as CloseChannelContent;
            
            // 只记录关键验证错误
            if (!closeChannelContent.id && 
                !(closeChannelContent.transaction_id && closeChannelContent.transaction_vout)) {
                elizaLogger.error("Missing required parameters for channel close");
                if (callback) {
                    callback({
                        text: "Error: Either channel id or transaction details are required"
                    });
                }
                return false;
            }

            const result = await action.closeChannel(closeChannelContent);
            
            if (callback) {
                callback({
                    text: `Successfully closed channel. Transaction ID: ${result.transaction_id}`,
                    content: { 
                        success: true,
                        transaction: {
                            id: result.transaction_id,
                            vout: result.transaction_vout
                        }
                    },
                });
            }
            return true;
        } catch (error) {
            // 更全面的错误日志记录
            elizaLogger.error("Error in closeChannel handler:", {
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
    template: closeChannelTemplate,
    validate: async (runtime: IAgentRuntime) => {
        const cert = runtime.getSetting("LND_TLS_CERT");
        const macaroon = runtime.getSetting("LND_MACAROON");
        const socket = runtime.getSetting("LND_SOCKET");
        const isValid = !!cert && !!macaroon && !!socket;
        if (!isValid) {
            elizaLogger.error("Missing required LND credentials");
        }
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






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
            if (!args.id) {
                elizaLogger.error("Missing required parameter: id");
                throw new Error("Channel id is required");
            }
            
            // 关闭通道只需要id参数
            const closeArgs: CloseChannelArgs = {
                id: args.id
            };
            
            elizaLogger.info("Force closing channel:", { id: args.id });
            const result = await this.lightningProvider.closeChannel(closeArgs);

            elizaLogger.info("Channel closed:", { 
                id: args.id,
                transaction_id: result.transaction_id
            });
            return result;
        } catch (error) {
            elizaLogger.error("Close channel failed:", {
                error: typeof error === 'object' ? error : { message: String(error) },
                errorString: String(error),
                errorJSON: JSON.stringify(error, Object.getOwnPropertyNames(error)),
                stack: error?.stack,
                id: args.id
            });
            throw error;
        }
    }
}

// 简化schema，只需要id
const closeChannelSchema = z.object({
    id: z.string()
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
            
            // 验证必要参数
            if (!closeChannelContent.id) {
                elizaLogger.error("Missing required parameter: id");
                if (callback) {
                    callback({
                        text: "Error: Channel id is required"
                    });
                }
                return false;
            }

            const result = await action.closeChannel(closeChannelContent);
            
            if (callback) {
                callback({
                    text: `Successfully force closed channel ${closeChannelContent.id}. Transaction ID: ${result.transaction_id}`,
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






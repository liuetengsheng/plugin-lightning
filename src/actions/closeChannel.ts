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
            elizaLogger.info("Closing channel:", {
                id: args.id || `${args.transaction_id}:${args.transaction_vout}`,
                type: args.is_force_close ? "force" : "cooperative"
            });
            
            const result = await this.lightningProvider.closeChannel(args);
            elizaLogger.info("Channel closed:", { 
                transaction_id: result.transaction_id 
            });
            return result;
        } catch (error) {
            elizaLogger.error("Close channel failed:", error);
            throw error;
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
            elizaLogger.error("Channel close failed:", error);
            if (callback) {
                callback({
                    text: `Error: ${error.message || "An error occurred"}`
                });
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






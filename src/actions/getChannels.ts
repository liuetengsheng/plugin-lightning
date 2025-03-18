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
import type { Channel } from "../types";
import { getChannelsTemplate } from "../templates";
import { z } from "zod";

export { getChannelsTemplate };

export class GetChannelsAction {
    constructor(private lightningProvider: LightningProvider) {
        this.lightningProvider = lightningProvider;
    }

    async getChannels(): Promise<{ channels: Channel[] }> {
        try {
            // 直接获取所有通道，不做任何过滤
            const { channels } = await this.lightningProvider.getLndChannel();
            
            elizaLogger.info("Channels retrieved:", {
                total: channels.length,
                active: channels.filter(c => c.is_active).length
            });

            return { channels };
        } catch (error) {
            elizaLogger.error("Error in getChannels:", {
                error: typeof error === 'object' ? error : { message: String(error) },
                errorString: String(error),
                errorJSON: JSON.stringify(error, Object.getOwnPropertyNames(error)),
                stack: error?.stack
            });
            throw error;
        }
    }
}

// 简化schema，不需要任何参数
const getChannelsSchema = z.object({});

type GetChannelsContent = z.infer<typeof getChannelsSchema>;

export const getChannelsAction = {
    name: "GET_CHANNELS",
    description: "Get lightning network channels information.",
    handler: async (
        runtime: IAgentRuntime,
        _message: Memory,
        state: State,
        _options: Record<string, unknown>,
        callback?: (response: {
            text: string;
            content?: { success: boolean; channels?: Channel[] };
        }) => void
    ) => {
        try {
            const lightningProvider = await initLightningProvider(runtime);
            const action = new GetChannelsAction(lightningProvider);

            // 不需要复杂的参数解析，直接获取通道信息
            const result = await action.getChannels();
            elizaLogger.info("Channels retrieved successfully:", {
                totalChannels: result.channels.length,
                activeChannels: result.channels.filter(c => c.is_active).length,
                privateChannels: result.channels.filter(c => c.is_private).length
            });
            
            if (callback) {
                const channelSummary = result.channels.map(channel => 
                    `Channel ${channel.id}: ${channel.local_balance} sats local, ${channel.remote_balance} sats remote${channel.is_active ? ' (active)' : ' (inactive)'}`
                ).join('\n');

                const response = {
                    text: `Found ${result.channels.length} channels:\n${channelSummary}`,
                    content: { 
                        success: true,
                        channels: result.channels
                    },
                };
                elizaLogger.info("Callback response:", response);
                callback(response);
            }
            return true;
        } catch (error) {
            elizaLogger.error("Error in getChannels handler:", {
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
    template: getChannelsTemplate,
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
                    text: "Show me all channels",
                    action: "GET_CHANNELS",
                },
            },
        ],
    ],
    similes: ["GET_CHANNELS", "LIST_CHANNELS", "SHOW_CHANNELS"],
};

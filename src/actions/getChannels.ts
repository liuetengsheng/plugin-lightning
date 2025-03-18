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
import type { GetChannelsArgs, Channel } from "../types";
import { getChannelsTemplate } from "../templates";
import { z } from "zod";

export { getChannelsTemplate };

export class GetChannelsAction {
    constructor(private lightningProvider: LightningProvider) {
        this.lightningProvider = lightningProvider;
        elizaLogger.log("GetChannelsAction initialized");
    }

    async getChannels(params: GetChannelsArgs = {}): Promise<{ channels: Channel[] }> {
        elizaLogger.log("GetChannelsAction.getChannels called with params:", params);
        try {
            const { channels } = await this.lightningProvider.getLndChannel();
            elizaLogger.log("Retrieved channels from provider:", {
                totalChannels: channels.length,
                activeChannels: channels.filter(c => c.is_active).length,
                privateChannels: channels.filter(c => c.is_private).length
            });
            
            // 应用过滤条件
            let filteredChannels = channels;
            
            if (params.is_active !== undefined) {
                filteredChannels = filteredChannels.filter(
                    channel => channel.is_active === params.is_active
                );
                elizaLogger.log("Applied is_active filter:", {
                    is_active: params.is_active,
                    remainingChannels: filteredChannels.length
                });
            }
            
            if (params.is_offline !== undefined) {
                filteredChannels = filteredChannels.filter(
                    channel => !channel.is_active === params.is_offline
                );
                elizaLogger.log("Applied is_offline filter:", {
                    is_offline: params.is_offline,
                    remainingChannels: filteredChannels.length
                });
            }
            
            if (params.is_private !== undefined) {
                filteredChannels = filteredChannels.filter(
                    channel => channel.is_private === params.is_private
                );
                elizaLogger.log("Applied is_private filter:", {
                    is_private: params.is_private,
                    remainingChannels: filteredChannels.length
                });
            }
            
            if (params.is_public !== undefined) {
                filteredChannels = filteredChannels.filter(
                    channel => !channel.is_private === params.is_public
                );
                elizaLogger.log("Applied is_public filter:", {
                    is_public: params.is_public,
                    remainingChannels: filteredChannels.length
                });
            }
            
            if (params.partner_public_key) {
                filteredChannels = filteredChannels.filter(
                    channel => channel.partner_public_key === params.partner_public_key
                );
                elizaLogger.log("Applied partner_public_key filter:", {
                    partner_public_key: params.partner_public_key,
                    remainingChannels: filteredChannels.length
                });
            }

            elizaLogger.log("Final filtered channels:", {
                totalChannels: filteredChannels.length,
                activeChannels: filteredChannels.filter(c => c.is_active).length,
                privateChannels: filteredChannels.filter(c => c.is_private).length
            });

            return { channels: filteredChannels };
        } catch (error) {
            elizaLogger.error("Error in getChannels:", {
                error: error.message,
                stack: error.stack,
                params
            });
            throw error;
        }
    }
}

// 定义 schema 类型
const getChannelsSchema = z.object({
    is_active: z.boolean().optional(),
    is_offline: z.boolean().optional(),
    is_private: z.boolean().optional(),
    is_public: z.boolean().optional(),
    partner_public_key: z.string().optional(),
});

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
        elizaLogger.log("getChannels action handler called with params:", {
            message: _message,
            state,
            options: _options,
            hasCallback: !!callback
        });
        
        try {
            const lightningProvider = await initLightningProvider(runtime);
            elizaLogger.log("LightningProvider initialized successfully");
            
            const action = new GetChannelsAction(lightningProvider);
            elizaLogger.log("GetChannelsAction created");

            // Compose bridge context
            const getChannelsContext = composeContext({
                state,
                template: getChannelsTemplate,
            });
            elizaLogger.log("Bridge context composed:", { context: getChannelsContext });
            
            const content = await generateObject({
                runtime,
                context: getChannelsContext,
                schema: getChannelsSchema as z.ZodType,
                modelClass: ModelClass.LARGE,
            });
            elizaLogger.log("Generated content:", { content });

            const getChannelsContent = content.object as GetChannelsContent;
            elizaLogger.log("Parsed content:", getChannelsContent);

            const result = await action.getChannels(getChannelsContent);
            elizaLogger.log("Channels retrieved successfully:", {
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
                elizaLogger.log("Callback response:", response);
                callback(response);
            }
            return true;
        } catch (error) {
            elizaLogger.error("Error in getChannels handler:", {
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
    template: getChannelsTemplate,
    validate: async (runtime: IAgentRuntime) => {
        elizaLogger.log("Validating getChannels action");
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
                    text: "Show me all active channels",
                    action: "GET_CHANNELS",
                },
            },
        ],
    ],
    similes: ["GET_CHANNELS", "LIST_CHANNELS", "SHOW_CHANNELS"],
};

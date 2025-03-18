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
    }

    async getChannels(params: GetChannelsArgs = {}): Promise<{ channels: Channel[] }> {
        try {
            const { channels } = await this.lightningProvider.getLndChannel();
            
            // 应用过滤条件
            let filteredChannels = channels;
            
            if (params.is_active !== undefined) {
                filteredChannels = filteredChannels.filter(
                    channel => channel.is_active === params.is_active
                );
            }
            
            if (params.is_offline !== undefined) {
                filteredChannels = filteredChannels.filter(
                    channel => !channel.is_active === params.is_offline
                );
            }
            
            if (params.is_private !== undefined) {
                filteredChannels = filteredChannels.filter(
                    channel => channel.is_private === params.is_private
                );
            }
            
            if (params.is_public !== undefined) {
                filteredChannels = filteredChannels.filter(
                    channel => !channel.is_private === params.is_public
                );
            }
            
            if (params.partner_public_key) {
                filteredChannels = filteredChannels.filter(
                    channel => channel.partner_public_key === params.partner_public_key
                );
            }

            elizaLogger.info("Channels retrieved:", {
                total: filteredChannels.length,
                active: filteredChannels.filter(c => c.is_active).length
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
        // elizaLogger.info("getChannels action handler called with params:", {
        //     message: _message,
        //     state,
        //     options: _options,
        //     hasCallback: !!callback
        // });
        
        try {
            const lightningProvider = await initLightningProvider(runtime);
            elizaLogger.info("LightningProvider initialized successfully");
            
            const action = new GetChannelsAction(lightningProvider);
            elizaLogger.info("GetChannelsAction created");

            // Compose bridge context
            const getChannelsContext = composeContext({
                state,
                template: getChannelsTemplate,
            });
            elizaLogger.info("Bridge context composed:", { context: getChannelsContext });
            
            const content = await generateObject({
                runtime,
                context: getChannelsContext,
                schema: getChannelsSchema as z.ZodType,
                modelClass: ModelClass.LARGE,
            });
            elizaLogger.info("Generated content:", { content });

            const getChannelsContent = content.object as GetChannelsContent;
            elizaLogger.info("Parsed content:", getChannelsContent);

            const result = await action.getChannels(getChannelsContent);
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
        elizaLogger.info("Validating getChannels action");
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
                    text: "Show me all active channels",
                    action: "GET_CHANNELS",
                },
            },
        ],
    ],
    similes: ["GET_CHANNELS", "LIST_CHANNELS", "SHOW_CHANNELS"],
};

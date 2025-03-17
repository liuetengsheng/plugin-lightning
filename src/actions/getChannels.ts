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
        const { channels } = await this.lightningProvider.getLndChannel();
        elizaLogger.info(`getLndChannel called with args: ${JSON.stringify(params)}`);
        elizaLogger.info(`getLndChannel called with args: ${JSON.stringify(channels)}`);
        // 应用过滤条件
        let filteredChannels = channels;
        
        // 如果明确指定了 is_active，则直接使用；否则如果指定了 is_offline，则取反过滤
        if (params.is_active !== undefined) {
          filteredChannels = filteredChannels.filter(
            channel => channel.is_active === params.is_active
          );
        } else if (params.is_offline !== undefined) {
          // 如果 is_offline 为 true，表示 offline，即 channel.is_active 应该为 false
          filteredChannels = filteredChannels.filter(
            channel => channel.is_active === !params.is_offline
          );
        }
        
        if (params.is_private !== undefined) {
          filteredChannels = filteredChannels.filter(
            channel => channel.is_private === params.is_private
          );
        }
        
        if (params.is_public !== undefined) {
          // is_public 为 true 表示 channel 公开，即 is_private === false
          filteredChannels = filteredChannels.filter(
            channel => channel.is_private === !params.is_public
          );
        }
        
        if (params.partner_public_key) {
          filteredChannels = filteredChannels.filter(
            channel => channel.partner_public_key === params.partner_public_key
          );
        }
      
        return { channels: filteredChannels };
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
        elizaLogger.log("getChannels action handler called");
        const lightningProvider = await initLightningProvider(runtime);
        const action = new GetChannelsAction(lightningProvider);

        // Compose bridge context
        const getChannelsContext = composeContext({
            state,
            template: getChannelsTemplate,
        });
        
        const content = await generateObject({
            runtime,
            context: getChannelsContext,
            schema: getChannelsSchema as z.ZodType,
            modelClass: ModelClass.LARGE,
        });

        const getChannelsContent = content.object as GetChannelsContent;

        try {
            const result = await action.getChannels(getChannelsContent);
            
            if (callback) {
                const channelSummary = result.channels.map(channel => 
                    `Channel ${channel.id}: ${channel.local_balance} sats local, ${channel.remote_balance} sats remote${channel.is_active ? ' (active)' : ' (inactive)'}`
                ).join('\n');

                callback({
                    text: `Found ${result.channels.length} channels:\n${channelSummary}`,
                    content: { 
                        success: true,
                        channels: result.channels
                    },
                });
            }
            return true;
        } catch (error) {
            elizaLogger.error("Error in getChannels handler:", error);
            if (callback) {
                callback({
                    text: `Error: ${error.message || "An error occurred"}`,
                });
            }
            return false;
        }
    },
    template: getChannelsTemplate,
    validate: async (runtime: IAgentRuntime) => {
        const cert = runtime.getSetting("LND_TLS_CERT");
        const macaroon = runtime.getSetting("LND_MACAROON");
        const socket = runtime.getSetting("LND_SOCKET");
        return !!cert && !!macaroon && !!socket;
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

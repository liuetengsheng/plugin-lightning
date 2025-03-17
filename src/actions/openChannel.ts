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
        return await this.lightningProvider.openChannel(params);
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
        elizaLogger.log("openChannel action handler called");
        const lightningProvider = await initLightningProvider(runtime);
        const action = new OpenChannelAction(lightningProvider);

        // Compose bridge context
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
        if (!openChannelContent.local_tokens || !openChannelContent.partner_public_key) {
            if (callback) {
                callback({
                    text: "Error: local_tokens and partner_public_key are required",
                });
            }
            return false;
        }

        try {
            const result = await action.openChannel(openChannelContent);
            
            if (callback) {
                const addressInfo = openChannelContent.cooperative_close_address 
                    ? `\nCooperative close address: ${openChannelContent.cooperative_close_address}`
                    : "\nUsing automatically fetched cooperative close address";
                
                callback({
                    text: `Successfully opened channel with capacity ${openChannelContent.local_tokens} sats to ${openChannelContent.partner_public_key}.${addressInfo}\nTransaction ID: ${result.transaction_id}, Vout: ${result.transaction_vout}`,
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
            elizaLogger.error("Error in openChannel handler:", error);
            if (callback) {
                callback({
                    text: `Error: ${error.message || "An error occurred"}`,
                });
            }
            return false;
        }
    },
    template: openChannelTemplate,
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
                    text: "Open a channel with 1000000 sats to 03xxxxxx",
                    action: "OPEN_CHANNEL",
                },
            },
        ],
    ],
    similes: ["OPEN_CHANNEL", "CREATE_CHANNEL"],
};

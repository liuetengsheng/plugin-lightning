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
import type { GetChainBalanceResult } from "../types";
import { getChainBalanceTemplate } from "../templates";
import { z } from "zod";

export { getChainBalanceTemplate };

export class GetChainBalanceAction {
    constructor(private lightningProvider: LightningProvider) {
        this.lightningProvider = lightningProvider;
    }

    async getChainBalance(): Promise<GetChainBalanceResult> {
        return await this.lightningProvider.getChainBalance();
    }
}

// 定义 schema 类型
const getChainBalanceSchema = z.object({});

type GetChainBalanceContent = z.infer<typeof getChainBalanceSchema>;

export const getChainBalanceAction = {
    name: "GET_CHAIN_BALANCE",
    description: "Get the total confirmed chain balance.",
    handler: async (
        runtime: IAgentRuntime,
        _message: Memory,
        state: State,
        _options: Record<string, unknown>,
        callback?: (response: {
            text: string;
            content?: { success: boolean; balance?: number };
        }) => void
    ) => {
        elizaLogger.log("getChainBalance action handler called");
        const lightningProvider = await initLightningProvider(runtime);
        const action = new GetChainBalanceAction(lightningProvider);

        // Compose bridge context
        const getChainBalanceContext = composeContext({
            state,
            template: getChainBalanceTemplate,
        });
        
        const content = await generateObject({
            runtime,
            context: getChainBalanceContext,
            schema: getChainBalanceSchema as z.ZodType,
            modelClass: ModelClass.LARGE,
        });

        try {
            const result = await action.getChainBalance();
            
            if (callback) {
                callback({
                    text: `Current chain balance: ${result.chain_balance.toLocaleString()} sats`,
                    content: { 
                        success: true,
                        balance: result.chain_balance
                    },
                });
            }
            return true;
        } catch (error) {
            elizaLogger.error("Error in getChainBalance handler:", error);
            if (callback) {
                callback({
                    text: `Error: ${error.message || "An error occurred"}`,
                });
            }
            return false;
        }
    },
    template: getChainBalanceTemplate,
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
                    text: "Show me my chain balance",
                    action: "GET_CHAIN_BALANCE",
                },
            },
        ],
    ],
    similes: ["GET_CHAIN_BALANCE", "CHECK_BALANCE", "SHOW_BALANCE"],
};

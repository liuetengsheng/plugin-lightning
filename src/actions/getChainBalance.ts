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
        elizaLogger.info("GetChainBalanceAction initialized");
    }

    async getChainBalance(): Promise<GetChainBalanceResult> {
        elizaLogger.info("GetChainBalanceAction.getChainBalance called");
        try {
            const result = await this.lightningProvider.getChainBalance();
            elizaLogger.info("Chain balance retrieved successfully:", {
                chain_balance: result.chain_balance
            });
            return result;
        } catch (error) {
            elizaLogger.error("Error in getChainBalance:", {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
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
        elizaLogger.info("getChainBalance action handler called with params:", {
            message: _message,
            state,
            options: _options,
            hasCallback: !!callback
        });
        
        try {
            const lightningProvider = await initLightningProvider(runtime);
            elizaLogger.info("LightningProvider initialized successfully");
            
            const action = new GetChainBalanceAction(lightningProvider);
            elizaLogger.info("GetChainBalanceAction created");

            // Compose bridge context
            const getChainBalanceContext = composeContext({
                state,
                template: getChainBalanceTemplate,
            });
            elizaLogger.info("Bridge context composed:", { context: getChainBalanceContext });
            
            const content = await generateObject({
                runtime,
                context: getChainBalanceContext,
                schema: getChainBalanceSchema as z.ZodType,
                modelClass: ModelClass.LARGE,
            });
            elizaLogger.info("Generated content:", { content });

            const getChainBalanceContent = content.object as GetChainBalanceContent;
            elizaLogger.info("Parsed content:", getChainBalanceContent);

            const result = await action.getChainBalance();
            elizaLogger.info("Chain balance retrieved successfully:", {
                chain_balance: result.chain_balance
            });
            
            if (callback) {
                const response = {
                    text: `Current chain balance: ${result.chain_balance.toLocaleString()} sats`,
                    content: { 
                        success: true,
                        balance: result.chain_balance
                    },
                };
                elizaLogger.info("Success callback response:", response);
                callback(response);
            }
            return true;
        } catch (error) {
            elizaLogger.error("Error in getChainBalance handler:", {
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
                elizaLogger.info("Error callback response:", errorResponse);
                callback(errorResponse);
            }
            return false;
        }
    },
    template: getChainBalanceTemplate,
    validate: async (runtime: IAgentRuntime) => {
        elizaLogger.info("Validating getChainBalance action");
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
                    text: "Show me my chain balance",
                    action: "GET_CHAIN_BALANCE",
                },
            },
        ],
    ],
    similes: ["GET_CHAIN_BALANCE", "CHECK_BALANCE", "SHOW_BALANCE"],
};

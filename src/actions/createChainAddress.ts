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
import type { CreateChainAddressArgs, CreateChainAddressResult } from "../types";
import { createChainAddressTemplate } from "../templates";
import { z } from "zod";

export { createChainAddressTemplate };

export class CreateChainAddressAction {
    constructor(private lightningProvider: LightningProvider) {
        this.lightningProvider = lightningProvider;
    }

    async createChainAddress(params: CreateChainAddressArgs): Promise<CreateChainAddressResult> {
        try {
            if (params.format && !["p2wpkh", "np2wpkh", "p2tr"].includes(params.format)) {
                elizaLogger.error("Invalid address format", {
                    format: params.format,
                    validFormats: ["p2wpkh", "np2wpkh", "p2tr"]
                });
                throw new Error("Invalid address format. Must be one of: p2wpkh, np2wpkh, p2tr");
            }

            const result = await this.lightningProvider.createChainAddress(params);
            elizaLogger.info("Chain address created:", {
                address: result.address,
                format: params.format || "p2wpkh"
            });
            return result;
        } catch (error) {
            elizaLogger.error("Create chain address failed:", {
                error: error.message,
                stack: error.stack,
                params
            });
            throw error;
        }
    }
}

// 定义 schema 类型
const createChainAddressSchema = z.object({
    format: z.enum(["p2wpkh", "np2wpkh", "p2tr"]).optional(),
    is_unused: z.boolean().optional(),
});

type CreateChainAddressContent = z.infer<typeof createChainAddressSchema>;

export const createChainAddressAction = {
    name: "CREATE_CHAIN_ADDRESS",
    description: "Create a new Bitcoin chain address.",
    handler: async (
        runtime: IAgentRuntime,
        _message: Memory,
        state: State,
        _options: Record<string, unknown>,
        callback?: (response: {
            text: string;
            content?: { success: boolean; address?: string };
        }) => void
    ) => {
        try {
            const lightningProvider = await initLightningProvider(runtime);
            const action = new CreateChainAddressAction(lightningProvider);

            const createChainAddressContext = composeContext({
                state,
                template: createChainAddressTemplate,
            });
            
            const content = await generateObject({
                runtime,
                context: createChainAddressContext,
                schema: createChainAddressSchema as z.ZodType,
                modelClass: ModelClass.LARGE,
            });

            const createChainAddressContent = content.object as CreateChainAddressContent;

            // 验证地址格式
            if (createChainAddressContent.format && 
                !["p2wpkh", "np2wpkh", "p2tr"].includes(createChainAddressContent.format)) {
                elizaLogger.error("Invalid address format", {
                    format: createChainAddressContent.format
                });
                if (callback) {
                    callback({
                        text: "Error: Invalid address format. Must be one of: p2wpkh, np2wpkh, p2tr"
                    });
                }
                return false;
            }

            const result = await action.createChainAddress(createChainAddressContent);
            
            if (callback) {
                const formatInfo = createChainAddressContent.format 
                    ? ` (${createChainAddressContent.format})`
                    : " (p2wpkh)";
                    
                callback({
                    text: `Successfully created new chain address${formatInfo}: ${result.address}`,
                    content: { 
                        success: true,
                        address: result.address
                    },
                });
            }
            return true;
        } catch (error) {
            elizaLogger.error("Create chain address failed:", error);
            if (callback) {
                callback({
                    text: `Error: ${error.message || "An error occurred"}`
                });
            }
            return false;
        }
    },
    template: createChainAddressTemplate,
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
                    text: "Create a new p2wpkh address",
                    action: "CREATE_CHAIN_ADDRESS",
                },
            },
        ],
    ],
    similes: ["CREATE_CHAIN_ADDRESS", "NEW_ADDRESS", "GENERATE_ADDRESS"],
};





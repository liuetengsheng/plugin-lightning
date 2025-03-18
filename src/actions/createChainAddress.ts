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
        elizaLogger.log("CreateChainAddressAction initialized");
    }

    async createChainAddress(params: CreateChainAddressArgs): Promise<CreateChainAddressResult> {
        elizaLogger.log("CreateChainAddressAction.createChainAddress called with params:", {
            format: params.format || "p2wpkh",
            is_unused: params.is_unused
        });

        try {
            // 验证参数格式
            if (params.format && !["p2wpkh", "np2wpkh", "p2tr"].includes(params.format)) {
                elizaLogger.error("Validation failed: Invalid address format", {
                    format: params.format,
                    validFormats: ["p2wpkh", "np2wpkh", "p2tr"]
                });
                throw new Error("Invalid address format. Must be one of: p2wpkh, np2wpkh, p2tr");
            }

            const result = await this.lightningProvider.createChainAddress(params);
            elizaLogger.log("Chain address created successfully:", {
                address: result.address,
                format: params.format || "p2wpkh",
                is_unused: params.is_unused
            });
            return result;
        } catch (error) {
            elizaLogger.error("Error in createChainAddress:", {
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
        elizaLogger.log("createChainAddress action handler called with params:", {
            message: _message,
            state,
            options: _options,
            hasCallback: !!callback
        });
        
        try {
            const lightningProvider = await initLightningProvider(runtime);
            elizaLogger.log("LightningProvider initialized successfully");
            
            const action = new CreateChainAddressAction(lightningProvider);
            elizaLogger.log("CreateChainAddressAction created");

            // Compose bridge context
            const createChainAddressContext = composeContext({
                state,
                template: createChainAddressTemplate,
            });
            elizaLogger.log("Bridge context composed:", { context: createChainAddressContext });
            
            const content = await generateObject({
                runtime,
                context: createChainAddressContext,
                schema: createChainAddressSchema as z.ZodType,
                modelClass: ModelClass.LARGE,
            });
            elizaLogger.log("Generated content:", { content });

            const createChainAddressContent = content.object as CreateChainAddressContent;
            elizaLogger.log("Parsed content:", createChainAddressContent);

            // 验证地址格式
            if (createChainAddressContent.format && 
                !["p2wpkh", "np2wpkh", "p2tr"].includes(createChainAddressContent.format)) {
                elizaLogger.error("Validation failed: Invalid address format", {
                    format: createChainAddressContent.format,
                    validFormats: ["p2wpkh", "np2wpkh", "p2tr"]
                });
                if (callback) {
                    const errorResponse = {
                        text: "Error: Invalid address format. Must be one of: p2wpkh, np2wpkh, p2tr",
                    };
                    elizaLogger.log("Error callback response:", errorResponse);
                    callback(errorResponse);
                }
                return false;
            }

            const result = await action.createChainAddress(createChainAddressContent);
            elizaLogger.log("Chain address created successfully:", {
                address: result.address,
                format: createChainAddressContent.format || "p2wpkh",
                is_unused: createChainAddressContent.is_unused
            });
            
            if (callback) {
                const formatInfo = createChainAddressContent.format 
                    ? ` (${createChainAddressContent.format})`
                    : " (p2wpkh)";
                    
                const response = {
                    text: `Successfully created new chain address${formatInfo}: ${result.address}`,
                    content: { 
                        success: true,
                        address: result.address
                    },
                };
                elizaLogger.log("Success callback response:", response);
                callback(response);
            }
            return true;
        } catch (error) {
            elizaLogger.error("Error in createChainAddress handler:", {
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
    template: createChainAddressTemplate,
    validate: async (runtime: IAgentRuntime) => {
        elizaLogger.log("Validating createChainAddress action");
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
                    text: "Create a new p2wpkh address",
                    action: "CREATE_CHAIN_ADDRESS",
                },
            },
        ],
    ],
    similes: ["CREATE_CHAIN_ADDRESS", "NEW_ADDRESS", "GENERATE_ADDRESS"],
};





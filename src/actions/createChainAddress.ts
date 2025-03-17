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
        return await this.lightningProvider.createChainAddress(params);
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
        elizaLogger.log("createChainAddress action handler called");
        const lightningProvider = await initLightningProvider(runtime);
        const action = new CreateChainAddressAction(lightningProvider);

        // Compose bridge context
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

        try {
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
            elizaLogger.error("Error in createChainAddress handler:", error);
            if (callback) {
                callback({
                    text: `Error: ${error.message || "An error occurred"}`,
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
        return !!cert && !!macaroon && !!socket;
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





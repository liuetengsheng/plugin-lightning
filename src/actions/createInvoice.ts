import type { IAgentRuntime, Memory, State } from "@elizaos/core";
import {
    composeContext,
    generateObjectDeprecated,
    ModelClass,
    elizaLogger,
} from "@elizaos/core";

import {
    initLightningProvider,
    type LightningProvider,
} from "../providers/lightning";

import { createInvoiceTemplate } from "../templates";
import type { CreateInvoiceResult } from "astra-lightning";
import type { CreateInvoiceArgs } from "../types";
export { createInvoiceTemplate };

export class CreateInvoiceAction {
    constructor(private lightningProvider: LightningProvider) {
        this.lightningProvider = lightningProvider;
        elizaLogger.log("CreateInvoiceAction initialized");
    }

    async createInvoice(
        params: CreateInvoiceArgs,
    ): Promise<CreateInvoiceResult> {
        elizaLogger.log("CreateInvoiceAction.createInvoice called with params:", params);
        if (!params.tokens) {
            elizaLogger.error("CreateInvoiceAction.createInvoice validation failed: tokens is required");
            throw new Error("tokens is required.");
        }
        try {
            const retCreateInvoice =
                await this.lightningProvider.createInvoice(params);
            elizaLogger.log("CreateInvoiceAction.createInvoice result:", {
                tokens: retCreateInvoice.tokens,
                request: retCreateInvoice.request,
                id: retCreateInvoice.id
            });
            return retCreateInvoice;
        } catch (error) {
            elizaLogger.error("CreateInvoiceAction.createInvoice error:", {
                error: error.message,
                stack: error.stack,
                params
            });
            throw error;
        }
    }
}

export const createInvoiceAction = {
    name: "CREATE_INVOICE",
    description: "Create a Lightning invoice.",
    handler: async (
        runtime: IAgentRuntime,
        _message: Memory,
        state: State,
        _options: Record<string, unknown>,
        callback?: (response: {
            text: string;
            content?: { success: boolean; invoice?: string };
        }) => void,
    ) => {
        elizaLogger.log("CreateInvoice action handler called with params:", {
            message: _message,
            state,
            options: _options,
            hasCallback: !!callback
        });
        
        try {
            const lightningProvider = await initLightningProvider(runtime);
            elizaLogger.log("LightningProvider initialized successfully");
            
            const action = new CreateInvoiceAction(lightningProvider);
            elizaLogger.log("CreateInvoiceAction created");

            // Compose bridge context
            const createInvoiceContext = composeContext({
                state,
                template: createInvoiceTemplate,
            });
            elizaLogger.log("Bridge context composed:", { context: createInvoiceContext });
            
            const content = await generateObjectDeprecated({
                runtime,
                context: createInvoiceContext,
                modelClass: ModelClass.LARGE,
            });
            elizaLogger.log("Generated content:", { content });

            const createInvoiceOptions = {
                tokens: content.tokens,
            };
            elizaLogger.log("Parsed invoice options:", createInvoiceOptions);

            const createInvoiceResp =
                await action.createInvoice(createInvoiceOptions);
            elizaLogger.log("Invoice created successfully:", {
                tokens: createInvoiceResp.tokens,
                request: createInvoiceResp.request,
                id: createInvoiceResp.id
            });

            if (callback) {
                const response = {
                    text: `Successfully created invoice for ${createInvoiceResp.tokens.toLocaleString()} sats\r\nInvoice: ${createInvoiceResp.request}`,
                    content: {
                        success: true,
                        invoice: createInvoiceResp.request,
                    },
                };
                elizaLogger.log("Callback response:", response);
                callback(response);
            }
            return true;
        } catch (error) {
            elizaLogger.error("Error in CreateInvoice handler:", {
                error: error.message,
                stack: error.stack,
                message: _message,
                state,
                options: _options
            });
            if (callback) {
                const errorResponse = {
                    text: `Error: ${error.message}`,
                };
                elizaLogger.log("Error callback response:", errorResponse);
                callback(errorResponse);
            }
            return false;
        }
    },
    template: createInvoiceTemplate,
    validate: async (runtime: IAgentRuntime) => {
        elizaLogger.log("Validating CreateInvoice action");
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
                    text: "Create an invoice for 1000 sats",
                    action: "CREATE_INVOICE",
                },
            },
        ],
    ],
    similes: ["CREATE_INVOICE"],
};

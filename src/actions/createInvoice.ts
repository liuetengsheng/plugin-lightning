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
        elizaLogger.info("CreateInvoiceAction initialized");
    }

    async createInvoice(
        params: CreateInvoiceArgs,
    ): Promise<CreateInvoiceResult> {
        elizaLogger.info("CreateInvoiceAction.createInvoice called with params:", params);
        if (!params.tokens) {
            elizaLogger.error("CreateInvoiceAction.createInvoice validation failed: tokens is required");
            throw new Error("tokens is required.");
        }
        try {
            const retCreateInvoice =
                await this.lightningProvider.createInvoice(params);
            elizaLogger.info("CreateInvoiceAction.createInvoice result:", {
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
        // elizaLogger.info("CreateInvoice action handler called with params:", {
        //     message: _message,
        //     state,
        //     options: _options,
        //     hasCallback: !!callback
        // });
        
        try {
            const lightningProvider = await initLightningProvider(runtime);
            elizaLogger.info("LightningProvider initialized successfully");
            
            const action = new CreateInvoiceAction(lightningProvider);
            elizaLogger.info("CreateInvoiceAction created");

            // Compose bridge context
            const createInvoiceContext = composeContext({
                state,
                template: createInvoiceTemplate,
            });
            elizaLogger.info("Bridge context composed:", { context: createInvoiceContext });
            
            const content = await generateObjectDeprecated({
                runtime,
                context: createInvoiceContext,
                modelClass: ModelClass.LARGE,
            });
            elizaLogger.info("Generated content:", { content });

            const createInvoiceOptions = {
                tokens: content.tokens,
            };
            elizaLogger.info("Parsed invoice options:", createInvoiceOptions);

            const createInvoiceResp =
                await action.createInvoice(createInvoiceOptions);
            elizaLogger.info("Invoice created successfully:", {
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
                elizaLogger.info("Callback response:", response);
                callback(response);
            }
            return true;
        } catch (error) {
            elizaLogger.error("Error in CreateInvoice handler:", {
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
    template: createInvoiceTemplate,
    validate: async (runtime: IAgentRuntime) => {
        elizaLogger.info("Validating CreateInvoice action");
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
                    text: "Create an invoice for 1000 sats",
                    action: "CREATE_INVOICE",
                },
            },
        ],
    ],
    similes: ["CREATE_INVOICE"],
};

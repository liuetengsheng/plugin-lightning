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
import type { PayResult } from "astra-lightning";
import type { PayArgs } from "../types";
import { payInvoiceTemplate } from "../templates";
import { z } from "zod";

export { payInvoiceTemplate };

type ExtendedPayResult = PayResult & { outgoing_channel: string };
export class PayInvoiceAction {
    constructor(private lightningProvider: LightningProvider) {
        this.lightningProvider = lightningProvider;
        elizaLogger.info("PayInvoiceAction initialized");
    }

    async getAvalibleChannelId(): Promise<string> {
        elizaLogger.info("PayInvoiceAction.getAvalibleChannelId called");
        try {
            const { channels } = await this.lightningProvider.getLndChannel();
            elizaLogger.info("Retrieved channels:", { 
                totalChannels: channels.length,
                activeChannels: channels.filter(c => c.is_active).length
            });
            
            const filteredActiveChannels = channels.filter(
                (channel) => channel.is_active === true
            );
            elizaLogger.info("Filtered active channels:", {
                count: filteredActiveChannels.length
            });
            
            const sortedChannels = filteredActiveChannels.sort(
                (a, b) => b.local_balance - a.local_balance
            );
            elizaLogger.info("Sorted channels by local balance:", {
                count: sortedChannels.length,
                topBalance: sortedChannels[0]?.local_balance
            });
            
            if (sortedChannels.length > 0) {
                const channelId = sortedChannels[0].id;
                elizaLogger.info("Selected channel ID:", { channelId });
                return channelId;
            }
            elizaLogger.warn("No available channels found");
            return "";
        } catch (error) {
            elizaLogger.error("Error in getAvalibleChannelId:", {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    async payInvoice(params: PayArgs): Promise<ExtendedPayResult> {
        elizaLogger.info("PayInvoiceAction.payInvoice called with params:", {
            request: params.request,
            outgoing_channel: params.outgoing_channel
        });
        
        try {
            const outgoing_channel = await this.getAvalibleChannelId();
            if (!outgoing_channel) {
                elizaLogger.error("No available channel found for payment");
                throw new Error("no avalible channel");
            }
            
            elizaLogger.info("Selected outgoing channel:", { outgoing_channel });
            
            const requestArgs = {
                outgoing_channel: outgoing_channel,
                ...params,
            };
            elizaLogger.info("Constructed payment request args:", {
                outgoing_channel: requestArgs.outgoing_channel,
                request: requestArgs.request
            });
            
            const retPayInvoice = await this.lightningProvider.payInvoice(
                requestArgs
            );
            elizaLogger.info("Payment result:", {
                id: retPayInvoice.id,
                is_confirmed: retPayInvoice.is_confirmed,
                tokens: retPayInvoice.tokens,
                fee: retPayInvoice.fee
            });
            
            return {
                ...retPayInvoice,
                outgoing_channel: outgoing_channel,
            };
        } catch (error) {
            elizaLogger.error("Error in payInvoice:", {
                error: error.message,
                stack: error.stack,
                params
            });
            throw error;
        }
    }
}

// Define the schema type
const payInvoiceSchema = z.object({
    request: z.string(),
});

type PayInvoiceContent = z.infer<typeof payInvoiceSchema>;

export const payInvoiceAction = {
    name: "PAY_INVOICE",
    description: "Make a payment.",
    handler: async (
        runtime: IAgentRuntime,
        _message: Memory,
        state: State,
        _options: Record<string, unknown>,
        callback?: (response: {
            text: string;
            content?: { success: boolean };
        }) => void
    ) => {
        // elizaLogger.info("payInvoice action handler called with params:", {
        //     message: _message,
        //     state,
        //     options: _options,
        //     hasCallback: !!callback
        // });
        
        try {
            const lightningProvider = await initLightningProvider(runtime);
            elizaLogger.info("LightningProvider initialized successfully");
            
            const action = new PayInvoiceAction(lightningProvider);
            elizaLogger.info("PayInvoiceAction created");

            // Compose bridge context
            const payInvoiceContext = composeContext({
                state,
                template: payInvoiceTemplate,
            });
            elizaLogger.info("Bridge context composed:", { context: payInvoiceContext });
            
            const content = await generateObject({
                runtime,
                context: payInvoiceContext,
                schema: payInvoiceSchema as z.ZodType,
                modelClass: ModelClass.LARGE,
            });
            elizaLogger.info("Generated content:", { content });

            const payInvoiceContent = content.object as PayInvoiceContent;
            elizaLogger.info("Parsed content:", payInvoiceContent);

            const payInvoiceOptions: PayArgs = {
                request: payInvoiceContent.request,
            };
            elizaLogger.info("Constructed payment options:", payInvoiceOptions);

            const payInvoiceResp = await action.payInvoice(payInvoiceOptions);
            elizaLogger.info("Payment completed:", {
                is_confirmed: payInvoiceResp.is_confirmed,
                tokens: payInvoiceResp.tokens,
                fee: payInvoiceResp.fee,
                outgoing_channel: payInvoiceResp.outgoing_channel
            });

            if (callback) {
                if (payInvoiceResp.is_confirmed) {
                    const response = {
                        text: `Successfully paid invoice ${payInvoiceContent.request} from ${payInvoiceResp.outgoing_channel};\nAmount: ${payInvoiceResp.tokens};\nFee: ${payInvoiceResp.fee};\nPayment Hash: ${payInvoiceResp.id};`,
                        content: { success: true },
                    };
                    elizaLogger.info("Success callback response:", response);
                    callback(response);
                } else {
                    const response = {
                        text: `Failed to payInvoice ${payInvoiceContent.request} from ${payInvoiceContent.outgoing_channel};\r\n Amount: ${payInvoiceResp.tokens};`,
                        content: {
                            success: false,
                        },
                    };
                    elizaLogger.info("Failure callback response:", response);
                    callback(response);
                }
            }
            return true;
        } catch (error) {
            elizaLogger.error("Error in payInvoice handler:", {
                error: typeof error === 'object' ? error : { message: String(error) },
                errorString: String(error),
                errorJSON: JSON.stringify(error, Object.getOwnPropertyNames(error)),
                stack: error?.stack
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
    template: payInvoiceTemplate,
    validate: async (runtime: IAgentRuntime) => {
        elizaLogger.info("Validating payInvoice action");
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
                    text: "Pay invoice for lnbrc...",
                    action: "PAY_INVOICE",
                },
            },
        ],
    ],
    similes: ["PAY_INVOICE", "MAKE_PAYMENT"],
};

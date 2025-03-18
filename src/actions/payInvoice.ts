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
    }

    async getAvalibleChannelId(): Promise<string> {
        try {
            const { channels } = await this.lightningProvider.getLndChannel();
            
            const filteredActiveChannels = channels.filter(
                (channel) => channel.is_active === true
            );
            
            const sortedChannels = filteredActiveChannels.sort(
                (a, b) => b.local_balance - a.local_balance
            );
            
            if (sortedChannels.length > 0) {
                const channelId = sortedChannels[0].id;
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
        try {
            const outgoing_channel = await this.getAvalibleChannelId();
            if (!outgoing_channel) {
                elizaLogger.error("No available channel found for payment");
                throw new Error("no avalible channel");
            }
            
            elizaLogger.info("Payment request:", {
                request: params.request,
                outgoing_channel
            });
            
            const requestArgs = {
                outgoing_channel,
                ...params,
            };
            
            const retPayInvoice = await this.lightningProvider.payInvoice(
                requestArgs
            );
            elizaLogger.info("Payment completed:", {
                id: retPayInvoice.id,
                is_confirmed: retPayInvoice.is_confirmed,
                tokens: retPayInvoice.tokens,
                fee: retPayInvoice.fee
            });
            
            return {
                ...retPayInvoice,
                outgoing_channel,
            };
        } catch (error) {
            elizaLogger.error("Error in payInvoice:", {
                error: error.message,
                stack: error.stack,
                request: params.request
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
        try {
            const lightningProvider = await initLightningProvider(runtime);
            const action = new PayInvoiceAction(lightningProvider);

            // Compose bridge context
            const payInvoiceContext = composeContext({
                state,
                template: payInvoiceTemplate,
            });
            
            const content = await generateObject({
                runtime,
                context: payInvoiceContext,
                schema: payInvoiceSchema as z.ZodType,
                modelClass: ModelClass.LARGE,
            });

            const payInvoiceContent = content.object as PayInvoiceContent;

            const payInvoiceOptions: PayArgs = {
                request: payInvoiceContent.request,
            };

            const payInvoiceResp = await action.payInvoice(payInvoiceOptions);

            if (callback) {
                if (payInvoiceResp.is_confirmed) {
                    const response = {
                        text: `Successfully paid invoice ${payInvoiceContent.request} from ${payInvoiceResp.outgoing_channel};\nAmount: ${payInvoiceResp.tokens};\nFee: ${payInvoiceResp.fee};\nPayment Hash: ${payInvoiceResp.id};`,
                        content: { success: true },
                    };
                    callback(response);
                } else {
                    const response = {
                        text: `Failed to payInvoice ${payInvoiceContent.request} from ${payInvoiceContent.outgoing_channel};\r\n Amount: ${payInvoiceResp.tokens};`,
                        content: {
                            success: false,
                        },
                    };
                    callback(response);
                }
            }
            return true;
        } catch (error) {
            elizaLogger.error("Error in payInvoice handler:", {
                error: error.message,
                stack: error.stack
            });
            if (callback) {
                const errorResponse = {
                    text: `Error: ${error.message || "An error occurred"}`,
                };
                callback(errorResponse);
            }
            return false;
        }
    },
    template: payInvoiceTemplate,
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
                    text: "Pay invoice for lnbrc...",
                    action: "PAY_INVOICE",
                },
            },
        ],
    ],
    similes: ["PAY_INVOICE", "MAKE_PAYMENT"],
};

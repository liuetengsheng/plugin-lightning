export * from "./actions/createInvoice";
export * from "./providers/lightning";
export * from "./types";

import type { Plugin } from "@elizaos/core";
import { createInvoiceAction } from "./actions/createInvoice";
import { payInvoiceAction } from "./actions/payInvoice";
import { getChannelsAction } from "./actions/getChannels";
import { closeChannelAction } from "./actions/closeChannel";
import { openChannelAction } from "./actions/openChannel";
import { createChainAddressAction } from "./actions/createChainAddress";
import { getChainBalanceAction } from "./actions/getChainBalance";

export const lightningPlugin: Plugin = {
    name: "lightning",
    description: "lightning integration plugin",
    actions: [
        createInvoiceAction, 
        payInvoiceAction, 
        getChannelsAction,
        closeChannelAction,
        openChannelAction,
        createChainAddressAction,
        getChainBalanceAction
    ],
};

export default lightningPlugin;

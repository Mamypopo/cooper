import { validateSignature, messagingApi, webhook } from "@line/bot-sdk";

if (!process.env.LINE_CHANNEL_SECRET || !process.env.LINE_CHANNEL_ACCESS_TOKEN) {
  throw new Error("Missing LINE env vars");
}

export const lineConfig = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
};

export const lineClient = new messagingApi.MessagingApiClient({
  channelAccessToken: lineConfig.channelAccessToken,
});

export function verifyLineSignature(body: string, signature: string): boolean {
  return validateSignature(body, lineConfig.channelSecret, signature);
}

export async function replyText(replyToken: string, text: string) {
  return lineClient.replyMessage({
    replyToken,
    messages: [{ type: "text", text }],
  });
}

export async function replyFlex(
  replyToken: string,
  altText: string,
  contents: messagingApi.FlexContainer
) {
  return lineClient.replyMessage({
    replyToken,
    messages: [{ type: "flex", altText, contents }],
  });
}

export async function pushText(userId: string, text: string) {
  return lineClient.pushMessage({
    to: userId,
    messages: [{ type: "text", text }],
  });
}

export async function pushFlex(
  userId: string,
  altText: string,
  contents: messagingApi.FlexContainer
) {
  return lineClient.pushMessage({
    to: userId,
    messages: [{ type: "flex", altText, contents }],
  });
}

export type LineMessageEvent = webhook.MessageEvent;
export type LineTextMessage = webhook.TextMessageContent;
export type LineWebhookBody = webhook.CallbackRequest;

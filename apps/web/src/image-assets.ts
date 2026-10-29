import type { Conversation, ImageLocation } from './image-studio';

export type ImageAsset = ImageLocation & { name: string; data: string; prompt: string; created: number };

export function collectImageAssets(conversations: Conversation[]): ImageAsset[] {
  return conversations.flatMap(conversation => conversation.turns.flatMap(turn =>
    turn.state === 'complete' ? turn.images.map(image => ({
      conversationId: conversation.id, turnId: turn.id, imageId: image.id,
      name: image.name, data: image.data, prompt: turn.prompt, created: turn.created,
    })) : [],
  )).sort((a, b) => b.created - a.created);
}

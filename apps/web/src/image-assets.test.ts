import { describe, expect, it } from 'vitest';
import { collectImageAssets } from './image-assets';
import type { Conversation } from './image-studio';

describe('generated image assets', () => {
  it('collects all completed images in newest-first order and keeps their conversation locations', () => {
    const settings = { model: 'test', ratio: '1:1', resolution: '1K', count: 1 };
    const conversations: Conversation[] = [
      { id: 'old', title: 'old', updated: 30, turns: [
        { id: 'older', prompt: 'older prompt', references: [], settings, images: [{ id: 'one', name: 'one', data: 'image-one' }], state: 'complete', created: 10 },
        { id: 'pending', prompt: 'pending', references: [], settings, images: [{ id: 'ignored', name: 'ignored', data: 'image' }], state: 'running', created: 40 },
      ] },
      { id: 'new', title: 'new', updated: 20, turns: [
        { id: 'newer', prompt: 'newer prompt', references: [], settings, images: [{ id: 'two', name: 'two', data: 'image-two' }, { id: 'three', name: 'three', data: 'image-three' }], state: 'complete', created: 20 },
      ] },
    ];
    const assets = collectImageAssets(conversations);
    expect(assets.map(asset => asset.imageId)).toEqual(['two', 'three', 'one']);
    expect(assets[0]).toMatchObject({ conversationId: 'new', turnId: 'newer', prompt: 'newer prompt', data: 'image-two' });
    expect(collectImageAssets([])).toEqual([]);
  });
});

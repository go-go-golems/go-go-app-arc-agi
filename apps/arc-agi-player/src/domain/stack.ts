import type { CardDefinition, CardStackDefinition } from '@hypercard/engine';
import { ARC_DEMO_PLUGIN_BUNDLE } from './pluginBundle';

interface PluginCardMeta {
  id: string;
  title: string;
  icon: string;
}

const ARC_DEMO_CARD_META: PluginCardMeta[] = [{ id: 'home', title: 'ARC Demo', icon: '🎮' }];

function toPluginCard(card: PluginCardMeta): CardDefinition {
  return {
    id: card.id,
    type: 'plugin',
    title: card.title,
    icon: card.icon,
    ui: {
      t: 'text',
      value: `Plugin card placeholder: ${card.id}`,
    },
  };
}

export const ARC_DEMO_STACK: CardStackDefinition = {
  id: 'arc-agi-demo',
  name: 'ARC-AGI Demo',
  icon: '🎮',
  homeCard: 'home',
  plugin: {
    bundleCode: ARC_DEMO_PLUGIN_BUNDLE,
    capabilities: {
      domain: ['arc'],
      system: ['notify'],
    },
  },
  cards: Object.fromEntries(ARC_DEMO_CARD_META.map((card) => [card.id, toPluginCard(card)])),
};

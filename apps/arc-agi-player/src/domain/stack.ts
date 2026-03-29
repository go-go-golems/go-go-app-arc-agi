import type { RuntimeSurfaceMeta, RuntimeBundleDefinition } from '@go-go-golems/os-core';
import { ARC_DEMO_PLUGIN_BUNDLE } from './pluginBundle';

interface PluginCardMeta {
  id: string;
  title: string;
  icon: string;
}

const ARC_DEMO_CARD_META: PluginCardMeta[] = [{ id: 'home', title: 'ARC Demo', icon: '🎮' }];

function toPluginCard(card: PluginCardMeta): RuntimeSurfaceMeta {
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

export const ARC_DEMO_STACK: RuntimeBundleDefinition = {
  id: 'arc-agi-demo',
  name: 'ARC-AGI Demo',
  icon: '🎮',
  homeSurface: 'home',
  plugin: {
    packageIds: ['ui'],
    bundleCode: ARC_DEMO_PLUGIN_BUNDLE,
    capabilities: {
      domain: ['arc', 'arcBridge'],
      system: ['notify.show'],
    },
  },
  surfaces: Object.fromEntries(ARC_DEMO_CARD_META.map((card) => [card.id, toPluginCard(card)])),
};

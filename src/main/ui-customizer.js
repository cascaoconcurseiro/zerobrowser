'use strict';

const { UntouchableCoreError } = require('./command-registry');

const SAFE_DEFAULT_LAYOUT = Object.freeze({
  theme: 'dark',
  density: 'comfortable',
  delegationPanelPosition: 'left',
  delegationPanelWidth: 420,
  showBookmarksBar: false,
  accentColor: '#168f72',
  // Elementos do núcleo intocável são SEMPRE visíveis (true) e não podem ser ocultados
  stopAllVisible: true,
  controlIndicatorVisible: true,
  approvalCardVisible: true,
  botCentralTriggerVisible: true
});

const FORBIDDEN_UI_KEYS = new Set([
  'stopAllVisible',
  'controlIndicatorVisible',
  'approvalCardVisible',
  'botCentralTriggerVisible',
  'hideStopAll',
  'hideControlIndicator',
  'hideApprovalCard',
  'hideBotCentral'
]);

class VersionedUiCustomizer {
  constructor() {
    this.currentLayout = { ...SAFE_DEFAULT_LAYOUT };
    this.versions = [
      {
        version: 1,
        description: 'Layout padrão seguro',
        snapshot: { ...SAFE_DEFAULT_LAYOUT },
        createdAt: new Date().toISOString()
      }
    ];
    this.safeMode = false;
  }

  getCurrentLayout() {
    return this.safeMode ? { ...SAFE_DEFAULT_LAYOUT } : { ...this.currentLayout };
  }

  previewChanges(patch = {}) {
    this._assertCoreNotTouched(patch);
    const next = {
      ...this.currentLayout,
      ...this._sanitizePatch(patch)
    };
    return {
      before: { ...this.currentLayout },
      after: next
    };
  }

  applyChanges(patch = {}, { description = 'Personalização visual' } = {}) {
    this._assertCoreNotTouched(patch);
    const clean = this._sanitizePatch(patch);
    this.currentLayout = {
      ...this.currentLayout,
      ...clean,
      stopAllVisible: true,
      controlIndicatorVisible: true,
      approvalCardVisible: true,
      botCentralTriggerVisible: true
    };
    this.safeMode = false;
    const entry = {
      version: this.versions.length + 1,
      description: String(description),
      snapshot: { ...this.currentLayout },
      createdAt: new Date().toISOString()
    };
    this.versions.push(entry);
    return structuredClone(entry);
  }

  rollbackPreviousLayout() {
    if (this.versions.length <= 1) {
      this.currentLayout = { ...SAFE_DEFAULT_LAYOUT };
      return { ...this.currentLayout };
    }
    this.versions.pop();
    const prev = this.versions[this.versions.length - 1];
    this.currentLayout = { ...prev.snapshot };
    this.safeMode = false;
    return { ...this.currentLayout };
  }

  enterSafeMode() {
    this.safeMode = true;
    return { ...SAFE_DEFAULT_LAYOUT };
  }

  _assertCoreNotTouched(patch = {}) {
    for (const [key, val] of Object.entries(patch || {})) {
      const isHideKey = /^hide/i.test(key);
      if (FORBIDDEN_UI_KEYS.has(key) && ((isHideKey && val !== false) || (!isHideKey && val !== true))) {
        throw new UntouchableCoreError(
          `O comando visual "${key}" não pode ocultar elementos do núcleo intocável.`,
          `ui.${key}`
        );
      }
    }
  }

  _sanitizePatch(patch = {}) {
    const allowed = {};
    if (patch.theme === 'light' || patch.theme === 'dark' || patch.theme === 'system') {
      allowed.theme = patch.theme;
    }
    if (patch.density === 'compact' || patch.density === 'comfortable') {
      allowed.density = patch.density;
    }
    if (patch.delegationPanelPosition === 'left' || patch.delegationPanelPosition === 'right') {
      allowed.delegationPanelPosition = patch.delegationPanelPosition;
    }
    if (Number.isFinite(Number(patch.delegationPanelWidth))) {
      allowed.delegationPanelWidth = Math.min(640, Math.max(160, Math.round(Number(patch.delegationPanelWidth))));
    }
    if (typeof patch.showBookmarksBar === 'boolean') {
      allowed.showBookmarksBar = patch.showBookmarksBar;
    }
    if (typeof patch.accentColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(patch.accentColor)) {
      allowed.accentColor = patch.accentColor;
    }
    return allowed;
  }
}

module.exports = {
  SAFE_DEFAULT_LAYOUT,
  VersionedUiCustomizer
};

import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, normalizeSettings, rememberEarphones } from './settings';

describe('song earphone choice in the device settings (D-101)', () => {
  it('test_normalizeSettings_olderSettingsWithoutEarphonesByOutput_fillsEmptyMapAndKeepsTheRest', () => {
    const { earphonesByOutput: _dropped, ...older } = DEFAULT_SETTINGS;

    const settings = normalizeSettings({ ...older, theme: 'light', strictness: 'strict' });

    expect(settings).toMatchObject({ theme: 'light', strictness: 'strict', earphonesByOutput: {} });
  });

  it('test_normalizeSettings_storedEarphonesByOutput_readsBackPerOutputLabel', () => {
    const stored = {
      ...DEFAULT_SETTINGS,
      earphonesByOutput: { 'USB 헤드폰': true, 'MacBook 스피커': false },
    };

    const settings = normalizeSettings(JSON.parse(JSON.stringify(stored)));

    expect(settings.earphonesByOutput).toEqual({ 'USB 헤드폰': true, 'MacBook 스피커': false });
  });

  it('test_rememberEarphones_newLabel_addsItAndKeepsOtherOutputs', () => {
    const settings = { ...DEFAULT_SETTINGS, earphonesByOutput: { 'MacBook 스피커': false } };

    const patch = rememberEarphones(settings, { outputLabel: 'USB DAC', earphones: true });

    expect(patch).toEqual({ earphonesByOutput: { 'MacBook 스피커': false, 'USB DAC': true } });
  });

  it('test_rememberEarphones_sameLabel_overwritesTheEarlierChoice', () => {
    const settings = { ...DEFAULT_SETTINGS, earphonesByOutput: { 'USB DAC': true } };

    const patch = rememberEarphones(settings, { outputLabel: 'USB DAC', earphones: false });

    expect(patch.earphonesByOutput).toEqual({ 'USB DAC': false });
  });
});

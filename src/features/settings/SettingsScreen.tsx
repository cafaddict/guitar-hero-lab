import { useEffect, useRef, useState } from 'react';
import { defaultActionForKey, defaultKeysFor, letterOfCode } from '../../app/keys';
import { persistentStorageGranted, requestPersistentStorage } from '../../app/persist';
import { repo } from '../../app/services';
import { useSettingsStore } from '../../app/settingsStore';
import { LAST_BACKUP_KEY } from '../../app/storedState';
import { applyImport, exportAll, exportFileName } from '../../data/exportImport';
import {
  type BackupPreview,
  createFullBackup,
  fullBackupFileName,
  parseBackupFile,
} from '../../data/fullBackup';
import { KEY_ACTIONS, type KeyAction, type Settings } from '../../data/settings';
import { dayKey } from '../../domain/records';
import { ko } from '../../i18n/ko';
import { Button, ButtonLink } from '../../ui/Button';
import { Card, CardHeader } from '../../ui/Card';
import { Choice, Field, Select, TextInput } from '../../ui/Field';
import { Phrases } from '../../ui/Phrases';
import { Screen } from '../../ui/Screen';
import { readFiles, removeAllFiles, saveFiles } from '../recording/opfs';

function download(name: string, data: string | Uint8Array, type: string): void {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Toggle({
  label,
  checked,
  onChange,
  testId,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  testId?: string;
}) {
  return (
    <Choice
      type="checkbox"
      label={label}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      data-testid={testId}
    />
  );
}

const SESSION_MINUTES = { min: 5, max: 90 } as const;

/** Number field that lets the user type through out-of-range intermediate values ("1" on the way to "15"). */
function MinutesInput({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (minutes: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const valid = (text: string) => {
    const v = Number(text);
    return Number.isInteger(v) && v >= SESSION_MINUTES.min && v <= SESSION_MINUTES.max ? v : null;
  };
  return (
    <Field label={label}>
      <TextInput
        type="number"
        min={SESSION_MINUTES.min}
        max={SESSION_MINUTES.max}
        className="w-32"
        value={draft ?? String(value)}
        onChange={(e) => {
          setDraft(e.target.value);
          const v = valid(e.target.value);
          if (v !== null) onCommit(v);
        }}
        onBlur={() => setDraft(null)}
      />
    </Field>
  );
}

function BackupSection() {
  const [lastBackup, setLastBackup] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [persisted, setPersisted] = useState(persistentStorageGranted());
  const file = useRef<HTMLInputElement>(null);
  const load = useSettingsStore((s) => s.load);

  useEffect(() => {
    void repo.getMeta<number>(LAST_BACKUP_KEY).then((v) => setLastBackup(v ?? null));
    if (persisted === null) void requestPersistentStorage().then(setPersisted);
  }, [persisted]);

  const exportNow = async (kind: 'json' | 'full') => {
    const now = Date.now();
    // Stored first so the file carries its own backup time; restored if the export fails (no silent reminder).
    const previous = (await repo.getMeta<number>(LAST_BACKUP_KEY)) ?? null;
    await repo.setMeta(LAST_BACKUP_KEY, now);
    try {
      const envelope = await exportAll(repo.db, now);
      if (kind === 'json') {
        const name = exportFileName(now);
        download(name, JSON.stringify(envelope), 'application/json');
        setLastBackup(now);
        setMessage(ko.settingsScreen.exported(name));
        return;
      }
      // Audio that cannot be read (no OPFS, or a file gone) leaves only its row in the zip, as in a JSON backup.
      const names = [...new Set(envelope.tables.recordings.map((r) => r.fileName))].filter(
        (n): n is string => typeof n === 'string',
      );
      const { files, missing } = await readFiles(names);
      const name = fullBackupFileName(now);
      download(name, createFullBackup(envelope, files, now), 'application/zip');
      setLastBackup(now);
      setMessage(
        missing.length > 0
          ? ko.settingsScreen.exportedFullWithout(name, missing.length)
          : ko.settingsScreen.exported(name),
      );
    } catch {
      await repo.setMeta(LAST_BACKUP_KEY, previous);
      setMessage(ko.settingsScreen.exportError);
    }
  };

  const pick = async (f: File) => {
    try {
      setPreview(parseBackupFile(new Uint8Array(await f.arrayBuffer())));
      setMessage(null);
    } catch {
      setPreview(null);
      setMessage(ko.settingsScreen.importError);
    }
  };

  const apply = async (mode: 'merge' | 'replace') => {
    if (!preview) return;
    await applyImport(repo, preview.envelope, mode);
    // Merge keeps audio already on this device (같은 키 건너뜀); replace writes the backup's audio over it.
    const { failed } = await saveFiles(preview.audio, mode === 'replace');
    await load();
    setPreview(null);
    setConfirmReplace(false);
    setMessage(failed > 0 ? ko.settingsScreen.importDoneWithoutAudio(failed) : ko.settingsScreen.importDone);
  };

  return (
    <Card as="section" id="backup" data-testid="backup-section">
      <CardHeader title={ko.settingsScreen.backup} className="mb-1" />
      <p className="text-sm text-muted">
        {ko.settingsScreen.lastBackup(lastBackup === null ? null : dayKey(lastBackup))}
      </p>
      {persisted !== null && <p className="text-sm text-muted">{ko.settingsScreen.persist(persisted)}</p>}
      <p className="text-sm text-muted">{ko.settingsScreen.homeScreenTip}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => void exportNow('json')} data-testid="export-data">
          {ko.settingsScreen.exportData}
        </Button>
        <Button variant="secondary" onClick={() => void exportNow('full')} data-testid="export-full">
          {ko.settingsScreen.exportFull}
        </Button>
        <Button variant="secondary" onClick={() => file.current?.click()}>
          {ko.settingsScreen.importData}
        </Button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json,application/zip,.zip"
          className="sr-only"
          // Reached through the "가져오기" button: a 1 px focus stop would show no ring.
          tabIndex={-1}
          aria-label={ko.settingsScreen.importData}
          data-testid="import-file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void pick(f);
            e.target.value = '';
          }}
        />
      </div>
      {preview && (
        <div className="mt-3 rounded-xl bg-surface-2 p-3" data-testid="import-preview">
          <p>
            {ko.settingsScreen.importPreview(
              Object.entries(preview.counts)
                .filter(([, n]) => n > 0)
                .map(([t, n]) => `${t} ${n}`)
                .concat(preview.audio.length > 0 ? [ko.settingsScreen.importAudio(preview.audio.length)] : [])
                .join(', '),
            )}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button onClick={() => void apply('merge')}>{ko.settingsScreen.importMerge}</Button>
            {!confirmReplace ? (
              <Button variant="secondary" onClick={() => setConfirmReplace(true)}>
                {ko.settingsScreen.importReplace}
              </Button>
            ) : (
              <div
                role="alertdialog"
                aria-label={ko.settingsScreen.importReplaceConfirm}
                className="flex flex-wrap items-center gap-2"
              >
                <span>{ko.settingsScreen.importReplaceConfirm}</span>
                <Button onClick={() => void apply('replace')} data-testid="import-replace-confirm">
                  {ko.settingsScreen.yes}
                </Button>
                <Button variant="secondary" onClick={() => setConfirmReplace(false)}>
                  {ko.settingsScreen.cancel}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
      {message && (
        <p role="status" className="mt-2" data-testid="backup-message">
          {message}
        </p>
      )}
    </Card>
  );
}

/** Key/pedal mapping (SPEC §12.3): defaults plus learned bindings (any key → an action). */
function KeysSection() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const [learning, setLearning] = useState<KeyAction | null>(null);
  /** A learned key that was another action's default key (v1.1 option keys included): say what it replaces. */
  const [replaced, setReplaced] = useState<{ key: string; action: KeyAction } | null>(null);

  useEffect(() => {
    if (!learning) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key !== 'Escape' && settings) {
        void update({ customKeys: { ...settings.customKeys, [e.code]: learning } });
        // By the letter on the key too: with the Korean IME KeyB gives 'ㅠ', yet the binding (by code) replaces B.
        const letter = letterOfCode(e.code);
        const previous = defaultActionForKey(e.key) ?? (letter ? defaultActionForKey(letter) : null);
        setReplaced(previous !== null && previous !== learning ? { key: e.key, action: previous } : null);
      }
      setLearning(null);
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [learning, settings, update]);

  if (!settings) return null;
  const keyName = (key: string) => ko.keys.keyNames[key] ?? key;
  const custom = Object.entries(settings.customKeys);
  return (
    <Card as="section" data-testid="keys-section">
      <CardHeader title={ko.settingsScreen.keys} className="mb-1" />
      <p className="text-muted">{ko.keys.pedalTip}</p>
      <table className="mt-3 w-full">
        <thead>
          <tr className="border-b border-border text-left text-sm text-muted">
            <th scope="col" />
            <th scope="col">{ko.keys.defaults}</th>
            <th scope="col" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {KEY_ACTIONS.map((action) => (
            <tr key={action}>
              <th scope="row" className="py-1 pr-3 text-left font-normal">
                {ko.keys.actions[action]}
              </th>
              <td className="pr-3 tabular-nums text-muted">
                <Phrases text={defaultKeysFor(action).map(keyName).join(' · ')} />
              </td>
              <td className="py-1 text-right">
                {/* One line on a phone: the narrow column would split it into "페달 / 학습" (H9). */}
                <Button
                  variant="ghost"
                  className="whitespace-nowrap"
                  onClick={() => setLearning(action)}
                  data-testid={`learn-${action}`}
                >
                  {ko.keys.learn}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {learning && (
        <p role="status" className="mt-2 text-info" data-testid="learn-prompt">
          {ko.keys.learnPrompt(ko.keys.actions[learning] ?? learning)}
        </p>
      )}
      {!learning && replaced && (
        <p role="status" className="mt-2 text-retry" data-testid="learn-replaced">
          {ko.keys.replaced(keyName(replaced.key), ko.keys.actions[replaced.action] ?? replaced.action)}
        </p>
      )}
      {custom.length > 0 && (
        <div className="mt-3">
          <h3 className="font-semibold">{ko.keys.custom}</h3>
          <ul data-testid="custom-keys">
            {custom.map(([code, action]) => (
              <li key={code} className="flex items-center justify-between">
                <span>{ko.keys.learned(code, ko.keys.actions[action] ?? action)}</span>
                <Button
                  variant="ghost"
                  onClick={() => {
                    const { [code]: _removed, ...rest } = settings.customKeys;
                    void update({ customKeys: rest });
                  }}
                >
                  {ko.keys.remove}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function ResetSection() {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const load = useSettingsStore((s) => s.load);
  const reset = async () => {
    await repo.resetAll();
    await removeAllFiles();
    await load();
    setStep(0);
    setDone(true);
  };
  return (
    <Card as="section" data-testid="reset-section">
      <CardHeader title={ko.settingsScreen.reset} className="mb-1" />
      {step === 0 && (
        <Button variant="secondary" className="mt-2" onClick={() => setStep(1)} data-testid="reset-start">
          {ko.settingsScreen.reset}
        </Button>
      )}
      {step > 0 && (
        <div
          role="alertdialog"
          aria-label={step === 1 ? ko.settingsScreen.resetConfirm1 : ko.settingsScreen.resetConfirm2}
          className="mt-2"
        >
          <p>{step === 1 ? ko.settingsScreen.resetConfirm1 : ko.settingsScreen.resetConfirm2}</p>
          <div className="mt-2 flex gap-2">
            <Button
              onClick={() => (step === 1 ? setStep(2) : void reset())}
              data-testid={`reset-confirm-${step}`}
            >
              {ko.settingsScreen.yes}
            </Button>
            <Button variant="secondary" onClick={() => setStep(0)}>
              {ko.settingsScreen.no}
            </Button>
          </div>
        </div>
      )}
      {done && (
        <p role="status" className="mt-2">
          {ko.settingsScreen.resetDone}
        </p>
      )}
    </Card>
  );
}

/** Settings (SPEC §12.1). */
export function SettingsScreen() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  if (!settings) return <Screen title={ko.settingsScreen.title} busy />;
  const set = (patch: Partial<Settings>) => void update(patch);
  const g = ko.settingsScreen.groups;
  return (
    <Screen title={ko.settingsScreen.title}>
      <div className="flex flex-col gap-5">
        <nav className="flex flex-wrap gap-2" aria-label={g.more}>
          <ButtonLink to="/settings/diagnostics">{ko.settingsScreen.devices}</ButtonLink>
          <ButtonLink to="/onboarding">{ko.settingsScreen.recalibrate}</ButtonLink>
          <ButtonLink to="/settings/recording">{ko.settingsScreen.recording}</ButtonLink>
        </nav>
        <Card tone="info">
          <p className="text-info">{ko.settingsScreen.micNotice}</p>
        </Card>
        <Card as="section" className="flex flex-col gap-3">
          <CardHeader title={g.display} className="mb-0" />
          <fieldset>
            <legend className="mb-1 font-semibold">{ko.settingsScreen.theme}</legend>
            <div className="flex flex-wrap gap-x-4">
              {(['dark', 'light', 'contrast'] as const).map((theme) => (
                <Choice
                  key={theme}
                  type="radio"
                  name="theme"
                  label={ko.settingsScreen.themes[theme]}
                  className="pr-3"
                  checked={settings.theme === theme}
                  onChange={() => set({ theme })}
                />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-1 font-semibold">{ko.settingsScreen.headStyle}</legend>
            <div className="flex flex-wrap gap-x-4">
              {(['3+3', 'inline6'] as const).map((head) => (
                <Choice
                  key={head}
                  type="radio"
                  name="headStyle"
                  label={ko.settingsScreen.headStyles[head]}
                  className="pr-3"
                  checked={settings.headStyle === head}
                  onChange={() => set({ headStyle: head })}
                />
              ))}
            </div>
          </fieldset>
          <Toggle
            label={ko.settingsScreen.leftHanded}
            checked={settings.leftHanded}
            onChange={(leftHanded) => set({ leftHanded })}
          />
        </Card>
        <Card as="section" className="flex flex-col gap-4">
          <CardHeader title={g.judging} className="mb-0" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={ko.settingsScreen.strictness}>
              <Select
                value={settings.strictness}
                onChange={(e) => set({ strictness: e.target.value as Settings['strictness'] })}
              >
                {(['lenient', 'normal', 'strict'] as const).map((s) => (
                  <option key={s} value={s}>
                    {ko.settingsScreen.strictnessNames[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={ko.settingsScreen.sensitivity} help={ko.settingsScreen.sensitivityHelp}>
              <Select
                value={settings.sensitivity}
                onChange={(e) => set({ sensitivity: e.target.value as Settings['sensitivity'] })}
                data-testid="setting-sensitivity"
              >
                {(['low', 'normal', 'high'] as const).map((s) => (
                  <option key={s} value={s}>
                    {ko.settingsScreen.sensitivityNames[s]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div>
            <Toggle
              label={ko.settingsScreen.xStringCheck}
              checked={settings.xStringCheck}
              onChange={(xStringCheck) => set({ xStringCheck })}
            />
            <Toggle
              label={ko.settingsScreen.micDisabled}
              checked={settings.micDisabled}
              onChange={(micDisabled) => set({ micDisabled })}
              testId="setting-mic-disabled"
            />
          </div>
        </Card>
        <Card as="section" className="flex flex-col gap-3">
          <CardHeader title={g.practice} className="mb-0" />
          <div>
            <Toggle
              label={ko.settingsScreen.visualOnly}
              checked={settings.visualOnlyMetronome}
              onChange={(visualOnlyMetronome) => set({ visualOnlyMetronome })}
            />
            <Toggle
              label={ko.settingsScreen.blockTransition}
              checked={settings.blockTransition}
              onChange={(blockTransition) => set({ blockTransition })}
              testId="setting-block-transition"
            />
            <Toggle
              label={ko.settingsScreen.sessionLengthTemplate}
              checked={settings.sessionLengthMode === 'template'}
              onChange={(byStage) => set({ sessionLengthMode: byStage ? 'template' : 'custom' })}
              testId="setting-session-template"
            />
          </div>
          <MinutesInput
            label={ko.settingsScreen.sessionMinutes}
            value={settings.sessionMinutes}
            onCommit={(v) => set({ sessionMinutes: v, sessionLengthMode: 'custom' })}
          />
        </Card>
        <KeysSection />
        <BackupSection />
        <ResetSection />
      </div>
    </Screen>
  );
}

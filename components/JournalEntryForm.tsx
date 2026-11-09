'use client';

import { useState, useEffect, useRef, FormEvent, KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import MarkdownEditor from '@/components/MarkdownEditor';
import PillSelector from '@/components/PillSelector';
import { Button } from '@/components/ui/Button';
import { formatFullName } from '@/lib/nameUtils';
import { formatDate, getLocalDateString, type DateFormat } from '@/lib/date-format';
import {
  clearDraft,
  defaultUpdateLastContact,
  deriveEntryTitle,
  editEntryDraftKey,
  newEntryDraftKey,
  purgeStaleJournalDrafts,
  readDraft,
  writeDraft,
} from '@/lib/journal';

interface PersonOption {
  id: string;
  name: string;
  surname?: string | null;
  nickname?: string | null;
  displayNameOverride?: string | null;
}

interface JournalEntryFormProps {
  mode: 'create' | 'edit';
  /** The signed-in account. Drafts are stored per account. */
  userId: string;
  entryId?: string;
  initialData?: {
    title: string;
    dateIso: string;       // entry.date.toISOString() from the server
    hasTime: boolean;
    body: string;
    personIds: string[];
  };
  availablePeople: PersonOption[];
  nameOrder?: 'WESTERN' | 'EASTERN';
  dateFormat?: DateFormat;
  /** Create mode: people (and optionally a day) the form starts with, e.g. from ?person=. */
  prefill?: {
    personIds: string[];
    date?: string;
  };
  /** Create mode: people written about most recently, offered as one-tap chips. */
  recentPersonIds?: string[];
  /** Where Cancel and a finished save lead. Defaults to the timeline. */
  returnHref?: string;
}

interface PillPerson {
  id: string;
  label: string;
}

type SaveIntent = 'done' | 'another';

function getCurrentTimeString(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function localTimeString(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export default function JournalEntryForm({
  mode,
  userId,
  entryId,
  initialData,
  availablePeople,
  nameOrder,
  dateFormat = 'MDY',
  prefill,
  recentPersonIds = [],
  returnHref = '/journal',
}: JournalEntryFormProps) {
  const t = useTranslations('journal.form');
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [draftRestored, setDraftRestored] = useState(false);
  // True once the current text is safely in localStorage, so leaving loses nothing.
  const [draftStored, setDraftStored] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const savedRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Build pill-compatible list from availablePeople
  const pillPeople: PillPerson[] = availablePeople.map((p) => ({
    id: p.id,
    label: formatFullName(p, nameOrder),
  }));

  const pickPeople = (ids: string[]): PillPerson[] =>
    ids
      .map((id) => pillPeople.find((p) => p.id === id))
      .filter((p): p is PillPerson => p !== undefined);

  const initialIso = initialData?.dateIso;
  const initialHasTime = initialData?.hasTime ?? false;

  const computeInitialDate = () => {
    if (!initialIso) return prefill?.date ?? getLocalDateString();
    if (initialHasTime) return getLocalDateString(new Date(initialIso));
    return initialIso.slice(0, 10);
  };
  const computeInitialTime = () =>
    initialIso && initialHasTime ? localTimeString(new Date(initialIso)) : '';

  const initialPersonIds = initialData?.personIds ?? prefill?.personIds ?? [];

  const [title, setTitle] = useState(initialData?.title ?? '');
  const [date, setDate] = useState(computeInitialDate);
  const [time, setTime] = useState(computeInitialTime);
  const [hasTime, setHasTime] = useState(initialHasTime);
  const [body, setBody] = useState(initialData?.body ?? '');
  const [selectedPeople, setSelectedPeople] = useState<PillPerson[]>(() => pickPeople(initialPersonIds));
  // null = the user has not touched the box, so the default for the chosen date applies.
  const [lastContactChoice, setLastContactChoice] = useState<boolean | null>(null);

  const today = getLocalDateString();
  const isFuture = !defaultUpdateLastContact(date, today);
  const updateLastContact =
    lastContactChoice ?? (mode === 'create' ? !isFuture : false);

  const draftKey = mode === 'create' ? newEntryDraftKey(userId) : editEntryDraftKey(userId, entryId ?? '');

  const samePeopleAsInitial =
    selectedPeople.length === initialPersonIds.length &&
    selectedPeople.every((p) => initialPersonIds.includes(p.id));

  const isDirty =
    title !== (initialData?.title ?? '') ||
    body !== (initialData?.body ?? '') ||
    date !== computeInitialDate() ||
    time !== computeInitialTime() ||
    hasTime !== initialHasTime ||
    (mode === 'edit' && !samePeopleAsInitial);

  const focusBody = () => {
    const textarea = document.getElementById('journal-body');
    if (textarea instanceof HTMLTextAreaElement) {
      textarea.focus();
      const end = textarea.value.length;
      textarea.setSelectionRange(end, end);
    }
  };

  // Quick entry: a new entry opens ready to type.
  useEffect(() => {
    if (mode === 'create') focusBody();
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bring back an unsaved draft from an earlier visit.
  useEffect(() => {
    purgeStaleJournalDrafts();
    const draft = readDraft(draftKey, userId);
    if (draft) {
      const unchanged =
        mode === 'edit' &&
        draft.title === (initialData?.title ?? '') &&
        draft.body === (initialData?.body ?? '') &&
        (draft.date === null || draft.date === computeInitialDate()) &&
        (draft.time === null || draft.time === computeInitialTime()) &&
        draft.hasTime === initialHasTime &&
        draft.personIds.length === initialPersonIds.length &&
        draft.personIds.every((id) => initialPersonIds.includes(id));

      if (unchanged) {
        clearDraft(draftKey);
      } else {
        setTitle(draft.title);
        setBody(draft.body);
        if (draft.date) setDate(draft.date);
        setHasTime(draft.hasTime);
        setTime(draft.hasTime && draft.time ? draft.time : '');
        const restored = pickPeople(draft.personIds);
        setSelectedPeople((prev) =>
          mode === 'create'
            ? [...prev, ...restored.filter((p) => !prev.some((q) => q.id === p.id))]
            : restored
        );
        setDraftRestored(true);
        setDraftStored(true);
      }
    }
    setDraftReady(true);
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the draft up to date while typing.
  useEffect(() => {
    if (!draftReady || savedRef.current) return;
    const timer = setTimeout(() => {
      if (savedRef.current) return;
      if (mode === 'edit' && !isDirty) {
        clearDraft(draftKey);
        setDraftStored(false);
        return;
      }
      const ok = writeDraft(draftKey, userId, {
        title,
        body,
        // A default day is not worth keeping: tomorrow "today" is another day.
        date: mode === 'create' && date === getLocalDateString() ? null : date,
        time: hasTime ? time : null,
        hasTime,
        personIds: selectedPeople.map((p) => p.id),
      });
      setDraftStored(ok && (title.trim() !== '' || body.trim() !== ''));
    }, 400);
    return () => clearTimeout(timer);
  }, [draftReady, draftKey, userId, mode, isDirty, title, body, date, time, hasTime, selectedPeople]);

  // Warn about unsaved changes only when they are not already kept as a draft.
  useEffect(() => {
    if (!isDirty || draftStored) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty, draftStored]);

  const discardDraft = () => {
    clearDraft(draftKey);
    setDraftRestored(false);
    setDraftStored(false);
    setTitle(initialData?.title ?? '');
    setBody(initialData?.body ?? '');
    setDate(computeInitialDate());
    setHasTime(initialHasTime);
    setTime(computeInitialTime());
    setSelectedPeople(pickPeople(initialPersonIds));
    focusBody();
  };

  const save = async (intent: SaveIntent) => {
    setError('');

    if (body.trim() === '') {
      setError(t('bodyRequired'));
      focusBody();
      return;
    }

    setIsLoading(true);

    try {
      const url = mode === 'create' ? '/api/journal' : `/api/journal/${entryId}`;
      const method = mode === 'create' ? 'POST' : 'PUT';

      const payloadDate = hasTime
        ? new Date(`${date}T${time}`).toISOString()
        : date;

      const payload = {
        // A title is optional for the writer; the entry still needs one.
        title: title.trim() || deriveEntryTitle(body) || t('untitled'),
        date: payloadDate,
        hasTime,
        body,
        personIds: selectedPeople.map((p) => p.id),
        updateLastContact: selectedPeople.length > 0 ? updateLastContact : false,
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { entry?: { id: string }; error?: string };

      if (!response.ok) {
        setError(data.error ?? t('saveFailed'));
        return;
      }

      savedRef.current = true;
      clearDraft(draftKey);
      setDraftStored(false);
      setDraftRestored(false);

      if (mode === 'edit') {
        toast.success(t('saved'));
        router.push(`/journal/${data.entry?.id ?? entryId}`);
        router.refresh();
      } else if (intent === 'another') {
        // Stay on the form for the next entry: same day and people, empty text.
        toast.success(t('savedAddAnother'));
        setTitle('');
        setBody('');
        setHasTime(false);
        setTime('');
        savedRef.current = false;
        focusBody();
        router.refresh();
      } else {
        toast.success(t('saved'));
        router.push(returnHref);
        router.refresh();
      }
    } catch {
      setError(t('saveFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void save('done');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!isLoading) formRef.current?.requestSubmit();
    }
  };

  const cancelHref = mode === 'edit' && entryId ? `/journal/${entryId}` : returnHref;

  const recentChips = recentPersonIds
    .map((id) => pillPeople.find((p) => p.id === id))
    .filter((p): p is PillPerson => p !== undefined && !selectedPeople.some((s) => s.id === p.id))
    .slice(0, 5);

  const titleField = (
    <div>
      <label htmlFor="journal-title" className="block text-sm font-medium text-muted mb-1">
        {t('titleLabel')}
      </label>
      <input
        type="text"
        id="journal-title"
        maxLength={200}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('titlePlaceholder')}
        className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-base sm:text-sm"
      />
    </div>
  );

  return (
    <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-6">
      {error && (
        <div
          className="bg-warning/10 border border-warning/30 text-warning px-4 py-3 rounded"
          role="alert"
          aria-live="polite"
        >
          {error}
        </div>
      )}

      {draftRestored && (
        <div
          className="flex flex-wrap items-center justify-between gap-2 bg-surface-elevated border border-border text-sm text-muted px-4 py-3 rounded-lg"
          role="status"
        >
          <span>{t('draftRestored')}</span>
          <button
            type="button"
            onClick={discardDraft}
            className="text-primary hover:underline min-h-11 sm:min-h-0 px-1"
          >
            {t('discardDraft')}
          </button>
        </div>
      )}

      {/* When editing, the existing title comes first */}
      {mode === 'edit' && titleField}

      {/* Body */}
      <div>
        <label htmlFor="journal-body" className="block text-sm font-medium text-muted mb-1">
          {t('bodyLabel')}
        </label>
        <MarkdownEditor
          id="journal-body"
          value={body}
          onChange={setBody}
          placeholder={t('bodyPlaceholder')}
          rows={10}
        />
        <p className="mt-1 text-xs text-muted">
          {t('markdownSupport')}
          <span className="hidden sm:inline"> · {t('shortcutHint')}</span>
        </p>
      </div>

      {/* People */}
      <div>
        <PillSelector<PillPerson>
          label={t('peopleLabel')}
          selectedItems={selectedPeople}
          availableItems={pillPeople}
          onAdd={(item) => setSelectedPeople((prev) => [...prev, item])}
          onRemove={(itemId) =>
            setSelectedPeople((prev) => prev.filter((p) => p.id !== itemId))
          }
          placeholder={t('peoplePlaceholder')}
          showAllOnFocus
          isLoading={isLoading}
        />
        {recentChips.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted">{t('recentPeople')}</span>
            {recentChips.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => setSelectedPeople((prev) => [...prev, person])}
                className="inline-flex items-center justify-center gap-1 px-3 sm:px-2.5 py-1 min-h-11 sm:min-h-0 text-xs font-medium rounded-full border border-border text-muted hover:text-primary hover:border-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <span aria-hidden="true">+</span>
                {person.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Date */}
      <div>
        <label htmlFor="journal-date" className="block text-sm font-medium text-muted mb-1">
          {t('dateLabel')}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            id="journal-date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-base sm:text-sm"
          />
          {hasTime ? (
            <>
              <input
                type="time"
                id="journal-time"
                aria-label={t('timeLabel')}
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-base sm:text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  setHasTime(false);
                  setTime('');
                }}
                className="text-sm text-muted hover:text-foreground transition-colors min-h-11 sm:min-h-0 px-1"
              >
                {t('removeTime')}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setHasTime(true);
                if (!time) setTime(getCurrentTimeString());
              }}
              className="text-sm text-primary hover:underline min-h-11 sm:min-h-0 px-1"
            >
              + {t('addTime')}
            </button>
          )}
        </div>
      </div>

      {/* For a new entry the title is an extra, so it comes after the essentials */}
      {mode === 'create' && titleField}

      {/* Update last contact: only visible when people are tagged */}
      {selectedPeople.length > 0 && (
        <div>
          <label
            htmlFor="update-last-contact"
            className="flex items-center gap-2.5 py-2 cursor-pointer select-none -my-1 min-h-11 sm:min-h-0"
          >
            <input
              type="checkbox"
              id="update-last-contact"
              checked={updateLastContact}
              onChange={(e) => setLastContactChoice(e.target.checked)}
              aria-describedby="update-last-contact-help"
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary focus:ring-2 cursor-pointer"
            />
            <span className="text-sm text-foreground">
              {t('updateLastContact', { date: formatDate(date, dateFormat) })}
            </span>
          </label>
          <p id="update-last-contact-help" className="text-xs text-muted ml-[1.625rem]">
            {isFuture && lastContactChoice === null
              ? t('updateLastContactFuture')
              : t('updateLastContactHelp')}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap justify-end gap-3 pt-2">
        <Button variant="secondary" href={cancelHref}>
          {t('cancel')}
        </Button>
        {mode === 'create' && (
          <Button
            type="button"
            variant="secondary"
            disabled={isLoading}
            onClick={() => void save('another')}
          >
            {t('saveAndAddAnother')}
          </Button>
        )}
        <Button type="submit" disabled={isLoading} aria-busy={isLoading}>
          {isLoading ? '…' : t('save')}
        </Button>
      </div>
    </form>
  );
}

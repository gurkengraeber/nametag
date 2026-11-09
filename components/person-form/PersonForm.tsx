'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { usePersonForm } from '../../hooks/usePersonForm';
import FieldManager from '../fields/FieldManager';
import {
  phoneFieldConfig,
  emailFieldConfig,
  addressFieldConfig,
  urlFieldConfig,
} from '../../lib/field-configs';
import PhotoSection from './PhotoSection';
import PersonalInfoSection from './PersonalInfoSection';
import WorkInfoSection from './WorkInfoSection';
import GroupsSection from './GroupsSection';
import LastContactSection from './LastContactSection';
import ImportantDatesManager from '../ImportantDatesManager';
import MarkdownEditor from '../MarkdownEditor';
import { Button } from '../ui/Button';
import CardDavSyncSection from './CardDavSyncSection';
import FormSection from './FormSection';
import CustomFieldsSection from '../customFields/CustomFieldsSection';
import type { CustomFieldTemplate } from '@prisma/client';
import { useSearchIndex } from '@/components/SearchIndexProvider';
import { isHeicFile, convertHeicToJpeg } from '@/lib/photo-client';
import {
  loadPersonFormDefaults,
  savePersonFormDefaults,
  sanitizePersonFormDefaults,
  mapServerFieldErrors,
  type PersonFormFieldErrors,
} from '@/lib/person-form-support';

type ReminderIntervalUnit = 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS';

// Defined OUTSIDE the component to prevent re-renders
const SectionHeader = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-lg font-semibold text-foreground mb-4">{children}</h3>
);

// Fields that live in the always visible first card of the form.
const BASIC_FIELDS = new Set([
  'name',
  'surname',
  'nickname',
  'prefix',
  'middleName',
  'secondLastName',
  'suffix',
  'displayNameOverride',
  'relationshipToUserId',
  'groupIds',
]);

export interface PersonFormProps {
  person?: {
    id: string;
    name: string;
    surname: string | null;
    middleName: string | null;
    secondLastName: string | null;
    nickname: string | null;
    displayNameOverride?: string | null;
    prefix: string | null;
    suffix: string | null;
    photo?: string | null;
    organization: string | null;
    jobTitle: string | null;
    lastContact: Date | null;
    notes: string | null;
    relationshipToUserId: string | null;
    relationshipToUser?: {
      label: string;
    } | null;
    groups: Array<{ groupId: string }>;
    contactReminderEnabled?: boolean;
    contactReminderInterval?: number | null;
    contactReminderIntervalUnit?: ReminderIntervalUnit | null;
    cardDavSyncEnabled?: boolean;
    cardDavMapping?: { id: string } | null;
    importantDates?: Array<{
      id: string;
      type?: string | null;
      title: string;
      date: Date;
      reminderEnabled?: boolean;
      reminderType?: 'ONCE' | 'RECURRING' | null;
      reminderInterval?: number | null;
      reminderIntervalUnit?: ReminderIntervalUnit | null;
      reminderLeadDays?: number | null;
    }>;
    phoneNumbers?: Array<{
      id?: string;
      type: string;
      number: string;
    }>;
    emails?: Array<{
      id?: string;
      type: string;
      email: string;
    }>;
    addresses?: Array<{
      id?: string;
      type: string;
      streetLine1?: string | null;
      streetLine2?: string | null;
      locality?: string | null;
      region?: string | null;
      postalCode?: string | null;
      country?: string | null;
    }>;
    urls?: Array<{
      id?: string;
      type: string;
      url: string;
    }>;
    // Only populated in edit mode; undefined on create
    customFieldValues?: Array<{
      templateId: string;
      value: string;
    }>;
  };
  customFieldTemplates?: CustomFieldTemplate[];
  groups: Array<{
    id: string;
    name: string;
    color: string | null;
  }>;
  relationshipTypes: Array<{
    id: string;
    label: string;
    color: string | null;
  }>;
  availablePeople?: Array<{
    id: string;
    name: string;
    surname: string | null;
    middleName: string | null;
    secondLastName: string | null;
    nickname: string | null;
    displayNameOverride?: string | null;
    groups: Array<{ groupId: string }>;
  }>;
  userName?: string;
  mode: 'create' | 'edit';
  dateFormat?: 'MDY' | 'DMY' | 'YMD';
  hasCardDavConnection?: boolean;
  nameOrder?: 'WESTERN' | 'EASTERN';
  initialName?: string;
  initialKnownThrough?: string;
  initialRelationshipType?: string;
  reminderLimit?: {
    canCreate: boolean;
    current: number;
    limit: number;
    isUnlimited: boolean;
  };
  // Required, unlike reminderLimit?: 0 is a real, meaningful lead time
  // (day-of only), not a safe "feature off" fallback. A missing prop here
  // would silently mislabel the "Default" option for any user whose real
  // account default isn't 0, with nothing visibly wrong. Making this a
  // compile error is cheaper than that failure mode.
  defaultReminderLeadDays: number;
  /** Account id; remembered defaults for new people are stored per account. */
  userId?: string;
}

export default function PersonForm({
  person,
  customFieldTemplates = [],
  groups,
  relationshipTypes,
  availablePeople = [],
  mode,
  dateFormat = 'MDY',
  hasCardDavConnection,
  nameOrder,
  initialName,
  initialKnownThrough,
  initialRelationshipType,
  reminderLimit,
  defaultReminderLeadDays,
  userId,
}: PersonFormProps) {
  const t = useTranslations('people.form');
  const tPhoto = useTranslations('people.photo');
  const router = useRouter();
  const { refreshIndex } = useSearchIndex();
  const isSubmittingRef = useRef(false);

  const {
    state,
    isDirty,
    setIsLoading,
    setError,
    setPhotoPreview,
    setPhotoRemoved,
    setPendingPhotoBlob,
    setCropImageSrc,
    setShowPhotoSourceModal,
    setKnownThrough,
    setInheritGroups,
    setFormData,
    applyPristineFormData,
    setImportantDates,
    setPhoneNumbers,
    setEmails,
    setAddresses,
    setUrls,
    setCustomFieldValues,
  } = usePersonForm({
    person,
    mode,
    initialName,
    initialKnownThrough,
    initialRelationshipType,
    availablePeople,
    youLabel: t('you'),
  });

  const {
    isLoading,
    error,
    photoPreview,
    photoRemoved,
    pendingPhotoBlob,
    cropImageSrc,
    showPhotoSourceModal,
    knownThroughId,
    knownThroughName,
    inheritGroups,
    formData,
    importantDates,
    phoneNumbers,
    emails,
    addresses,
    urls,
    customFieldValues,
  } = state;

  const confirmedNavRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const addAnotherRef = useRef(false);
  const [fieldErrors, setFieldErrors] = useState<PersonFormFieldErrors>({});
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [showMore, setShowMore] = useState(false);

  const fieldErrorMessages = useMemo(() => {
    const messages: Record<string, string> = {};
    const keyByIssue = {
      required: 'required',
      too_long: 'tooLong',
      too_short: 'tooShort',
      invalid_format: 'invalidFormat',
      invalid_value: 'invalidValue',
    } as const;
    for (const [key, entry] of Object.entries(fieldErrors)) {
      messages[key] = t(`fieldErrors.${keyByIssue[entry.issue]}`, {
        max: entry.max ?? 0,
        min: entry.min ?? 0,
      });
    }
    return { ...messages, ...clientErrors };
  }, [fieldErrors, clientErrors, t]);
  const errorKeys = Object.keys(fieldErrorMessages);

  // Remembered relationship and groups for the next new person. Read after
  // mount (localStorage is not available on the server) and counted as the
  // untouched starting point so the unsaved changes warning stays quiet.
  useEffect(() => {
    if (mode !== 'create' || initialKnownThrough || !userId) return;
    const remembered = loadPersonFormDefaults(userId);
    if (!remembered) return;
    const valid = sanitizePersonFormDefaults(
      remembered,
      relationshipTypes.map((type) => type.id),
      groups.map((group) => group.id)
    );
    const updates: { relationshipToUserId?: string; groupIds?: string[] } = {};
    if (valid.relationshipToUserId && !initialRelationshipType) {
      updates.relationshipToUserId = valid.relationshipToUserId;
    }
    if (valid.groupIds.length > 0) updates.groupIds = valid.groupIds;
    if (Object.keys(updates).length > 0) applyPristineFormData(updates);
    // Only on first render of the form
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bring the first problem into view: the field itself, or the banner.
  useEffect(() => {
    if (errorKeys.length === 0 && !error) return;
    for (const key of errorKeys) {
      const el = document.getElementById(key);
      if (el) {
        el.focus();
        el.scrollIntoView?.({ block: 'center' });
        return;
      }
    }
    errorRef.current?.scrollIntoView?.({ block: 'center' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldErrors, clientErrors, error]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (isSubmittingRef.current || confirmedNavRef.current) return;
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;
    window.history.pushState({ unsavedGuard: true }, '');
    const handlePopState = () => {
      if (isSubmittingRef.current) return;
      if (window.confirm(t('unsavedChangesWarning'))) {
        window.history.back();
      } else {
        window.history.pushState({ unsavedGuard: true }, '');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isDirty, t]);

  useEffect(() => {
    if (!isDirty) return;
    const handleClick = (e: MouseEvent) => {
      if (isSubmittingRef.current) return;
      const anchor = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
      if (!anchor) return;
      if (anchor.hasAttribute('download') || anchor.target === '_blank' || anchor.hasAttribute('data-no-unsaved-guard')) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
      try {
        const url = new URL(href, window.location.origin);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname) return;
      } catch {
        return;
      }
      if (!window.confirm(t('unsavedChangesWarning'))) {
        e.preventDefault();
        e.stopPropagation();
      } else {
        confirmedNavRef.current = true;
      }
    };
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [isDirty, t]);

  const selectedBasePerson =
    knownThroughId !== 'user'
      ? availablePeople.find((p) => p.id === knownThroughId) ?? null
      : null;

  const handleInheritGroupsChange = (checked: boolean) => {
    setInheritGroups(checked);
    if (checked && selectedBasePerson) {
      const inheritedGroupIds = selectedBasePerson.groups.map((g) => g.groupId);
      setFormData({
        groupIds: Array.from(
          new Set([...formData.groupIds, ...inheritedGroupIds])
        ),
      });
    }
  };

  const handleKnownThroughChange = (
    newPersonId: string,
    newPersonName: string
  ) => {
    setKnownThrough(newPersonId, newPersonName);
    if (inheritGroups && newPersonId !== 'user') {
      const newBasePerson = availablePeople.find((p) => p.id === newPersonId);
      if (newBasePerson) {
        const inheritedGroupIds = newBasePerson.groups.map((g) => g.groupId);
        setFormData({
          groupIds: Array.from(
            new Set([...formData.groupIds, ...inheritedGroupIds])
          ),
        });
      }
    }
  };

  const handlePhotoSourceSelect = async (file: File) => {
    setShowPhotoSourceModal(false);

    if (isHeicFile(file)) {
      const toastId = toast.loading(tPhoto('converting'));
      try {
        const jpegBlob = await convertHeicToJpeg(file);
        toast.dismiss(toastId);
        setCropImageSrc(URL.createObjectURL(jpegBlob));
      } catch {
        toast.dismiss(toastId);
        toast.error(tPhoto('convertError'));
      }
      return;
    }

    setCropImageSrc(URL.createObjectURL(file));
  };

  const handleCropConfirm = (blob: Blob) => {
    if (cropImageSrc) {
      URL.revokeObjectURL(cropImageSrc);
    }
    setCropImageSrc(null);
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }
    const previewUrl = URL.createObjectURL(blob);
    setPhotoPreview(previewUrl);
    setPhotoRemoved(false);
    setPendingPhotoBlob(blob);
  };

  const handlePhotoRemove = () => {
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoPreview(null);
    setPhotoRemoved(true);
    setPendingPhotoBlob(null);
  };

  const peopleWithUser = [
    { id: 'user', name: t('you'), surname: null, middleName: null, secondLastName: null, nickname: null, groups: [] },
    ...availablePeople,
  ];

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const addAnother = addAnotherRef.current;
    addAnotherRef.current = false;
    setError('');
    setFieldErrors({});
    setClientErrors({});

    if (formData.lastContact) {
      const lastContactDate = new Date(formData.lastContact);
      if (lastContactDate > new Date()) {
        setClientErrors({ lastContact: t('errorFutureDate') });
        setError(t('errorCheckFields'));
        return;
      }
    }

    setIsLoading(true);

    try {
      const url =
        mode === 'create' ? '/api/people' : `/api/people/${person?.id}`;
      const method = mode === 'create' ? 'POST' : 'PUT';

      const payload = {
        ...formData,
        importantDates,
        phoneNumbers,
        emails,
        addresses,
        urls,
        customFieldValues,
        ...(mode === 'create' && knownThroughId !== 'user'
          ? { connectedThroughId: knownThroughId }
          : {}),
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('API Error:', data);
        if (data.details) {
          console.error('Validation errors:', data.details);
        }
        const mapped = mapServerFieldErrors(data.fields);
        if (Object.keys(mapped).length > 0) {
          setFieldErrors(mapped);
          setError(t('errorCheckFields'));
        } else {
          setError(data.error || t('errorSomethingWrong'));
        }
        return;
      }

      // Apply pending photo changes (upload or delete)
      const personId = mode === 'create' ? data.person?.id : person?.id;
      if (personId) {
        if (pendingPhotoBlob) {
          try {
            const photoFormData = new FormData();
            photoFormData.append('photo', pendingPhotoBlob, 'photo.png');
            const photoRes = await fetch(`/api/people/${personId}/photo`, {
              method: 'POST',
              body: photoFormData,
            });
            if (!photoRes.ok) {
              toast.error(tPhoto('uploadError'));
            }
          } catch {
            toast.error(tPhoto('uploadError'));
          }
        } else if (photoRemoved) {
          try {
            const deleteRes = await fetch(`/api/people/${personId}/photo`, {
              method: 'DELETE',
            });
            if (!deleteRes.ok) {
              toast.error(tPhoto('removeError'));
            }
          } catch {
            toast.error(tPhoto('removeError'));
          }
        }
      }

      const displayName = `${formData.name}${formData.surname ? ' ' + formData.surname : ''}`;
      toast.success(
        mode === 'create'
          ? t('successCreated', { name: displayName })
          : t('successUpdated', { name: displayName })
      );

      if (mode === 'create' && userId) {
        const previous = loadPersonFormDefaults(userId);
        savePersonFormDefaults(userId, {
          relationshipToUserId:
            knownThroughId === 'user'
              ? formData.relationshipToUserId
              : (previous?.relationshipToUserId ?? ''),
          groupIds: knownThroughId === 'user' ? formData.groupIds : (previous?.groupIds ?? []),
        });
      }

      isSubmittingRef.current = true;

      if (mode === 'edit' && person?.id) {
        router.push(`/people/${person.id}`);
        router.refresh();
        refreshIndex();
      } else if (mode === 'create' && addAnother) {
        const params = new URLSearchParams();
        if (initialKnownThrough) {
          params.set('knownThrough', initialKnownThrough);
        }
        if (initialRelationshipType) {
          params.set('relationshipType', initialRelationshipType);
        }
        const queryString = params.toString();
        refreshIndex();
        window.location.href = queryString
          ? `/people/new?${queryString}`
          : '/people/new';
      } else if (mode === 'create' && data.person?.id) {
        router.push(`/people/${data.person.id}`);
        router.refresh();
        refreshIndex();
      } else {
        router.push('/people');
        router.refresh();
        refreshIndex();
      }
    } catch {
      setError(t('errorSomethingWrong'));
    } finally {
      setIsLoading(false);
    }
  };

  const sectionCounts = {
    contact: phoneNumbers.length + emails.length,
    location: addresses.length,
    websites: urls.length,
    dates: importantDates.length,
    notes: formData.notes ? 1 : 0,
    work: (formData.organization ? 1 : 0) + (formData.jobTitle ? 1 : 0),
    custom: customFieldValues.filter((v) => v.value).length,
    lastContact: formData.lastContact || formData.contactReminderEnabled ? 1 : 0,
  };
  const isEdit = mode === 'edit';
  const hasHiddenErrors = errorKeys.some((key) => !BASIC_FIELDS.has(key));
  const moreVisible = isEdit || showMore || hasHiddenErrors;
  const contactError = fieldErrorMessages.phoneNumbers || fieldErrorMessages.emails;

  const photoSection = (
    <PhotoSection
      personId={person?.id}
      personPhoto={person?.photo}
      personName={formData.name}
      personSurname={formData.surname}
      photoPreview={photoPreview}
      photoRemoved={photoRemoved}
      cropImageSrc={cropImageSrc}
      showPhotoSourceModal={showPhotoSourceModal}
      onShowPhotoSourceModal={setShowPhotoSourceModal}
      onPhotoSourceSelect={handlePhotoSourceSelect}
      onCropConfirm={handleCropConfirm}
      onCropCancel={() => {
        if (cropImageSrc) {
          URL.revokeObjectURL(cropImageSrc);
        }
        setCropImageSrc(null);
      }}
      onPhotoRemove={handlePhotoRemove}
    />
  );

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div
          ref={errorRef}
          role="alert"
          className="bg-warning/10 border border-warning/30 text-warning px-4 py-3 rounded"
        >
          {error}
        </div>
      )}

      {/* Photo first when editing; folded into "more details" for new people */}
      {isEdit && photoSection}

      {/* Basics: everything most people ever fill in */}
      <div className="border border-border rounded-lg p-4">
        <SectionHeader>{t('sectionPersonalInfo')}</SectionHeader>
        <PersonalInfoSection
          mode={mode}
          errors={fieldErrorMessages}
          autoFocusName={mode === 'create'}
          formData={formData}
          onFormDataChange={setFormData}
          knownThroughId={knownThroughId}
          knownThroughName={knownThroughName}
          onKnownThroughChange={handleKnownThroughChange}
          peopleWithUser={peopleWithUser}
          relationshipTypes={relationshipTypes}
          nameOrder={nameOrder}
        />
        <div className="mt-4">
          <span className="block text-sm font-medium text-muted mb-1">
            {t('sectionGroups')}
          </span>
          <GroupsSection
            mode={mode}
            groups={groups}
            formData={formData}
            onFormDataChange={setFormData}
            knownThroughId={knownThroughId}
            selectedBasePerson={selectedBasePerson ?? null}
            inheritGroups={inheritGroups}
            onInheritGroupsChange={handleInheritGroupsChange}
          />
        </div>
      </div>

      {!isEdit && (
        <button
          type="button"
          aria-expanded={moreVisible}
          onClick={() => setShowMore(!showMore)}
          className="inline-flex items-center gap-1.5 min-h-11 text-primary font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded"
        >
          <svg
            className={`w-4 h-4 transition-transform ${moreVisible ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          {moreVisible ? t('fewerDetails') : t('moreDetails')}
        </button>
      )}

      <div className={moreVisible ? 'space-y-6' : 'hidden'}>
        {!isEdit && photoSection}

        <FormSection
          title={t('sectionContactInfo')}
          count={sectionCounts.contact}
          defaultOpen={isEdit ? sectionCounts.contact > 0 : true}
          error={contactError}
        >
          <div className="space-y-4">
            <FieldManager
              items={phoneNumbers}
              onChange={setPhoneNumbers}
              fieldConfig={phoneFieldConfig}
              label={t('phones.label')}
              emptyText={t('phones.noPhones')}
            />
            <FieldManager
              items={emails}
              onChange={setEmails}
              fieldConfig={emailFieldConfig}
              label={t('emails.label')}
              emptyText={t('emails.noEmails')}
            />
          </div>
        </FormSection>

        <FormSection
          title={t('sectionLastContact')}
          count={sectionCounts.lastContact}
          defaultOpen={isEdit && sectionCounts.lastContact > 0}
          error={fieldErrorMessages.lastContact}
        >
          <LastContactSection
            formData={formData}
            onFormDataChange={setFormData}
            dateFormat={dateFormat}
            reminderLimit={reminderLimit}
          />
        </FormSection>

        <FormSection
          title={t('sectionImportantDates')}
          count={sectionCounts.dates}
          defaultOpen={isEdit && sectionCounts.dates > 0}
          error={fieldErrorMessages.importantDates}
        >
          <ImportantDatesManager
            personId={person?.id}
            initialDates={importantDates}
            onChange={setImportantDates}
            mode={mode}
            dateFormat={dateFormat}
            reminderLimit={reminderLimit}
            defaultReminderLeadDays={defaultReminderLeadDays}
          />
        </FormSection>

        <FormSection
          title={t('sectionNotes')}
          count={sectionCounts.notes}
          defaultOpen={isEdit && sectionCounts.notes > 0}
          error={fieldErrorMessages.notes}
        >
          <MarkdownEditor
            id="notes"
            value={formData.notes}
            onChange={(notes) => setFormData({ notes })}
            placeholder={t('notesPlaceholder')}
            rows={4}
          />
          <p className="text-xs text-muted mt-1">{t('markdownSupport')}</p>
        </FormSection>

        <FormSection
          title={t('sectionWorkInfo')}
          count={sectionCounts.work}
          defaultOpen={isEdit && sectionCounts.work > 0}
          error={fieldErrorMessages.organization || fieldErrorMessages.jobTitle}
        >
          <WorkInfoSection
            formData={formData}
            onFormDataChange={setFormData}
            errors={fieldErrorMessages}
          />
        </FormSection>

        <FormSection
          title={t('sectionLocation')}
          count={sectionCounts.location}
          defaultOpen={isEdit && sectionCounts.location > 0}
          error={fieldErrorMessages.addresses}
        >
          <FieldManager
            items={addresses}
            onChange={setAddresses}
            fieldConfig={addressFieldConfig}
            label={t('addresses.label')}
            emptyText={t('addresses.noAddresses')}
          />
        </FormSection>

        <FormSection
          title={t('sectionWebsites')}
          count={sectionCounts.websites}
          defaultOpen={isEdit && sectionCounts.websites > 0}
          error={fieldErrorMessages.urls}
        >
          <FieldManager
            items={urls}
            onChange={setUrls}
            fieldConfig={urlFieldConfig}
            label={t('urls.label')}
            emptyText={t('urls.noUrls')}
          />
        </FormSection>

        {customFieldTemplates.length > 0 && (
          <FormSection
            title={t('sectionCustomFields')}
            count={sectionCounts.custom}
            defaultOpen={isEdit && sectionCounts.custom > 0}
            error={fieldErrorMessages.customFieldValues}
          >
            <CustomFieldsSection
              templates={customFieldTemplates}
              values={customFieldValues}
              onChange={setCustomFieldValues}
            />
          </FormSection>
        )}

        {hasCardDavConnection && (
          <FormSection title={t('sectionCardDavSync')} defaultOpen={isEdit}>
            <CardDavSyncSection
              mode={mode}
              formData={formData}
              onFormDataChange={setFormData}
              hasCardDavMapping={!!person?.cardDavMapping}
            />
          </FormSection>
        )}
      </div>

      {/* Stays in reach on long forms, especially on phones */}
      <div className="sticky bottom-0 z-10 -mx-6 -mb-6 px-6 py-4 bg-surface border-t border-border rounded-b-lg flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
        <Link
          href={isEdit && person?.id ? `/people/${person.id}` : '/people'}
          data-no-unsaved-guard
          className="inline-flex items-center justify-center min-h-11 sm:min-h-0 px-6 py-2 border border-border text-muted rounded-lg font-medium hover:bg-surface-elevated transition-colors"
        >
          {t('cancel')}
        </Link>

        {mode === 'create' ? (
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={isLoading}
              onClick={() => {
                addAnotherRef.current = true;
                formRef.current?.requestSubmit();
              }}
            >
              {t('createAndAddAnother')}
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              onClick={() => {
                addAnotherRef.current = false;
              }}
            >
              {isLoading ? t('saving') : t('create')}
            </Button>
          </>
        ) : (
          <Button type="submit" disabled={isLoading}>
            {isLoading ? t('saving') : t('save')}
          </Button>
        )}
      </div>
    </form>
  );
}

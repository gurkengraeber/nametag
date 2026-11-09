'use client';

import { useState, useRef, FormEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from './ui/Button';
import PersonAvatar from './PersonPhoto';
import PhotoCropModal from './PhotoCropModal';
import { getUserPhotoUrl } from '@/lib/photo-url';
import { isHeicFile, convertHeicToJpeg } from '@/lib/photo-client';
import SettingsSaveBar from '@/components/settings/SettingsSaveBar';
import { useUnsavedChangesWarning } from '@/components/settings/useUnsavedChangesWarning';
import { hasChanges, parseApiError } from '@/components/settings/formState';

interface ProfileFormProps {
  userId: string;
  currentName: string;
  currentSurname: string;
  currentNickname: string;
  currentEmail: string;
  currentPhoto: string | null;
}

export default function ProfileForm({ userId, currentName, currentSurname, currentNickname, currentEmail, currentPhoto }: ProfileFormProps) {
  const t = useTranslations('settings.profile');
  const tPhoto = useTranslations('people.photo');
  const router = useRouter();
  const { update } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const tUnsaved = useTranslations('settings.unsaved');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showEmailConfirm, setShowEmailConfirm] = useState(false);

  const [formData, setFormData] = useState({
    name: currentName,
    surname: currentSurname,
    nickname: currentNickname,
    email: currentEmail,
  });
  // What the server has right now. The props only change after a refresh, so
  // the form keeps its own copy to know what "unsaved" means after a save.
  const [savedData, setSavedData] = useState(formData);

  // Photo state
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [pendingPhotoBlob, setPendingPhotoBlob] = useState<Blob | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
  const MAX_PHOTO_SIZE = 50 * 1024 * 1024; // 50MB

  const emailChanged = formData.email !== savedData.email;
  const photoChanged = pendingPhotoBlob !== null || photoRemoved;
  const isDirty = hasChanges(formData, savedData) || photoChanged;

  useUnsavedChangesWarning(isDirty, tUnsaved('warning'));

  const setField = (field: keyof typeof formData, value: string) => {
    setFormData({ ...formData, [field]: value });
    if (fieldErrors[field]) {
      setFieldErrors({ ...fieldErrors, [field]: '' });
    }
  };

  const handleDiscard = () => {
    setFormData(savedData);
    setFieldErrors({});
    setError('');
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoPreview(null);
    setPhotoRemoved(false);
    setPendingPhotoBlob(null);
  };

  const handlePhotoSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    const isAllowedType = ALLOWED_PHOTO_TYPES.includes(file.type);
    const isHeicByExtension = (!file.type || file.type === 'application/octet-stream') && (/\.heic$/i.test(file.name) || /\.heif$/i.test(file.name));
    if (!isAllowedType && !isHeicByExtension) {
      toast.error(tPhoto('formatError'));
      return;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      toast.error(tPhoto('sizeError'));
      return;
    }

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

    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result as string);
    };
    reader.readAsDataURL(file);
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

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (!formData.name.trim()) {
      setFieldErrors({ name: t('nameRequired') });
      return;
    }

    // Show confirmation dialog if email is being changed
    if (emailChanged) {
      setShowEmailConfirm(true);
      return;
    }

    await saveProfile();
  };

  const saveProfile = async () => {
    setIsLoading(true);
    setShowEmailConfirm(false);

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        const info = parseApiError(data);
        if (info.code === 'email_in_use') {
          setFieldErrors({ email: info.message ?? t('errorUpdate') });
        } else if (Object.keys(info.fields).length > 0) {
          setFieldErrors(info.fields);
          setError(t('errorFields'));
        } else {
          setError(info.message ?? t('errorUpdate'));
        }
        return;
      }

      if (data.emailChanged) {
        // Email was changed - sign out the user
        await signOut({ callbackUrl: '/login' });
        return;
      }

      // Handle deferred photo upload/delete
      let newPhoto: string | null | undefined;
      if (pendingPhotoBlob) {
        const photoFormData = new FormData();
        photoFormData.append('photo', pendingPhotoBlob, 'photo.png');
        const photoRes = await fetch('/api/user/photo', {
          method: 'POST',
          body: photoFormData,
        });
        if (!photoRes.ok) {
          toast.error(tPhoto('uploadError'));
        } else {
          const photoData = await photoRes.json();
          newPhoto = photoData.photo;
          setPendingPhotoBlob(null);
        }
      } else if (photoRemoved) {
        const photoRes = await fetch('/api/user/photo', {
          method: 'DELETE',
        });
        if (!photoRes.ok) {
          toast.error(tPhoto('removeError'));
        } else {
          newPhoto = null;
          setPhotoRemoved(false);
        }
      }

      toast.success(t('successUpdate'));
      setSavedData(formData);

      // Update the session with new data (including photo if changed)
      await update({
        name: formData.name,
        surname: formData.surname,
        nickname: formData.nickname,
        email: formData.email,
        ...(newPhoto !== undefined ? { photo: newPhoto } : {}),
      });

      router.refresh();
    } catch {
      setError(t('errorConnection'));
    } finally {
      setIsLoading(false);
    }
  };

  // Resolve user photo URL directly (can't use PersonAvatar for this
  // because it routes through getPhotoUrl which builds /api/photos/{personId})
  const hasExistingPhoto = currentPhoto && !photoRemoved;
  const userPhotoUrl = hasExistingPhoto ? getUserPhotoUrl(currentPhoto) : null;
  const hasPhoto = Boolean(photoPreview || hasExistingPhoto);

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" className="bg-warning/10 border border-warning/30 text-warning px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Photo Section */}
        <div className="flex flex-col items-center gap-3 mb-6">
          {/* eslint-disable @next/next/no-img-element */}
          {photoPreview ? (
            <img src={photoPreview} alt="" className="w-20 h-20 rounded-full object-cover bg-white dark:bg-black" />
          ) : userPhotoUrl ? (
            <img src={userPhotoUrl} alt="" className="w-20 h-20 rounded-full object-cover bg-white dark:bg-black" />
          ) : (
            <PersonAvatar
              personId={userId}
              name={formData.name || formData.surname || '?'}
              photo={null}
              size={80}
              loading="eager"
            />
          )}
          {/* eslint-enable @next/next/no-img-element */}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,.heic,.heif"
            onChange={handlePhotoSelect}
            className="hidden"
            aria-label={hasPhoto ? tPhoto('changeLabel') : tPhoto('uploadLabel')}
          />
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              {hasPhoto ? tPhoto('changeLabel') : tPhoto('uploadLabel')}
            </Button>
            {hasPhoto && (
              <Button type="button" variant="ghost" size="sm" onClick={handlePhotoRemove}>
                {tPhoto('removeLabel')}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted text-center max-w-sm">
            {photoChanged ? t('photoPending') : t('photoHint')}
          </p>
        </div>

        {/* Crop modal */}
        {cropImageSrc && (
          <PhotoCropModal
            imageSrc={cropImageSrc}
            onConfirm={handleCropConfirm}
            onCancel={() => {
              if (cropImageSrc) {
                URL.revokeObjectURL(cropImageSrc);
              }
              setCropImageSrc(null);
            }}
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-muted mb-1"
            >
              {t('name')}
            </label>
            <input
              type="text"
              id="name"
              required
              value={formData.name}
              onChange={(e) => setField('name', e.target.value)}
              aria-invalid={fieldErrors.name ? true : undefined}
              aria-describedby={fieldErrors.name ? 'name-error' : undefined}
              className="w-full min-h-11 px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {fieldErrors.name && <p id="name-error" className="mt-1 text-sm text-warning">{fieldErrors.name}</p>}
          </div>

          <div>
            <label
              htmlFor="surname"
              className="block text-sm font-medium text-muted mb-1"
            >
              {t('surname')}
            </label>
            <input
              type="text"
              id="surname"
              value={formData.surname}
              onChange={(e) => setField('surname', e.target.value)}
              aria-invalid={fieldErrors.surname ? true : undefined}
              aria-describedby={fieldErrors.surname ? 'surname-error' : undefined}
              className="w-full min-h-11 px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {fieldErrors.surname && <p id="surname-error" className="mt-1 text-sm text-warning">{fieldErrors.surname}</p>}
          </div>

          <div>
            <label
              htmlFor="nickname"
              className="block text-sm font-medium text-muted mb-1"
            >
              {t('nickname')}
            </label>
            <input
              type="text"
              id="nickname"
              value={formData.nickname}
              onChange={(e) => setField('nickname', e.target.value)}
              aria-invalid={fieldErrors.nickname ? true : undefined}
              aria-describedby={fieldErrors.nickname ? 'nickname-error' : undefined}
              className="w-full min-h-11 px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {fieldErrors.nickname && <p id="nickname-error" className="mt-1 text-sm text-warning">{fieldErrors.nickname}</p>}
          </div>
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-muted mb-1"
          >
            {t('email')}
          </label>
          <input
            type="email"
            id="email"
            required
            value={formData.email}
            onChange={(e) => setField('email', e.target.value)}
            aria-invalid={fieldErrors.email ? true : undefined}
            aria-describedby={fieldErrors.email ? 'email-error' : emailChanged ? 'email-hint' : undefined}
            className="w-full min-h-11 px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {fieldErrors.email && <p id="email-error" className="mt-1 text-sm text-warning">{fieldErrors.email}</p>}
          {!fieldErrors.email && emailChanged && (
            <p id="email-hint" className="mt-1 text-sm text-muted">{t('emailChangeHint')}</p>
          )}
        </div>

        <SettingsSaveBar
          dirty={isDirty}
          isSaving={isLoading}
          saveLabel={t('saveChanges')}
          savingLabel={t('saving')}
          onDiscard={handleDiscard}
        />
      </form>

      {/* Email Change Confirmation Dialog */}
      {showEmailConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-foreground mb-4">
              {t('emailChange.title')}
            </h3>
            <p className="text-muted mb-4">
              {t('emailChange.message')} <strong className="text-foreground">{formData.email}</strong>.
            </p>
            <p className="text-muted mb-6">
              {t('emailChange.warning')}
            </p>
            <div className="flex justify-end space-x-3">
              <Button type="button" variant="secondary" onClick={() => setShowEmailConfirm(false)}>
                {t('emailChange.cancel')}
              </Button>
              <Button type="button" onClick={saveProfile} disabled={isLoading}>
                {isLoading ? t('saving') : t('emailChange.confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

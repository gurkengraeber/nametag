/**
 * TypeScript types for CardDAV and vCard transformation
 */

import type {
  Person,
  PersonPhone,
  PersonEmail,
  PersonAddress,
  PersonUrl,
  PersonIM,
  PersonLocation,
  PersonCustomField,
  PersonCustomFieldValue,
  CustomFieldTemplate,
  ImportantDate,
  Relationship,
  Group,
} from '@prisma/client';
/** PersonLocation with latitude/longitude accepting both Prisma Decimal and plain number (serialized for client components) */
type SerializablePersonLocation = Omit<PersonLocation, 'latitude' | 'longitude'> & {
  latitude: PersonLocation['latitude'] | number;
  longitude: PersonLocation['longitude'] | number;
};

/** PersonAddress with latitude/longitude accepting both Prisma Decimal and plain number (serialized for client components) */
type SerializablePersonAddress = Omit<PersonAddress, 'latitude' | 'longitude'> & {
  latitude: PersonAddress['latitude'] | number;
  longitude: PersonAddress['longitude'] | number;
};

/**
 * Person with all relations loaded (for vCard export)
 */
export interface PersonWithRelations extends Person {
  phoneNumbers: PersonPhone[];
  emails: PersonEmail[];
  addresses: SerializablePersonAddress[];
  urls: PersonUrl[];
  imHandles: PersonIM[];
  locations: SerializablePersonLocation[];
  customFields: PersonCustomField[];
  customFieldValues: (PersonCustomFieldValue & { template: CustomFieldTemplate })[];
  importantDates: ImportantDate[];
  relationshipsFrom: (Relationship & {
    relatedPerson: Person;
  })[];
  groups: {
    group: Group;
  }[];
}

/**
 * Parsed vCard data (from server) ready for database insertion
 */
export interface ParsedVCardData {
  // Identity
  name: string;
  surname?: string;
  secondLastName?: string;
  middleName?: string;
  prefix?: string;
  suffix?: string;
  nickname?: string;
  uid?: string;

  // Professional
  organization?: string;
  jobTitle?: string;

  // Other
  photo?: string;
  gender?: string;
  notes?: string;

  // Dates
  anniversary?: Date;
  lastContact?: Date;

  // Multi-value fields
  phoneNumbers: {
    type: string;
    number: string;
  }[];
  emails: {
    type: string;
    email: string;
  }[];
  addresses: {
    type: string;
    streetLine1?: string;
    streetLine2?: string;
    locality?: string;
    region?: string;
    postalCode?: string;
    country?: string;
  }[];
  urls: {
    type: string;
    url: string;
  }[];
  imHandles: {
    protocol: string;
    handle: string;
  }[];
  locations: {
    type: string;
    latitude: number;
    longitude: number;
  }[];

  // Important dates (from BDAY and ANNIVERSARY properties)
  importantDates: {
    type?: string | null;
    title: string;
    date: Date;
  }[];

  // Groups (from CATEGORIES)
  categories: string[];

  // Custom fields (X- properties)
  customFields: {
    key: string;
    value: string;
    type?: string;
  }[];
}

/**
 * CardDAV connection response (without encrypted password).
 * Canonical type used by all UI components.
 * Date fields are serialized as strings when passed from server to client components.
 */
export interface CardDavConnectionResponse {
  id: string;
  userId: string;
  serverUrl: string;
  username: string;
  provider: string | null;
  syncEnabled: boolean;
  autoSyncInterval: number;
  lastSyncAt: string | Date | null;
  syncToken: string | null;
  autoExportNew: boolean;
  importMode: string;
  cardDavNameFormat: string;
  lastError: string | null;
  lastErrorAt: string | Date | null;
  syncInProgress: boolean;
  syncStartedAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

/**
 * CardDAV provider presets
 */
export interface CardDavProvider {
  id: string;
  name: string;
  serverUrl: string;
  help: string;
  requiresAppPassword?: boolean;
  /** Only needed when two-factor sign-in is on; the page words its hint more softly. */
  appPasswordWithTwoFactor?: boolean;
  appPasswordUrl?: string;
  /** The server address depends on the user (self hosted), so the field stays editable. */
  urlEditable?: boolean;
  urlPlaceholder?: string;
}

export const CARDDAV_PROVIDERS: Record<string, CardDavProvider> = {
  google: {
    id: 'google',
    name: 'Google Contacts',
    serverUrl: 'https://www.googleapis.com/.well-known/carddav',
    help: 'Use Gmail address and app-specific password',
    requiresAppPassword: true,
    appPasswordUrl: 'https://myaccount.google.com/apppasswords',
  },
  icloud: {
    id: 'icloud',
    name: 'iCloud Contacts',
    serverUrl: 'https://contacts.icloud.com/',
    help: 'Use Apple ID and app-specific password',
    requiresAppPassword: true,
    appPasswordUrl: 'https://appleid.apple.com/account/manage/section/security',
  },
  outlook: {
    id: 'outlook',
    name: 'Outlook/Office 365',
    serverUrl: 'https://outlook.office365.com/',
    help: 'Use email and password',
    requiresAppPassword: false,
  },
  mailbox: {
    id: 'mailbox',
    name: 'mailbox.org',
    serverUrl: 'https://dav.mailbox.org/',
    help: 'Use your mailbox.org address; with two-factor sign-in use an app password',
    requiresAppPassword: false,
    appPasswordWithTwoFactor: true,
    appPasswordUrl: 'https://login.mailbox.org/',
  },
  fastmail: {
    id: 'fastmail',
    name: 'Fastmail',
    serverUrl: 'https://carddav.fastmail.com/',
    help: 'Use your Fastmail address and an app password',
    requiresAppPassword: true,
    appPasswordUrl: 'https://app.fastmail.com/settings/security/devicekeys/new',
  },
  posteo: {
    id: 'posteo',
    name: 'Posteo',
    serverUrl: 'https://posteo.de:8843/',
    help: 'Use your Posteo address and password',
    requiresAppPassword: false,
  },
  nextcloud: {
    id: 'nextcloud',
    name: 'Nextcloud',
    serverUrl: '',
    help: 'Use your Nextcloud address followed by /remote.php/dav',
    requiresAppPassword: false,
    appPasswordWithTwoFactor: true,
    urlEditable: true,
    urlPlaceholder: 'https://cloud.example.com/remote.php/dav',
  },
};

/** Whether the server address of this provider may be edited by hand. */
export function isServerUrlEditable(providerId: string): boolean {
  const provider = CARDDAV_PROVIDERS[providerId];
  return !provider || provider.urlEditable === true;
}

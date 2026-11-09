// lib/map/types.ts

/** One plottable point: a geocoded address or a vCard GEO location. */
export interface MapMarker {
  /** "addr_<addressId>" or "loc_<locationId>", used by /map?focus= deep links */
  id: string;
  source: 'address' | 'location';
  personId: string;
  personName: string;
  latitude: number;
  longitude: number;
  /** Address/location type or label, e.g. "home" */
  label: string;
  city: string | null;
  /** State/Province (address region), null for GEO locations */
  region: string | null;
  /** Full address as a single line for the marker popup; null for GEO locations */
  addressText: string | null;
  country: string | null;
  groupIds: string[];
  /** Whether the contact has a photo, used to render a photo thumbnail marker instead of a dot */
  hasPhoto: boolean;
  /** First group's color (in returned order), like the network graph; null falls back to the default dot color */
  groupColor: string | null;
}

export interface MapGroup {
  id: string;
  name: string;
  color: string | null;
}

/** A contact with at least one address the geocoder could not locate */
export interface UnlocatedPerson {
  personId: string;
  personName: string;
  failedCount: number;
}

/** Everything the map needs to know about one contact, located or not */
export interface MapPerson {
  personId: string;
  personName: string;
  groupIds: string[];
  /** Relationship type id (relationship to the user), null when none is set */
  relationshipTypeId: string | null;
  /** Calendar date "YYYY-MM-DD" of the last contact, null when never recorded */
  lastContact: string | null;
}

export interface MapRelationshipType {
  id: string;
  label: string;
  color: string | null;
}

/**
 * Why a contact has no marker on the map:
 * - noAddress: no address at all
 * - pending: an address is waiting for the geocoder
 * - failed: the geocoder could not locate the address
 * - disabled: the user turned address locating off
 */
export type UnplacedReason = 'noAddress' | 'pending' | 'failed' | 'disabled';

/** An existing address of an unplaced contact, in the shape the person update route accepts */
export interface UnplacedAddress {
  type: string;
  streetLine1: string | null;
  streetLine2: string | null;
  locality: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
}

/** A contact without any marker on the map, with what is needed to give it a place quickly */
export interface UnplacedPerson {
  personId: string;
  personName: string;
  reason: UnplacedReason;
  addresses: UnplacedAddress[];
}

export interface MapMarkersResponse {
  markers: MapMarker[];
  groups: MapGroup[];
  /** Every group of the user (not only those with people on the map), for adding people to groups */
  allGroups: MapGroup[];
  relationshipTypes: MapRelationshipType[];
  /** All contacts, name-sorted */
  people: MapPerson[];
  /** Contacts without a marker, name-sorted */
  unplacedPeople: UnplacedPerson[];
  pendingCount: number;
  failedCount: number;
  /** Contacts with failed addresses, name-sorted, for the map's unlocated drawer */
  unlocatedPeople: UnlocatedPerson[];
  /** The user's geocoding privacy toggle, used by the map's empty state */
  geocodingEnabled: boolean;
}

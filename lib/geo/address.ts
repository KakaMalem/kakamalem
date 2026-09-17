/**
 * Rendering a delivery address.
 *
 * A store collects addresses one of two ways (`tenants.checkoutAddressMode`):
 *
 * - **gps** — the shopper drops a pin. `latitude` / `longitude` are real, and
 *   `plusCode` / `city` are derived from them.
 * - **standard_form** — the shopper types a postal address. The street fields
 *   are filled and `latitude` / `longitude` are stored as `0` / `0`, because
 *   the columns are not nullable.
 *
 * Every display should therefore branch on what the address actually contains,
 * not on the store's current mode: an order keeps the shape it was captured in
 * even after the seller switches modes. These helpers are that branch, so the
 * dashboard, the storefront and exports all describe an address the same way.
 *
 * Note the `0` / `0` sentinel is also why `{address.latitude && <Map/>}` is a
 * trap — it renders a bare "0" for typed addresses. Use `hasMapLocation()`.
 */

import type { Address } from "@/lib/db/schema";
import { getCountryName } from "./countries";

/** Tolerates partial rows and legacy orders missing the newer fields. */
export type AddressLike = Partial<Address> | null | undefined;

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Whether this address carries a real map pin.
 *
 * `0` / `0` is the "no pin" sentinel used by standard-form addresses. It is
 * also in the Gulf of Guinea, so treating it as a location produces a map of
 * open ocean and a Google Maps link to nowhere.
 */
export function hasMapLocation(address: AddressLike): boolean {
  const lat = Number(address?.latitude);
  const lng = Number(address?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat !== 0 || lng !== 0;
}

/** Whether this address was typed into the standard form. */
export function hasPostalAddress(address: AddressLike): boolean {
  return clean(address?.addressLine1) !== null;
}

/** "Sher Agha", or null when neither name was captured. */
export function formatRecipientName(address: AddressLike): string | null {
  const first = clean(address?.firstName) ?? "";
  const last = clean(address?.lastName) ?? "";
  return clean(`${first} ${last}`);
}

/**
 * The typed address as display lines, most specific first:
 * street, second line, "city, province postcode", country.
 */
export function formatPostalAddressLines(address: AddressLike): string[] {
  // A reverse-geocoded city on a pinned address is not a postal address. Only
  // a typed street line makes this the right way to describe the location,
  // otherwise callers would render "Kabul" and drop the plus code.
  if (!hasPostalAddress(address) || !address) return [];

  const lines: string[] = [];

  const line1 = clean(address.addressLine1);
  if (line1) lines.push(line1);

  const line2 = clean(address.addressLine2);
  if (line2) lines.push(line2);

  const city = clean(address.city);
  const province = clean(address.province);
  const postalCode = clean(address.postalCode);
  const locality = [city, province].filter(Boolean).join(", ");
  const localityLine = [locality, postalCode].filter(Boolean).join(" ");
  if (localityLine) lines.push(localityLine);

  const country = getCountryName(address.country);
  if (country) lines.push(country);

  return lines;
}

/**
 * Coordinates as shown to a human. Returns null when there is no pin, so
 * callers never print "0.000000, 0.000000".
 */
export function formatCoordinates(address: AddressLike): string | null {
  if (!hasMapLocation(address)) return null;
  const lat = Number(address?.latitude);
  const lng = Number(address?.longitude);
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

/**
 * Google Maps link for the pin, or null when the address has no pin.
 */
export function getGoogleMapsUrl(address: AddressLike): string | null {
  if (!hasMapLocation(address)) return null;
  return `https://www.google.com/maps?q=${Number(address?.latitude)},${Number(
    address?.longitude
  )}`;
}

/**
 * One line suitable for a table cell, a spreadsheet column or a receipt.
 * Prefers the typed address, then the plus code, then raw coordinates.
 */
export function formatAddressOneLine(address: AddressLike): string {
  if (!address) return "";

  const postalLines = formatPostalAddressLines(address);
  if (postalLines.length > 0) return postalLines.join(", ");

  const plusCode = clean(address.plusCode);
  const city = clean(address.city);
  if (plusCode) return [plusCode, city].filter(Boolean).join(" ");
  if (city) return city;

  return formatCoordinates(address) ?? "";
}

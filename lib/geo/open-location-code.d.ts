declare module "open-location-code" {
  interface CodeArea {
    latitudeLo: number;
    longitudeLo: number;
    latitudeHi: number;
    longitudeHi: number;
    latitudeCenter: number;
    longitudeCenter: number;
    codeLength: number;
  }

  class OpenLocationCode {
    encode(latitude: number, longitude: number, codeLength?: number): string;
    decode(code: string): CodeArea;
    isValid(code: string): boolean;
    isShort(code: string): boolean;
    isFull(code: string): boolean;
    shorten(
      code: string,
      referenceLatitude: number,
      referenceLongitude: number
    ): string;
    recoverNearest(
      shortCode: string,
      referenceLatitude: number,
      referenceLongitude: number
    ): string;
  }

  export { OpenLocationCode, CodeArea };
}

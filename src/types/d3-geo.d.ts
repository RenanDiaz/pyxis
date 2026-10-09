declare module 'd3-geo' {
  /** Lo mínimo que usa StatesMap de `geoIdentity` (el paquete no trae tipos). */
  export interface GeoIdentityTransform {
    scale(k: number): GeoIdentityTransform
    translate(t: [number, number]): GeoIdentityTransform
  }
  export function geoIdentity(): GeoIdentityTransform
}

declare module 'react-simple-maps' {
  import { ComponentType, SVGProps, ReactNode, MouseEvent } from 'react'
  import type { GeoIdentityTransform } from 'd3-geo'

  /** Feature de la topología que entrega `Geographies`. */
  export interface MapGeography {
    rsmKey: string
    properties: Record<string, unknown>
  }

  interface ZoomPosition {
    coordinates: [number, number]
    zoom: number
  }

  interface ProjectionConfig {
    rotate?: [number, number, number]
    center?: [number, number]
    parallels?: [number, number]
    scale?: number
  }

  interface ComposableMapProps extends SVGProps<SVGSVGElement> {
    projection?: string | GeoIdentityTransform
    projectionConfig?: ProjectionConfig
    width?: number
    height?: number
    children?: ReactNode
  }

  interface ZoomableGroupProps {
    center?: [number, number]
    zoom?: number
    minZoom?: number
    maxZoom?: number
    translateExtent?: [[number, number], [number, number]]
    onMoveStart?: (event: unknown, position: ZoomPosition) => void
    onMove?: (event: unknown, position: ZoomPosition) => void
    onMoveEnd?: (event: unknown, position: ZoomPosition) => void
    children?: ReactNode
  }

  interface GeographiesProps {
    geography: string | Record<string, unknown>
    children: (data: { geographies: MapGeography[] }) => ReactNode
  }

  interface GeographyStyleProps {
    default?: React.CSSProperties
    hover?: React.CSSProperties
    pressed?: React.CSSProperties
  }

  interface GeographyProps extends Omit<SVGProps<SVGPathElement>, 'style'> {
    geography: MapGeography
    style?: GeographyStyleProps
    onMouseEnter?: (event: MouseEvent<SVGPathElement>) => void
    onMouseLeave?: (event: MouseEvent<SVGPathElement>) => void
    onMouseMove?: (event: MouseEvent<SVGPathElement>) => void
    onClick?: (event: MouseEvent<SVGPathElement>) => void
  }

  interface MarkerProps extends SVGProps<SVGGElement> {
    coordinates: [number, number]
    children?: ReactNode
  }

  interface AnnotationProps {
    subject: [number, number]
    dx?: number
    dy?: number
    connectorProps?: SVGProps<SVGPathElement>
    children?: ReactNode
  }

  export const ComposableMap: ComponentType<ComposableMapProps>
  export const ZoomableGroup: ComponentType<ZoomableGroupProps>
  export const Geographies: ComponentType<GeographiesProps>
  export const Geography: ComponentType<GeographyProps>
  export const Marker: ComponentType<MarkerProps>
  export const Annotation: ComponentType<AnnotationProps>
  export const Graticule: ComponentType<SVGProps<SVGPathElement>>
  export const Sphere: ComponentType<SVGProps<SVGPathElement>>
  export const Line: ComponentType<SVGProps<SVGPathElement>>
}

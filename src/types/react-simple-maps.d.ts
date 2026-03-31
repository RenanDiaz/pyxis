declare module 'react-simple-maps' {
  import { ComponentType, SVGProps, ReactNode } from 'react'

  interface ProjectionConfig {
    rotate?: [number, number, number]
    center?: [number, number]
    parallels?: [number, number]
    scale?: number
  }

  interface ComposableMapProps extends SVGProps<SVGSVGElement> {
    projection?: string
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
    onMoveStart?: (event: any, position: any) => void
    onMove?: (event: any, position: any) => void
    onMoveEnd?: (event: any, position: any) => void
    children?: ReactNode
  }

  interface GeographiesProps {
    geography: string | Record<string, unknown>
    children: (data: { geographies: any[] }) => ReactNode
  }

  interface GeographyStyleProps {
    default?: React.CSSProperties
    hover?: React.CSSProperties
    pressed?: React.CSSProperties
  }

  interface GeographyProps extends Omit<SVGProps<SVGPathElement>, 'style'> {
    geography: any
    style?: GeographyStyleProps
    onMouseEnter?: (event: any) => void
    onMouseLeave?: (event: any) => void
    onMouseMove?: (event: any) => void
    onClick?: (event: any) => void
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
  export const Graticule: ComponentType<any>
  export const Sphere: ComponentType<any>
  export const Line: ComponentType<any>
}

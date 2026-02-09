import "leaflet";

declare module "leaflet" {
  interface Layer {
    pm: PM.PMLayer;
  }

  interface Map {
    pm: PM.PMMap;
  }

  namespace PM {
    interface PMLayer {
      enable(options?: PMLayerOptions): void;
      disable(): void;
      enabled(): boolean;
      toggleEdit(options?: PMLayerOptions): void;
    }

    interface PMLayerOptions {
      allowSelfIntersection?: boolean;
      preventMarkerRemoval?: boolean;
      snappable?: boolean;
      snapDistance?: number;
    }

    interface PMMap {
      addControls(options?: PMControlOptions): void;
      removeControls(): void;
      toggleControls(): void;
      controlsVisible(): boolean;
      enableDraw(shape: string, options?: PMDrawOptions): void;
      disableDraw(shape?: string): void;
      setPathOptions(options: L.PathOptions): void;
      getGeomanLayers(asGroup?: boolean): L.Layer[] | L.LayerGroup;
      getGeomanDrawLayers(asGroup?: boolean): L.Layer[] | L.LayerGroup;
    }

    interface PMControlOptions {
      position?: L.ControlPosition;
      drawMarker?: boolean;
      drawCircleMarker?: boolean;
      drawPolyline?: boolean;
      drawRectangle?: boolean;
      drawPolygon?: boolean;
      drawCircle?: boolean;
      editMode?: boolean;
      dragMode?: boolean;
      cutPolygon?: boolean;
      removalMode?: boolean;
      rotateMode?: boolean;
    }

    interface PMDrawOptions {
      snappable?: boolean;
      snapDistance?: number;
      allowSelfIntersection?: boolean;
      templineStyle?: L.PathOptions;
      hintlineStyle?: L.PathOptions;
      pathOptions?: L.PathOptions;
    }
  }
}

declare module "@geoman-io/leaflet-geoman-free" {
  // This module augments Leaflet with PM functionality
  export {};
}

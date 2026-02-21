import { DropZone } from "@puckeditor/core";
import type { BentoGridProps } from "@/lib/page-builder/types";

const gapMap = { none: "0px", sm: "8px", md: "16px", lg: "24px" };
const heightMap = { small: "300px", medium: "450px", large: "600px" };

const ALLOWED_COMPONENTS = [
  "HeroBanner",
  "RichText",
  "ProductSpotlight",
  "ImageGallery",
  "Spacer",
];

/**
 * Grid template CSS for each layout option.
 * Each template defines grid-template-columns and grid-template-rows,
 * plus a list of cells with their grid-area assignments.
 */
const gridTemplates: Record<
  BentoGridProps["gridTemplate"],
  {
    columns: string;
    rows: string;
    cells: { area: string }[];
  }
> = {
  "2x2": {
    columns: "1fr 1fr",
    rows: "1fr 1fr",
    cells: [
      { area: "1 / 1 / 2 / 2" },
      { area: "1 / 2 / 2 / 3" },
      { area: "2 / 1 / 3 / 2" },
      { area: "2 / 2 / 3 / 3" },
    ],
  },
  "1-2": {
    columns: "1fr 1fr",
    rows: "2fr 1fr",
    cells: [
      { area: "1 / 1 / 2 / 3" }, // full width top
      { area: "2 / 1 / 3 / 2" }, // bottom left
      { area: "2 / 2 / 3 / 3" }, // bottom right
    ],
  },
  "2-1": {
    columns: "1fr 1fr",
    rows: "1fr 2fr",
    cells: [
      { area: "1 / 1 / 2 / 2" }, // top left
      { area: "1 / 2 / 2 / 3" }, // top right
      { area: "2 / 1 / 3 / 3" }, // full width bottom
    ],
  },
  "featured-left": {
    columns: "2fr 1fr",
    rows: "1fr 1fr",
    cells: [
      { area: "1 / 1 / 3 / 2" }, // tall left
      { area: "1 / 2 / 2 / 3" }, // top right
      { area: "2 / 2 / 3 / 3" }, // bottom right
    ],
  },
  "featured-right": {
    columns: "1fr 2fr",
    rows: "1fr 1fr",
    cells: [
      { area: "1 / 1 / 2 / 2" }, // top left
      { area: "2 / 1 / 3 / 2" }, // bottom left
      { area: "1 / 2 / 3 / 3" }, // tall right
    ],
  },
};

export function BentoGridSection(
  props: BentoGridProps & { id: string; puck?: unknown }
) {
  const { title, gridTemplate, gap, minHeight } = props;

  const template = gridTemplates[gridTemplate];
  const gapValue = gapMap[gap];
  const minH = heightMap[minHeight];

  return (
    <section className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {title && (
          <h2 className="mb-6 text-2xl font-bold tracking-tight">{title}</h2>
        )}
        <div
          className="grid"
          style={{
            gridTemplateColumns: template.columns,
            gridTemplateRows: template.rows,
            gap: gapValue,
            minHeight: minH,
          }}
        >
          {template.cells.map((cell, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-lg border bg-card"
              style={{ gridArea: cell.area }}
            >
              <DropZone zone={`bento-cell-${i}`} allow={ALLOWED_COMPONENTS} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

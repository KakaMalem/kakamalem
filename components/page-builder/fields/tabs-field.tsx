"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  CollectionTab,
  CollectionTabCard,
} from "@/lib/page-builder/types";

const MAX_TABS = 4;
const MAX_CARDS_PER_TAB = 8;

const defaultCard: CollectionTabCard = {
  imageUrl: "",
  mobileImageUrl: "",
  title: "",
  subtitle: "",
  href: "",
  aspectRatio: "4/5",
};

const aspectRatioOptions: {
  value: CollectionTabCard["aspectRatio"];
  label: string;
}[] = [
  { value: "4/5", label: "4:5 (Portrait)" },
  { value: "3/4", label: "3:4 (Tall)" },
  { value: "1/1", label: "1:1 (Square)" },
  { value: "16/9", label: "16:9 (Wide)" },
];

interface TabsFieldProps {
  value: CollectionTab[];
  onChange: (value: CollectionTab[]) => void;
}

function TabsField({ value = [], onChange }: TabsFieldProps) {
  const [expandedTab, setExpandedTab] = useState<number | null>(
    value.length === 0 ? null : 0
  );
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  // --- Tab CRUD ---
  const addTab = () => {
    if (value.length >= MAX_TABS) return;
    const updated = [...value, { label: "", cards: [] }];
    onChange(updated);
    setExpandedTab(updated.length - 1);
  };

  const removeTab = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
    if (expandedTab === index) setExpandedTab(null);
  };

  const updateTabLabel = (index: number, label: string) => {
    const updated = value.map((tab, i) =>
      i === index ? { ...tab, label } : tab
    );
    onChange(updated);
  };

  // --- Card CRUD within a tab ---
  const addCard = (tabIndex: number) => {
    const tab = value[tabIndex];
    if (tab.cards.length >= MAX_CARDS_PER_TAB) return;
    const updated = value.map((t, i) =>
      i === tabIndex ? { ...t, cards: [...t.cards, { ...defaultCard }] } : t
    );
    onChange(updated);
    setExpandedCard(`${tabIndex}-${tab.cards.length}`);
  };

  const removeCard = (tabIndex: number, cardIndex: number) => {
    const updated = value.map((t, i) =>
      i === tabIndex
        ? { ...t, cards: t.cards.filter((_, ci) => ci !== cardIndex) }
        : t
    );
    onChange(updated);
    if (expandedCard === `${tabIndex}-${cardIndex}`) setExpandedCard(null);
  };

  const updateCard = (
    tabIndex: number,
    cardIndex: number,
    updates: Partial<CollectionTabCard>
  ) => {
    const updated = value.map((t, i) =>
      i === tabIndex
        ? {
            ...t,
            cards: t.cards.map((c, ci) =>
              ci === cardIndex ? { ...c, ...updates } : c
            ),
          }
        : t
    );
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {value.map((tab, tabIdx) => (
        <div key={tabIdx} className="rounded-md border">
          {/* Tab accordion header */}
          <button
            type="button"
            className="flex w-full items-center gap-2 p-2.5 text-left hover:bg-muted/50"
            onClick={() =>
              setExpandedTab(expandedTab === tabIdx ? null : tabIdx)
            }
          >
            {expandedTab === tabIdx ? (
              <ChevronDown className="size-3.5 shrink-0" />
            ) : (
              <ChevronRight className="size-3.5 shrink-0" />
            )}
            <span className="flex-1 truncate text-xs font-medium">
              {tab.label || `Tab ${tabIdx + 1}`}
            </span>
            <span className="mr-1 text-[10px] text-muted-foreground">
              {tab.cards.length} card{tab.cards.length !== 1 ? "s" : ""}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 shrink-0 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                removeTab(tabIdx);
              }}
            >
              <Trash2 className="size-3" />
            </Button>
          </button>

          {/* Tab accordion content */}
          {expandedTab === tabIdx && (
            <div className="space-y-2 border-t px-2.5 py-2.5">
              {/* Tab label */}
              <div className="space-y-1">
                <Label className="text-xs">Tab Label</Label>
                <Input
                  value={tab.label}
                  onChange={(e) => updateTabLabel(tabIdx, e.target.value)}
                  placeholder="e.g. Women, Men, Kids"
                  className="h-7 text-xs"
                />
              </div>

              {/* Cards list */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Cards ({tab.cards.length}/{MAX_CARDS_PER_TAB})
                </Label>

                {tab.cards.map((card, cardIdx) => {
                  const cardKey = `${tabIdx}-${cardIdx}`;
                  const isCardExpanded = expandedCard === cardKey;

                  return (
                    <div key={cardIdx} className="rounded border bg-muted/30">
                      {/* Card header */}
                      <button
                        type="button"
                        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left hover:bg-muted/50"
                        onClick={() =>
                          setExpandedCard(isCardExpanded ? null : cardKey)
                        }
                      >
                        {isCardExpanded ? (
                          <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
                        )}
                        <span className="flex-1 truncate text-[11px]">
                          {card.title || `Card ${cardIdx + 1}`}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-5 shrink-0 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeCard(tabIdx, cardIdx);
                          }}
                        >
                          <Trash2 className="size-2.5" />
                        </Button>
                      </button>

                      {/* Card fields */}
                      {isCardExpanded && (
                        <div className="space-y-1.5 border-t px-2 py-2">
                          <div className="space-y-0.5">
                            <Label className="text-[10px]">Image URL</Label>
                            <Input
                              value={card.imageUrl}
                              onChange={(e) =>
                                updateCard(tabIdx, cardIdx, {
                                  imageUrl: e.target.value,
                                })
                              }
                              placeholder="https://..."
                              className="h-6 text-[11px]"
                            />
                          </div>
                          <div className="space-y-0.5">
                            <Label className="text-[10px]">Title</Label>
                            <Input
                              value={card.title}
                              onChange={(e) =>
                                updateCard(tabIdx, cardIdx, {
                                  title: e.target.value,
                                })
                              }
                              placeholder="Card title"
                              className="h-6 text-[11px]"
                            />
                          </div>
                          <div className="space-y-0.5">
                            <Label className="text-[10px]">Subtitle</Label>
                            <Input
                              value={card.subtitle}
                              onChange={(e) =>
                                updateCard(tabIdx, cardIdx, {
                                  subtitle: e.target.value,
                                })
                              }
                              placeholder="Short subtitle"
                              className="h-6 text-[11px]"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <div className="space-y-0.5">
                              <Label className="text-[10px]">Link</Label>
                              <Input
                                value={card.href}
                                onChange={(e) =>
                                  updateCard(tabIdx, cardIdx, {
                                    href: e.target.value,
                                  })
                                }
                                placeholder="/products"
                                className="h-6 text-[11px]"
                              />
                            </div>
                            <div className="space-y-0.5">
                              <Label className="text-[10px]">
                                Aspect Ratio
                              </Label>
                              <select
                                value={card.aspectRatio}
                                onChange={(e) =>
                                  updateCard(tabIdx, cardIdx, {
                                    aspectRatio: e.target
                                      .value as CollectionTabCard["aspectRatio"],
                                  })
                                }
                                className="h-6 w-full rounded border border-input bg-background px-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring"
                              >
                                {aspectRatioOptions.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {tab.cards.length < MAX_CARDS_PER_TAB && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addCard(tabIdx)}
                    className="h-7 w-full gap-1 text-[11px] text-muted-foreground"
                  >
                    <Plus className="size-3" />
                    Add Card
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      {value.length < MAX_TABS && (
        <Button
          variant="outline"
          size="sm"
          onClick={addTab}
          className="w-full gap-1.5 text-xs"
        >
          <Plus className="size-3.5" />
          Add Tab
        </Button>
      )}
    </div>
  );
}

export function TabsFieldRender({
  value,
  onChange,
}: {
  value: CollectionTab[];
  onChange: (v: CollectionTab[]) => void;
}) {
  return <TabsField value={value} onChange={onChange} />;
}

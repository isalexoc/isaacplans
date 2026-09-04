"use client";

import { useEffect, useMemo, useState } from "react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { matchesObjection } from "@/lib/objections/search";
import {
  OBJECTION_TYPES,
  OBJECTION_TYPE_DOT,
  OBJECTION_TYPE_LABELS,
  objectionTitle,
  type Objection,
  type ObjectionType,
} from "@/lib/objections/types";
import type { ScriptLang } from "@/components/presentation-scripts/script-portable-text";

/**
 * "What did they just say?" — three letters and Enter.
 *
 * Built from Dialog + Command rather than CommandDialog, because CommandDialog accepts only
 * DialogProps and hardcodes its inner <Command>, so `shouldFilter` cannot reach it. The two
 * existing cmdk call sites in this repo compose the same way.
 *
 * `shouldFilter={false}` is not a preference: cmdk's own scorer is not diacritic-insensitive, so
 * "cotizacion" would never match "cotización". Filtering with the same matchesObjection() the grid
 * uses also guarantees the palette and the grid can never disagree about what exists.
 */

interface ObjectionCommandPaletteProps {
  objections: Objection[];
  language: ScriptLang;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string) => void;
}

export default function ObjectionCommandPalette({
  objections,
  language,
  open,
  onOpenChange,
  onSelect,
}: ObjectionCommandPaletteProps) {
  const [query, setQuery] = useState("");

  // A stale query on reopen would hide everything behind a filter the agent forgot they typed.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const grouped = useMemo(() => {
    const matching = objections.filter((objection) => matchesObjection(objection, query));
    return OBJECTION_TYPES.map((type) => ({
      type,
      items: matching.filter((objection) => objection.objectionType === type),
    })).filter((group) => group.items.length > 0);
  }, [objections, query]);

  const total = grouped.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className={cn(
          "top-[12%] max-h-[76vh] translate-y-0 gap-0 overflow-hidden p-0",
          "w-[calc(100vw-1.5rem)] max-w-none sm:w-full sm:max-w-xl"
        )}
      >
        <VisuallyHidden>
          <DialogTitle>
            {language === "en" ? "Find an objection" : "Buscar una objeción"}
          </DialogTitle>
        </VisuallyHidden>

        <Command shouldFilter={false} loop>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={
              language === "en" ? "What did they just say?" : "¿Qué acaba de decir?"
            }
            className="h-14 text-base"
          />
          <CommandList className="max-h-[62vh]">
            {total === 0 && (
              <CommandEmpty className="py-10 text-center text-base text-muted-foreground">
                {language === "en" ? "No objection matches that." : "Ninguna objeción coincide."}
              </CommandEmpty>
            )}
            {grouped.map((group) => (
              <CommandGroup
                key={group.type}
                heading={OBJECTION_TYPE_LABELS[group.type as ObjectionType][language]}
              >
                {group.items.map((objection) => (
                  <CommandItem
                    // The id, not the title: with shouldFilter off this is only a selection key,
                    // and two objections sharing a title would otherwise both highlight.
                    key={objection._id}
                    value={objection._id}
                    onSelect={() => onSelect(objection._id)}
                    className="cursor-pointer gap-3 px-3 py-3.5 text-base"
                  >
                    <span
                      className={cn(
                        "h-2.5 w-2.5 shrink-0 rounded-full",
                        OBJECTION_TYPE_DOT[objection.objectionType]
                      )}
                    />
                    <span className="flex-1 font-medium">
                      {objectionTitle(objection, language)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

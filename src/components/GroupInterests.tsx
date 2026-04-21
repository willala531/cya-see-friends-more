import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { cyaTransition } from "@/lib/motion";
import {
  CATEGORY_ORDER,
  CATEGORY_EMOJI,
  activitiesByCategory,
  type Activity,
} from "@/data/activities";
import { useUpdateGroupInterests } from "@/hooks/useGroups";

// ─── Component ────────────────────────────────────────────────────────────────

interface GroupInterestsProps {
  groupId: string;
  /** Current group_interests array from Supabase (activity IDs). */
  interests: string[];
}

const GroupInterests = ({ groupId, interests }: GroupInterestsProps) => {
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const updateInterests = useUpdateGroupInterests();

  const toggle = (id: string) => {
    const next = interests.includes(id)
      ? interests.filter((x) => x !== id)
      : [...interests, id];
    updateInterests.mutate({ groupId, interestIds: next });
  };

  const toggleAll = (catActivities: Activity[]) => {
    const ids = catActivities.map((a) => a.id);
    const allSelected = ids.every((id) => interests.includes(id));
    const next = allSelected
      ? interests.filter((id) => !ids.includes(id))
      : [...new Set([...interests, ...ids])];
    updateInterests.mutate({ groupId, interestIds: next });
  };

  return (
    <div className="space-y-1.5">
      {CATEGORY_ORDER.map((category) => {
        const catActivities = activitiesByCategory[category] ?? [];
        const selectedCount = catActivities.filter((a) =>
          interests.includes(a.id),
        ).length;
        const allSelected =
          catActivities.length > 0 && selectedCount === catActivities.length;
        const isOpen = openCategory === category;

        return (
          <div
            key={category}
            className="glass-surface rounded-lg overflow-hidden"
          >
            {/* Category header row */}
            <button
              onClick={() => setOpenCategory(isOpen ? null : category)}
              className="w-full px-3 py-2.5 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <span className="text-base leading-none">
                  {CATEGORY_EMOJI[category]}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {category}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {selectedCount > 0 && (
                  <span className="font-mono-data text-[10px] text-primary">
                    {selectedCount}/{catActivities.length}
                  </span>
                )}
                <motion.div
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <ChevronDown size={14} className="text-muted-foreground" />
                </motion.div>
              </div>
            </button>

            {/* Expanded activity list */}
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key="content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={cyaTransition}
                  className="overflow-hidden"
                >
                  <div className="px-3 pb-3 border-t border-border/40 pt-2.5">
                    {/* Select All toggle */}
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => toggleAll(catActivities)}
                      className={`mb-2.5 px-2.5 py-1 rounded-md text-[11px] font-mono-data transition-all duration-150 ${
                        allSelected
                          ? "bg-primary text-primary-foreground shadow-gloss"
                          : "bg-secondary text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {allSelected ? "✓ ALL SELECTED" : "SELECT ALL"}
                    </motion.button>

                    {/* Activity chips */}
                    <div className="flex flex-wrap gap-1.5">
                      {catActivities.map((activity) => {
                        const selected = interests.includes(activity.id);
                        return (
                          <motion.button
                            key={activity.id}
                            whileTap={{ scale: 0.94 }}
                            onClick={() => toggle(activity.id)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 ${
                              selected
                                ? "bg-primary text-primary-foreground shadow-gloss"
                                : "bg-secondary text-secondary-foreground hover:shadow-gloss-hover"
                            }`}
                          >
                            {selected && <Check size={9} />}
                            {activity.name}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
};

export default GroupInterests;

import { useMemo } from "react";
import { useData } from "./store";

export function useContractorNames() {
  const contractors = useData((s) => s.contractors);
  return useMemo(() => {
    const m = new Map(contractors.map((c) => [c.id, c.name]));
    return (id?: string) => (id ? (m.get(id) ?? id) : "—");
  }, [contractors]);
}

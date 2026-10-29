// Replace useQuery/render in rider trips.tsx:
import { useMemo } from "react";
// ...
const mine = useMemo(() => (data ?? []).filter(r => r.driver_id === session?.user.id), [data, session?.user.id]);
// pass `data={mine}` to FlatList


package ak.base;

import java.util.*;

/**
 * Core RIIC combo analysis logic.
 *
 * IMPORTANT: elite-promotion LMD/EXP cost figures used here are ROUGH,
 * rarity-based averages for ROI ballparking only -- NOT exact per-operator
 * costs (those vary operator-to-operator and Chip costs aren't modeled at
 * all). Always double check exact costs in-game or on PRTS.wiki before
 * committing resources.
 */
public final class Analyzer {

    private final DataStore store;

    public Analyzer(DataStore store) {
        this.store = store;
    }

    // Rough average LMD cost per elite promotion step, by rarity.
    private static int estLmdCost(int rarity, int fromElite, int toElite) {
        // very rough averages, purely for ballparking ROI/day payback
        Map<Integer, int[]> table = new HashMap<>();
        table.put(6, new int[]{0, 60000, 150000});   // [n/a, E0->E1, E1->E2]
        table.put(5, new int[]{0, 40000, 90000});
        table.put(4, new int[]{0, 20000, 60000});
        table.put(3, new int[]{0, 10000, 30000});
        table.put(2, new int[]{0, 5000, 0});
        table.put(1, new int[]{0, 0, 0});
        int[] costs = table.getOrDefault(rarity, new int[]{0, 30000, 80000});
        int total = 0;
        for (int e = fromElite; e < toElite; e++) {
            if (e + 1 < costs.length) total += costs[e + 1];
        }
        return total;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> analyze(List<Map<String, Object>> roster) {
        // Index roster by operator name (case-insensitive) -> roster entry
        Map<String, Map<String, Object>> rosterByName = new LinkedHashMap<>();
        for (Map<String, Object> r : roster) {
            String name = (String) r.get("name");
            if (name != null) rosterByName.put(name.toLowerCase(Locale.ROOT), r);
        }

        List<Map<String, Object>> comboResults = new ArrayList<>();
        List<Map<String, Object>> priorityS = new ArrayList<>();
        List<Map<String, Object>> priorityA = new ArrayList<>();
        List<Map<String, Object>> priorityB = new ArrayList<>();
        List<Map<String, Object>> priorityC = new ArrayList<>();
        List<Map<String, Object>> notOwnedSuggestions = new ArrayList<>();

        for (Map<String, Object> combo : store.combos) {
            String tag = (String) combo.get("tag");
            String comboName = (String) combo.get("name");
            String room = (String) combo.get("room");
            double minOperators = ((Number) combo.getOrDefault("min_operators", 1.0)).doubleValue();

            List<Map<String, Object>> activeOps = new ArrayList<>();
            List<Map<String, Object>> underleveledOps = new ArrayList<>();
            List<String> missingOwnedOps = new ArrayList<>();

            for (Map<String, Object> op : store.operators) {
                String opName = (String) op.get("name");
                int rarity = ((Number) op.getOrDefault("rarity", 4.0)).intValue();
                List<Map<String, Object>> skills = (List<Map<String, Object>>) (List<?>) op.get("skills");
                for (Map<String, Object> skill : skills) {
                    List<Object> tags = (List<Object>) skill.getOrDefault("combo_tags", Collections.emptyList());
                    if (!tags.contains(tag)) continue;

                    int reqElite = ((Number) skill.getOrDefault("elite_required", 0.0)).intValue();
                    Map<String, Object> rosterEntry = rosterByName.get(opName.toLowerCase(Locale.ROOT));

                    if (rosterEntry == null) {
                        missingOwnedOps.add(opName);
                        continue;
                    }
                    int curElite = ((Number) rosterEntry.getOrDefault("elite", 0.0)).intValue();
                    if (curElite >= reqElite) {
                        Map<String, Object> entry = new LinkedHashMap<>();
                        entry.put("name", opName);
                        entry.put("skill", skill.get("name"));
                        entry.put("effect", skill.get("effect"));
                        entry.put("value_pct", skill.get("value_pct"));
                        activeOps.add(entry);
                    } else {
                        int lmd = estLmdCost(rarity, curElite, reqElite);
                        Map<String, Object> entry = new LinkedHashMap<>();
                        entry.put("name", opName);
                        entry.put("current_elite", curElite);
                        entry.put("required_elite", reqElite);
                        entry.put("skill", skill.get("name"));
                        entry.put("effect", skill.get("effect"));
                        entry.put("est_lmd_cost", lmd);
                        entry.put("note", "Chi phí LMD là ước tính theo rarity, CHƯA gồm Chip/EXP/Skill-summon. Kiểm tra trong game trước khi nâng.");
                        underleveledOps.add(entry);
                    }
                }
            }

            String status;
            if (activeOps.size() >= minOperators) status = "active";
            else if (!underleveledOps.isEmpty()) status = "partial";
            else if (activeOps.isEmpty() && underleveledOps.isEmpty()) status = "not_owned";
            else status = "unavailable";

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("tag", tag);
            result.put("name", comboName);
            result.put("room", room);
            result.put("status", status);
            result.put("active_operators", activeOps);
            result.put("underleveled_operators", underleveledOps);
            result.put("missing_owned_operators", missingOwnedOps);
            result.put("description", combo.get("description"));
            result.put("notes", combo.get("notes"));
            comboResults.add(result);

            // ---- Priority bucketing ----
            if (status.equals("partial")) {
                for (Map<String, Object> u : underleveledOps) {
                    Map<String, Object> pItem = new LinkedHashMap<>();
                    pItem.put("operator", u.get("name"));
                    pItem.put("combo", comboName);
                    pItem.put("room", room);
                    pItem.put("elite_upgrade", u.get("current_elite") + " -> " + u.get("required_elite"));
                    pItem.put("est_lmd_cost", u.get("est_lmd_cost"));

                    boolean isFiller = tag.contains("filler");
                    int eliteGap = ((Number) u.get("required_elite")).intValue() - ((Number) u.get("current_elite")).intValue();
                    long lmd = ((Number) u.get("est_lmd_cost")).longValue();

                    if (isFiller) {
                        pItem.put("reason", "Chỉ là filler tiết kiệm tài nguyên, không tăng lợi nhuận đáng kể.");
                        priorityC.add(pItem);
                    } else if (eliteGap == 1 && lmd <= 65000) {
                        pItem.put("reason", "Combo core, chỉ cần nâng elite thêm 1 bậc với chi phí thấp -> ROI tốt.");
                        priorityS.add(pItem);
                    } else if (lmd <= 100000) {
                        pItem.put("reason", "Combo core, chi phí trung bình, đáng cân nhắc nếu dùng phòng này nhiều.");
                        priorityA.add(pItem);
                    } else {
                        pItem.put("reason", "Chi phí nâng cao (đặc biệt nếu cần E2 + module), chỉ nên nâng nếu đã ổn định roster khác.");
                        priorityB.add(pItem);
                    }
                }
            } else if (status.equals("not_owned") && !missingOwnedOps.isEmpty()) {
                Map<String, Object> sug = new LinkedHashMap<>();
                sug.put("combo", comboName);
                sug.put("room", room);
                sug.put("operators_needed", missingOwnedOps);
                sug.put("note", "Nếu sau này sở hữu " + String.join("/", missingOwnedOps) + " thì có thể chuyển sang combo \"" + comboName + "\".");
                notOwnedSuggestions.add(sug);
            }
        }

        Map<String, Object> priority = new LinkedHashMap<>();
        priority.put("S", priorityS);
        priority.put("A", priorityA);
        priority.put("B", priorityB);
        priority.put("C", priorityC);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("combos", comboResults);
        out.put("priority", priority);
        out.put("not_owned_suggestions", notOwnedSuggestions);
        return out;
    }
}

package ak.base;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;

/** Loads operators.json / combos.json from disk into memory. */
public final class DataStore {

    public final List<Map<String, Object>> operators;
    public final List<Map<String, Object>> combos;

    @SuppressWarnings("unchecked")
    public DataStore(Path dataDir) throws IOException {
        String opText = new String(Files.readAllBytes(dataDir.resolve("operators.json")));
        String comboText = new String(Files.readAllBytes(dataDir.resolve("combos.json")));

        Map<String, Object> opRoot = (Map<String, Object>) Json.parse(opText);
        Map<String, Object> comboRoot = (Map<String, Object>) Json.parse(comboText);

        this.operators = (List<Map<String, Object>>) (List<?>) opRoot.get("operators");
        this.combos = (List<Map<String, Object>>) (List<?>) comboRoot.get("combos");
    }

    public Optional<Map<String, Object>> findOperator(String name) {
        for (Map<String, Object> op : operators) {
            if (((String) op.get("name")).equalsIgnoreCase(name)) return Optional.of(op);
        }
        return Optional.empty();
    }
}

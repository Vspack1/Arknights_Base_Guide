package ak.base;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.*;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

public final class Server {

    private final DataStore store;
    private final Analyzer analyzer;
    private final Path frontendDir;

    public Server(DataStore store, Path frontendDir) {
        this.store = store;
        this.analyzer = new Analyzer(store);
        this.frontendDir = frontendDir;
    }

    public static void main(String[] args) throws Exception {
        int port = args.length > 0 ? Integer.parseInt(args[0]) : 8080;

        Path backendRoot = Paths.get(Server.class.getProtectionDomain()
                .getCodeSource().getLocation().toURI()).getParent();
        // Assume standard layout: backend/data and frontend/ are siblings of backend/
        Path dataDir = resolveExisting(backendRoot, "data", "backend/data");
        Path frontendDir = resolveExisting(backendRoot, "../frontend", "frontend");

        DataStore store = new DataStore(dataDir);
        Server server = new Server(store, frontendDir);
        server.start(port);
        System.out.println("AK Base Optimizer server running at http://localhost:" + port);
    }

    private static Path resolveExisting(Path base, String... candidates) {
        for (String c : candidates) {
            Path p = base.resolve(c).normalize();
            if (Files.exists(p)) return p;
            // also try relative to current working directory
            Path cwdP = Paths.get(c).normalize();
            if (Files.exists(cwdP)) return cwdP;
        }
        // fall back to first candidate relative to cwd
        return Paths.get(candidates[0]);
    }

    public void start(int port) throws IOException {
        HttpServer http = HttpServer.create(new InetSocketAddress(port), 0);
        http.createContext("/api/operators", this::handleOperators);
        http.createContext("/api/combos", this::handleCombos);
        http.createContext("/api/analyze", this::handleAnalyze);
        http.createContext("/", this::handleStatic);
        http.setExecutor(null);
        http.start();
    }

    private void handleOperators(HttpExchange ex) throws IOException {
        cors(ex);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("operators", store.operators);
        sendJson(ex, 200, body);
    }

    private void handleCombos(HttpExchange ex) throws IOException {
        cors(ex);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("combos", store.combos);
        sendJson(ex, 200, body);
    }

    @SuppressWarnings("unchecked")
    private void handleAnalyze(HttpExchange ex) throws IOException {
        cors(ex);
        if (ex.getRequestMethod().equalsIgnoreCase("OPTIONS")) {
            ex.sendResponseHeaders(204, -1);
            return;
        }
        if (!ex.getRequestMethod().equalsIgnoreCase("POST")) {
            sendJson(ex, 405, err("Method not allowed, use POST"));
            return;
        }
        try {
            String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            Map<String, Object> req = (Map<String, Object>) Json.parse(body);
            List<Map<String, Object>> roster = (List<Map<String, Object>>) (List<?>) req.getOrDefault("roster", new ArrayList<>());
            Map<String, Object> result = analyzer.analyze(roster);
            sendJson(ex, 200, result);
        } catch (Exception e) {
            sendJson(ex, 400, err("Bad request: " + e.getMessage()));
        }
    }

    private Map<String, Object> err(String msg) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("error", msg);
        return m;
    }

    private void handleStatic(HttpExchange ex) throws IOException {
        String path = ex.getRequestURI().getPath();
        if (path.equals("/")) path = "/index.html";
        Path file = frontendDir.resolve(path.substring(1)).normalize();
        if (!file.startsWith(frontendDir) || !Files.exists(file) || Files.isDirectory(file)) {
            byte[] notFound = "404 Not Found".getBytes(StandardCharsets.UTF_8);
            ex.sendResponseHeaders(404, notFound.length);
            try (OutputStream os = ex.getResponseBody()) { os.write(notFound); }
            return;
        }
        String contentType = guessContentType(file.toString());
        byte[] data = Files.readAllBytes(file);
        ex.getResponseHeaders().set("Content-Type", contentType);
        ex.sendResponseHeaders(200, data.length);
        try (OutputStream os = ex.getResponseBody()) { os.write(data); }
    }

    private String guessContentType(String filename) {
        if (filename.endsWith(".html")) return "text/html; charset=utf-8";
        if (filename.endsWith(".css")) return "text/css; charset=utf-8";
        if (filename.endsWith(".js")) return "application/javascript; charset=utf-8";
        if (filename.endsWith(".json")) return "application/json; charset=utf-8";
        return "application/octet-stream";
    }

    private void cors(HttpExchange ex) {
        ex.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        ex.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        ex.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");
    }

    private void sendJson(HttpExchange ex, int status, Object body) throws IOException {
        ex.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        byte[] data = Json.stringify(body).getBytes(StandardCharsets.UTF_8);
        ex.sendResponseHeaders(status, data.length);
        try (OutputStream os = ex.getResponseBody()) { os.write(data); }
    }
}
